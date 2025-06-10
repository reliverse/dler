import { bumpHandler, isBumpDisabled, setBumpDisabledValueTo } from "@reliverse/bleump";
import path, { convertImportsAliasToRelative } from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
// import process from "node:process";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { processLibraryFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { processRegularFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { applyMagicSpells } from "~/libs/sdk/sdk-impl/spell/applyMagicSpells";
import { finalizeBuildPub } from "~/libs/sdk/sdk-impl/utils/finalize";
import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";
import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";
import { createPerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

// ==========================
// dler pub
// ==========================

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src/app/build/impl.ts` for build main function implementation.
 */
export async function dlerPub(isDev: boolean, config?: DlerConfig) {
  // Create a performance timer
  const timer = createPerfTimer();

  let effectiveConfig = config;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Clean up previous run artifacts
    if (effectiveConfig.logsFreshFile) {
      await fs.remove(path.join(PROJECT_ROOT, effectiveConfig.logsFileName));
    }
    await removeDistFolders(
      effectiveConfig.distNpmDirName,
      effectiveConfig.distJsrDirName,
      effectiveConfig.libsDirDist,
      effectiveConfig.libsList,
    );

    // TODO: remove this once pub will call dlerBuild instead of replicating its code
    // Handle version bumping if enabled
    const bumpIsDisabled = await isBumpDisabled();
    if (!bumpIsDisabled && !effectiveConfig.commonPubPause) {
      try {
        await bumpHandler(
          effectiveConfig.bumpMode,
          false,
          effectiveConfig.bumpFilter,
          effectiveConfig.bumpSet,
        );
        await setBumpDisabledValueTo(true);
      } catch {
        throw new Error("[.config/dler.ts] Failed to set bumpDisable to true");
      }
    }

    // Process main project
    await processRegularFlow(timer, isDev, effectiveConfig);

    // Process libraries
    await processLibraryFlow(timer, isDev, effectiveConfig);

    /* ====================================
        EXPERIMENTAL POSTBUILD START
     ================================= */

    // Cross replacements
    await resolveAllCrossLibs();

    // Apply magic spells
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);

    // Convert alias to relative paths
    relinka("log", "[processDistDirectory] dist-npm");
    await processDistDirectory("dist-npm", "~");
    relinka("log", "[processDistDirectory] dist-jsr");
    await processDistDirectory("dist-jsr", "~");

    /* ====================================
        EXPERIMENTAL POSTBUILD END
     ================================= */

    // Finalize dler
    await finalizeBuildPub(
      timer,
      effectiveConfig.commonPubPause,
      effectiveConfig.libsList,
      effectiveConfig.distNpmDirName,
      effectiveConfig.distJsrDirName,
      effectiveConfig.libsDirDist,
    );
  } catch (error) {
    handleDlerError(error);
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function processDistDirectory(dir: string, alias: string): Promise<string[]> {
  const modifiedFiles: string[] = [];
  try {
    const binDir = path.join(dir, "bin");
    const binDirExists = await directoryExists(binDir);
    if (binDirExists) {
      await convertImportsAliasToRelative({
        targetDir: binDir,
        aliasToReplace: alias,
        pathExtFilter: "js-ts-none",
        // displayLogsOnlyFor: [
        //   "dist-npm/bin/libs/cfg/cfg-mod.js",
        //   "dist-jsr/bin/libs/cfg/cfg-mod.ts",
        // ],
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("internal", `Error processing ${dir}: ${errorMessage}`);
    throw error;
  }
  return modifiedFiles;
}
