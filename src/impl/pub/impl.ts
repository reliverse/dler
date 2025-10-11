import { bumpHandler, isBumpDisabled, setBumpDisabledValueTo } from "@reliverse/bleump";
import { relinka } from "@reliverse/relinka";
import { createMultiStepSpinner } from "@reliverse/rempts";
import { dlerBuild } from "~/impl/build/impl";
import { library_pubFlow } from "~/impl/build/library-flow";
import { regular_pubFlow } from "~/impl/build/regular-flow";
import { getConfigDler } from "~/impl/config/load";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";
import { finalizeBuild, finalizePub } from "~/impl/utils/finalize";
import { handleDlerError } from "~/impl/utils/utils-error-cwd";
import { createCompletionTexts } from "../utils/finish-text";

// ==========================
// rse publish
// ==========================

/**
 * Main entry point for the rse build and publish process.
 * Handles building and publishing for both main project and libraries.
 * @see `src/impl/build/impl.ts` for build main function implementation.
 */
export async function dlerPub(timer: PerfTimer, isDev: boolean, config?: ReliverseConfig) {
  let effectiveConfig = config;
  let shouldShowSpinner = false;
  let multiStepSpinner: ReturnType<typeof createMultiStepSpinner> | null = null;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Start multi-step spinner if displayBuildPubLogs is false
    shouldShowSpinner = effectiveConfig.displayBuildPubLogs === false;

    const pubSteps = effectiveConfig.commonPubPause
      ? ["Loading configuration", "Version bumping", "Building project", "Finalizing"]
      : [
          "Loading configuration",
          "Version bumping",
          "Building project",
          "Publishing",
          "Finalizing",
        ];

    multiStepSpinner = shouldShowSpinner
      ? createMultiStepSpinner("Build and Publish Process", pubSteps, { color: "cyan" })
      : null;

    if (multiStepSpinner) multiStepSpinner.nextStep(); // Move to version bumping

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

    // Move to building step
    if (multiStepSpinner) multiStepSpinner.nextStep();

    // Build step (disable build's own spinner since pub is handling it)
    const { effectiveConfig: buildConfig } = await dlerBuild({
      flow: "pub",
      timer,
      isDev,
      config: effectiveConfig,
      debugOnlyCopyNonBuildFiles: false,
      debugDontCopyNonBuildFiles: false,
      disableOwnSpinner: true, // disable build's spinner if pub is showing one
    });

    // Move to next step based on whether we're publishing
    if (multiStepSpinner) multiStepSpinner.nextStep();

    if (effectiveConfig.commonPubPause) {
      // Finalize build
      await finalizeBuild(shouldShowSpinner, timer, effectiveConfig.commonPubPause, "pub");
      // Complete multi-step spinner for build-only with detailed message
      const buildTexts = await createCompletionTexts(buildConfig, timer, "build");
      if (multiStepSpinner) {
        multiStepSpinner.complete(buildTexts.plain);
      } else {
        relinka("success", buildTexts.withEmoji);
      }
    } else {
      // Publish step
      await regular_pubFlow(timer, isDev, buildConfig);
      await library_pubFlow(timer, isDev, buildConfig);

      // Move to finalizing step
      if (multiStepSpinner) multiStepSpinner.nextStep();

      // Finalize publish
      await finalizePub(
        buildConfig.libsList,
        buildConfig.distNpmDirName,
        buildConfig.distJsrDirName,
        buildConfig.libsDirDist,
      );

      // Complete multi-step spinner for build+publish
      const publishTexts = await createCompletionTexts(buildConfig, timer, "publish");
      if (multiStepSpinner) {
        multiStepSpinner.complete(publishTexts.plain);
      } else {
        relinka("success", publishTexts.withEmoji);
      }
    }
  } catch (error) {
    // Stop multi-step spinner with error message if it was running
    if (multiStepSpinner) {
      const currentStep = multiStepSpinner.getCurrentStep();
      multiStepSpinner.error(error as Error, currentStep);
    }
    handleDlerError(error);
  }
}
