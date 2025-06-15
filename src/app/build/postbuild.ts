import path, { convertImportsAliasToRelative } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";
import { glob } from "tinyglobby";

import { getCheckCmd } from "~/app/cmds";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { applyMagicSpells } from "~/libs/sdk/sdk-impl/magic/ms-apply";
import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";

import { directoryExists, executeDlerHooks } from "./ppb-utils";

const DIST_DIRECTORIES = ["dist-npm", "dist-jsr"] as const;
const ALIAS_TO_REPLACE = "~";

type PostBuildToolName = "dler-check";

interface PostBuildTool {
  name: string;
  run: () => Promise<void>;
}

const createPostBuildToolRunner = (): Record<PostBuildToolName, PostBuildTool> => ({
  "dler-check": {
    name: "Dler Check",
    async run() {
      const checkCmd = await getCheckCmd();
      await runCmd(checkCmd, ["--no-exit", "--no-progress"]);
    },
  },
});

async function processDistDirectory(dir: string, alias: string): Promise<void> {
  try {
    const binDir = path.join(dir, "bin");

    if (await directoryExists(binDir)) {
      await convertImportsAliasToRelative({
        targetDir: binDir,
        aliasToReplace: alias,
        pathExtFilter: "js-ts-none",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("internal", `Error processing ${dir}: ${errorMessage}`);
    throw error;
  }
}

async function processDistDirectories(): Promise<void> {
  for (const dir of DIST_DIRECTORIES) {
    relinka("log", `[processDistDirectory] ${dir}`);
    await processDistDirectory(dir, ALIAS_TO_REPLACE);
  }
}

async function copyNonBuildFiles(
  srcDir: string,
  distDir: string,
  preExtensions: string[],
  templatesDir: string,
): Promise<void> {
  try {
    // Get all files in src directory
    const files = await glob("**/*", {
      cwd: srcDir,
      onlyFiles: true,
    });

    // Copy files that are not in preExtensions or are in templates directory
    for (const file of files) {
      const ext = path.extname(file).slice(1);
      const isInTemplatesDir = file.startsWith(templatesDir);

      if (isInTemplatesDir || !preExtensions.includes(ext)) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(distDir, file);
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(srcPath, destPath);
      }
    }
  } catch (error) {
    relinka(
      "error",
      `Error copying non-build files: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function dlerPostBuild(isDev: boolean): Promise<void> {
  relinka("info", "— — — dlerPostBuild — — —");

  const config = await getConfigDler();

  // Cross replacements
  await resolveAllCrossLibs();

  // Copy non-build files to dist directories
  if (config.commonPubRegistry === "npm" || config.commonPubRegistry === "npm-jsr") {
    await copyNonBuildFiles(
      path.join(PROJECT_ROOT, config.coreEntrySrcDir),
      path.join(PROJECT_ROOT, config.distNpmDirName),
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

  if (config.commonPubRegistry === "jsr" || config.commonPubRegistry === "npm-jsr") {
    await copyNonBuildFiles(
      path.join(PROJECT_ROOT, config.coreEntrySrcDir),
      path.join(PROJECT_ROOT, config.distJsrDirName),
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

  if (config.libsActMode === "libs-only" || config.libsActMode === "main-and-libs") {
    await copyNonBuildFiles(
      path.join(PROJECT_ROOT, config.libsDirSrc),
      path.join(PROJECT_ROOT, config.libsDirDist),
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

  // Apply magic spells for end-users only
  if (isDev) {
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
  }

  // Convert alias to relative paths
  await processDistDirectories();

  // Execute custom post-build hooks
  await executeDlerHooks(config?.hooksAfterBuild ?? [], "post-build");

  // Run post-build tools
  if (config?.runAfterBuild?.length) {
    const tools = createPostBuildToolRunner();

    const availableTools = config.runAfterBuild
      .filter((toolName): toolName is PostBuildToolName => toolName in tools)
      .map((toolName) => ({ toolName, ...tools[toolName] }));

    for (const { name, run } of availableTools) {
      relinka("log", `Running ${name}...`);
      await run();
    }
  }
}
