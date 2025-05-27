import {
  bumpHandler,
  isBumpDisabled,
  setBumpDisabledValueTo,
} from "@reliverse/bleump";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";

import { loadConfig } from "~/init/load";
import { processLibraryFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { processRegularFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { finalizeBuildPub } from "~/libs/sdk/sdk-impl/utils/finalize";
import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error";
import { createPerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

// ==========================
// dler CLI Main Function
// ==========================

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 */
export async function dlerBuild(isDev: boolean) {
  // TODO: remove config.commonPubPause once pub will call dlerBuild instead of replicating its code

  // Create a performance timer
  const timer = createPerfTimer();

  try {
    // Load config with defaults and user overrides
    // This config load is a single source of truth
    const config = await loadConfig();

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
    try {
      const bumpIsDisabled = await isBumpDisabled();
      if (!bumpIsDisabled && !config.commonPubPause) {
        await bumpHandler(
          config.bumpMode,
          false,
          config.bumpFilter,
          config.bumpSet,
        );
        await setBumpDisabledValueTo(true);
      }
    } catch {
      throw new Error("[.config/dler.ts] Failed to set bumpDisable to true");
    }

    // Process main project
    await processRegularFlow(timer, isDev, config);

    // Process libraries
    await processLibraryFlow(timer, isDev, config);

    // Finalize dler
    await finalizeBuildPub(
      timer,
      config.commonPubPause,
      config.libsList,
      config.distNpmDirName,
      config.distJsrDirName,
      config.libsDirDist,
    );
  } catch (error) {
    handleDlerError(error, timer);
  }
}

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 */
export async function dlerPub(isDev: boolean) {
  // Create a performance timer
  const timer = createPerfTimer();

  try {
    // Load config with defaults and user overrides
    // This config load is a single source of truth
    const config = await loadConfig();

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

    // TODO: remove this once pub will call dlerBuild instead of replicating its code
    // Handle version bumping if enabled
    const bumpIsDisabled = await isBumpDisabled();
    if (!bumpIsDisabled && !config.commonPubPause) {
      try {
        await bumpHandler(
          config.bumpMode,
          false,
          config.bumpFilter,
          config.bumpSet,
        );
        await setBumpDisabledValueTo(true);
      } catch {
        throw new Error("[.config/dler.ts] Failed to set bumpDisable to true");
      }
    }

    // Process main project
    await processRegularFlow(timer, isDev, config);

    // Process libraries
    await processLibraryFlow(timer, isDev, config);

    // Finalize dler
    await finalizeBuildPub(
      timer,
      config.commonPubPause,
      config.libsList,
      config.distNpmDirName,
      config.distJsrDirName,
      config.libsDirDist,
    );
  } catch (error) {
    handleDlerError(error, timer);
  }
}
