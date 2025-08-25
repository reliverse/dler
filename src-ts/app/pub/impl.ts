import { bumpHandler, isBumpDisabled, setBumpDisabledValueTo } from "@reliverse/bleump";
import { dlerBuild } from "~/app/build/impl";
import { library_pubFlow } from "~/app/build/library-flow";
import { regular_pubFlow } from "~/app/build/regular-flow";
import { getConfigDler } from "~/app/config/load";
import type { DlerConfig } from "~/app/types/mod";
import { finalizeBuild, finalizePub } from "~/app/utils/finalize";
import { createSpinner } from "~/app/utils/spinner";
import { handleDlerError } from "~/app/utils/utils-error-cwd";

// ==========================
// dler pub
// ==========================

/**
 * Main entry point for the dler build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src-ts/app/build/impl.ts` for build main function implementation.
 */
export async function dlerPub(isDev: boolean, config?: DlerConfig) {
  let effectiveConfig = config;
  let shouldShowSpinner = false;
  let spinner: ReturnType<typeof createSpinner> | null = null;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Start spinner if displayBuildPubLogs is false
    shouldShowSpinner = effectiveConfig.displayBuildPubLogs === false;
    spinner = shouldShowSpinner ? createSpinner("Building and publishing...").start() : null;

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
        throw new Error("[reliverse.ts] Failed to set bumpDisable to true");
      }
    }

    // Build step (disable build's own spinner since pub is handling it)
    const { timer, effectiveConfig: buildConfig } = await dlerBuild(
      isDev,
      effectiveConfig,
      undefined,
      undefined,
      shouldShowSpinner, // disable build's spinner if pub is showing one
    );

    if (effectiveConfig.commonPubPause) {
      // Finalize build
      await finalizeBuild(timer, effectiveConfig.commonPubPause, "pub");
      // Stop spinner with success message for build-only
      if (shouldShowSpinner && spinner) {
        spinner.succeed("Build completed successfully!");
      }
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
      // Stop spinner with success message for build+publish
      if (shouldShowSpinner && spinner) {
        spinner.succeed("Build and publish completed successfully!");
      }
    }
  } catch (error) {
    // Stop spinner with error message if it was running
    if (shouldShowSpinner && spinner) {
      spinner.fail("Build and publish failed!");
    }
    handleDlerError(error);
  }
}
