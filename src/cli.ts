import fs from "fs-extra";
import path from "pathe";

import { processLibraryFlow } from "./libs/sdk/sdk-impl/library-flow.js";
import { processRegularFlow } from "./libs/sdk/sdk-impl/regular-flow.js";
import { bumpHandler } from "./libs/sdk/sdk-impl/utils/utils-bump.js";
import { removeDistFolders } from "./libs/sdk/sdk-impl/utils/utils-clean.js";
import { PROJECT_ROOT } from "./libs/sdk/sdk-impl/utils/utils-consts.js";
import { handleRelidlerError } from "./libs/sdk/sdk-impl/utils/utils-error.js";
import { finalizeBuild } from "./libs/sdk/sdk-impl/utils/utils-info.js";
import { relinka } from "./libs/sdk/sdk-impl/utils/utils-logs.js";
import { createPerfTimer } from "./libs/sdk/sdk-impl/utils/utils-perf.js";
import { loadConfig } from "./load.js";

// ==========================
// Relidler CLI Main Function
// ==========================

/**
 * Main entry point for the relidler build and publish process.
 * Handles building and publishing for both main project and libraries.
 */
export async function relidler(isDev: boolean) {
  // Create a performance timer
  const timer = createPerfTimer();

  try {
    // Load config with defaults and user overrides
    // This config load is a single source of truth
    const config = await loadConfig();

    // Prepare dev environment
    if (isDev) {
      config.commonPubPause = true;
      config.bumpDisable = true;
      relinka(
        "info",
        "Development mode: Publishing paused and version bumping disabled.",
      );
    }

    // Clean up previous run artifacts
    if (config.logsFreshFile) {
      await fs.remove(path.join(PROJECT_ROOT, config.logsFileName));
    }
    await removeDistFolders(
      config.distNpmDirName,
      config.distJsrDirName,
      config.libsDirDist,
      config.libsList,
    );

    // Handle version bumping if enabled
    if (!config.bumpDisable) {
      await bumpHandler(
        config.bumpMode,
        config.bumpDisable,
        config.commonPubPause,
        config.bumpFilter,
      );
    }

    // Process main project
    await processRegularFlow(
      timer,
      isDev,
      config.coreIsCLI,
      config.libsActMode,
      config.commonPubRegistry,
      config.coreEntrySrcDir,
      config.distNpmDirName,
      config.distNpmBuilder,
      config.coreEntryFile,
      config.distJsrDryRun,
      config.commonPubPause,
      config.distJsrDirName,
      config.distJsrBuilder,
      config.transpileTarget,
      config.transpileFormat,
      config.transpileSplitting,
      config.transpileMinify,
      config.transpileSourcemap,
      config.transpilePublicPath,
      config.distJsrAllowDirty,
      config.distJsrSlowTypes,
      config.distNpmOutFilesExt,
      config.rmDepsMode,
      config.transpileStub,
      config.transpileWatch,
      config.distJsrGenTsconfig,
      config.coreDeclarations,
    );

    // Process libraries
    await processLibraryFlow(
      timer,
      isDev,
      config.libsActMode,
      config.libsList,
      config.distJsrDryRun,
      config.libsDirDist,
      config.libsDirSrc,
      config.commonPubPause,
      config.commonPubRegistry,
      config.distNpmOutFilesExt,
      config.distNpmBuilder,
      config.coreEntrySrcDir,
      config.rmDepsMode,
      config.rmDepsPatterns,
      config.transpileEsbuild,
      config.transpileTarget,
      config.transpileFormat,
      config.transpileSplitting,
      config.transpileSourcemap,
      config.transpilePublicPath,
      config.distJsrBuilder,
      config.transpileStub,
      config.transpileWatch,
      config.distJsrOutFilesExt,
    );

    // Finalize relidler
    await finalizeBuild(
      timer,
      config.commonPubPause,
      config.libsList,
      config.distNpmDirName,
      config.distJsrDirName,
      config.libsDirDist,
      isDev,
    );
  } catch (error) {
    handleRelidlerError(error, timer);
  }
}
