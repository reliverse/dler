import path, { convertImportsAliasToRelative } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";

import type { DlerConfig } from "~/libs/sdk/sdk-mod";

import { getCheckCmd } from "~/app/cmds";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { applyMagicSpells } from "~/libs/sdk/sdk-impl/magic/ms-apply";
import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";

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

async function copyNonSourceFiles(srcDir: string, config: DlerConfig): Promise<void> {
  const distDirs = ["dist-npm", "dist-jsr", "dist-libs"];

  // Get all files recursively
  const files = await fs.readdir(srcDir, { withFileTypes: true, recursive: true });

  for (const file of files) {
    if (!file.isFile()) continue;

    const filePath = path.join(srcDir, file.name);
    const relativePath = path.relative(srcDir, filePath);
    const ext = path.extname(filePath).slice(1);

    // Skip files that are in pre-build extensions (unless they are in templates directory)
    if (
      config.buildPreExtensions.includes(ext) &&
      !relativePath.startsWith(config.buildTemplatesDir)
    )
      continue;

    // Skip files that are not in post-build extensions
    if (!config.buildPostExtensions.includes(ext)) continue;

    // Copy to each dist directory
    for (const distDir of distDirs) {
      const destPath = path.join(distDir, relativePath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(filePath, destPath);
    }
  }
}

export async function dlerPostBuild(isDev: boolean): Promise<void> {
  // Cross replacements
  await resolveAllCrossLibs();

  // Apply magic spells for end-users only
  if (isDev) {
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
  }

  // Convert alias to relative paths
  await processDistDirectories();

  // Copy non-source files to dist directories
  const config = await getConfigDler();
  await copyNonSourceFiles(config.coreEntrySrcDir, config);

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
