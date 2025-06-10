import { bumpHandler, isBumpDisabled, setBumpDisabledValueTo } from "@reliverse/bleump";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { processLibraryFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { processRegularFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { finalizeBuildPub } from "~/libs/sdk/sdk-impl/utils/finalize";
import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";
import { createPerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

// ==========================
// dler build
// ==========================

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src/app/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild(isDev: boolean, config?: DlerConfig) {
  // TODO: remove effectiveConfig.commonPubPause once pub will call dlerBuild instead of replicating its code

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

    // Handle version bumping if enabled
    try {
      const bumpIsDisabled = await isBumpDisabled();
      if (!bumpIsDisabled && !effectiveConfig.commonPubPause) {
        await bumpHandler(
          effectiveConfig.bumpMode,
          false,
          effectiveConfig.bumpFilter,
          effectiveConfig.bumpSet,
        );
        await setBumpDisabledValueTo(true);
      }
    } catch {
      throw new Error("[.config/dler.ts] Failed to set bumpDisable to true");
    }

    // Process main project
    await processRegularFlow(timer, isDev, effectiveConfig);

    // Process libraries
    await processLibraryFlow(timer, isDev, effectiveConfig);

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
