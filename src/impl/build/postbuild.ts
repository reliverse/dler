import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
// import { callCmd } from "@reliverse/rempts";
import { glob } from "tinyglobby";
// import { default as checkCmd } from "~/impl/check/cmd";
import { PROJECT_ROOT } from "~/impl/config/constants";
import { getConfigDler } from "~/impl/config/load";
import { applyMagicSpells } from "~/impl/magic/magic-apply";
import type { ReliverseConfig } from "~/impl/schema/mod";
import { resolveAllCrossLibs } from "~/impl/utils/resolve-cross-libs";

import { directoryExists, executeDlerHooks } from "./ppb-utils";

const ALIAS_TO_REPLACE = "~";

type PostBuildToolName = "dler-check";

interface PostBuildTool {
  name: string;
  run: () => Promise<void>;
}

export async function dlerPostBuild(
  isDev: boolean,
  debugDontCopyNonBuildFiles?: boolean,
): Promise<void> {
  relinka("verbose", "— — — dlerPostBuild — — —");

  const config = await getConfigDler();

  // Cross replacements
  await resolveAllCrossLibs(
    "package",
    ALIAS_TO_REPLACE,
    ["npm", "jsr"],
    config.buildPreExtensions,
    config.buildTemplatesDir,
  );

  // Copy non-build files to dist directories
  if (!debugDontCopyNonBuildFiles) {
    await wrapper_CopyNonBuildFiles(config);
  }

  // Apply magic spells only when building dler itself
  // Users should call applyMagicSpells manually in their codebase
  if (isDev) {
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
  }

  // Convert alias to relative paths
  // await processDistDirectories(config);

  // Execute custom post-build hooks
  await executeDlerHooks(config?.hooksAfterBuild ?? [], "post-build");

  // Run post-build tools
  if (config?.runAfterBuild?.length) {
    const tools = createPostBuildToolRunner();

    const availableTools = config.runAfterBuild
      .filter((toolName): toolName is PostBuildToolName => toolName in tools)
      .map((toolName) => ({ toolName, ...tools[toolName] }));

    for (const { name, run } of availableTools) {
      relinka("verbose", `Running ${name}...`);
      await run();
    }
  }

  // Compare file structures if dist-jsr exists and has bin directory
  const distJsrPath = path.join(PROJECT_ROOT, config.distJsrDirName);
  const distJsrBinPath = path.join(distJsrPath, "bin");
  if ((await directoryExists(distJsrPath)) && (await directoryExists(distJsrBinPath))) {
    await compareFileStructures(
      path.join(PROJECT_ROOT, config.coreEntrySrcDir),
      distJsrPath,
      isDev,
    );
  }
}

export async function wrapper_CopyNonBuildFiles(config: ReliverseConfig): Promise<void> {
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
    for (const [_, libConfig] of Object.entries(config.libsList)) {
      const srcPath = path.join(PROJECT_ROOT, config.libsDirSrc, libConfig.libDirName);
      const distPath = path.join(PROJECT_ROOT, config.libsDirDist, libConfig.libDirName);

      if (libConfig.libPubRegistry === "npm" || libConfig.libPubRegistry === "npm-jsr") {
        await copyNonBuildFiles(
          srcPath,
          path.join(distPath, "npm"),
          config.buildPreExtensions,
          config.buildTemplatesDir,
        );
      }

      if (libConfig.libPubRegistry === "jsr" || libConfig.libPubRegistry === "npm-jsr") {
        await copyNonBuildFiles(
          srcPath,
          path.join(distPath, "jsr"),
          config.buildPreExtensions,
          config.buildTemplatesDir,
        );
      }
    }
  }
}

async function copyNonBuildFiles(
  srcDir: string,
  distDir: string,
  preExtensions: string[],
  templatesDir: string,
): Promise<void> {
  try {
    // Find all templates directories at any depth
    const templatesDirs = await glob(`**/${templatesDir}`, {
      cwd: srcDir,
      onlyDirectories: true,
      absolute: true,
    });

    // Copy each templates directory
    for (const templateDir of templatesDirs) {
      const relativePath = path.relative(srcDir, templateDir);
      const templatesDestPath = path.join(distDir, "bin", relativePath);
      await fs.ensureDir(path.dirname(templatesDestPath));
      await fs.copy(templateDir, templatesDestPath);
    }

    // Get all files in src directory, excluding all templates directories
    const files = await glob("**/*", {
      cwd: srcDir,
      ignore: [`**/${templatesDir}/**`],
    });

    // Copy files that are not in preExtensions
    for (const file of files) {
      const ext = path.extname(file).slice(1);

      if (!preExtensions.includes(ext)) {
        const srcPath = path.join(srcDir, file);
        const binDir = path.join(distDir, "bin");
        const destPath = path.join(binDir, file);

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

async function compareFileStructures(
  srcDir: string,
  distDir: string,
  isDev: boolean,
): Promise<void> {
  try {
    const srcFiles = await glob("**/*", {
      cwd: srcDir,
      onlyFiles: true,
      dot: true,
    });

    const distBinDir = path.join(distDir, "bin");
    const distFiles = await glob("**/*", {
      cwd: distBinDir,
      onlyFiles: true,
      dot: true,
    });

    // Filter out test files
    const filteredSrcFiles = srcFiles.filter(
      (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.js"),
    );
    const filteredDistFiles = distFiles.filter(
      (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.js"),
    );

    const srcSet = new Set(filteredSrcFiles);
    const distSet = new Set(filteredDistFiles);

    const onlyInSrc = [...srcSet].filter((x) => !distSet.has(x));
    const onlyInDist = [...distSet].filter((x) => !srcSet.has(x));

    if ((onlyInSrc.length > 0 || onlyInDist.length > 0) && isDev) {
      relinka("warn", "File structure differences detected between src and dist-jsr/bin:");

      if (onlyInSrc.length > 0) {
        relinka("warn", "Files only in src:");
        for (const file of onlyInSrc) {
          relinka("warn", `  - ${file}`);
        }
      }

      if (onlyInDist.length > 0) {
        relinka("warn", "Files only in dist-jsr/bin:");
        for (const file of onlyInDist) {
          relinka("warn", `  - ${file}`);
        }
      }
    }
  } catch (error) {
    relinka(
      "error",
      `Error comparing file structures: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

const createPostBuildToolRunner = (): Record<PostBuildToolName, PostBuildTool> => ({
  "dler-check": {
    name: "Dler Check",
    async run() {
      // TODO: uncomment this
      // await callCmd(checkCmd, {
      //   "no-exit": true,
      //   "no-progress": true,
      // });
    },
  },
});
