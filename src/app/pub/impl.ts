import { bumpHandler, isBumpDisabled, setBumpDisabledValueTo } from "@reliverse/bleump";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { dlerBuild } from "~/app/build/impl";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { library_pubFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { regular_pubFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { finalizeBuild, finalizePub } from "~/libs/sdk/sdk-impl/utils/finalize";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";

// ==========================
// dler pub
// ==========================

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src/app/build/impl.ts` for build main function implementation.
 */
export async function dlerPub(isDev: boolean, config?: DlerConfig) {
  let effectiveConfig = config;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

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

    // Build step
    const { timer, effectiveConfig: buildConfig } = await dlerBuild(isDev, effectiveConfig);

    if (effectiveConfig.commonPubPause) {
      // Finalize build
      await finalizeBuild(timer, effectiveConfig.commonPubPause, "pub");
    } else {
      // Publish step
      await regular_pubFlow(timer, isDev, buildConfig);
      await library_pubFlow(timer, isDev, buildConfig);

      // Finalize publish
      await finalizePub(
        timer,
        buildConfig.libsList,
        buildConfig.distNpmDirName,
        buildConfig.distJsrDirName,
        buildConfig.libsDirDist,
      );
    }
  } catch (error) {
    handleDlerError(error);
  }
}
