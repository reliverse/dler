import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createMultiStepSpinner } from "@reliverse/rempts";
import { binary_buildFlow } from "~/impl/build/binary-flow";
import { library_buildFlow } from "~/impl/build/library-flow";
import { regular_buildFlow } from "~/impl/build/regular-flow";
import { PROJECT_ROOT } from "~/impl/config/constants";
import { getConfigDler } from "~/impl/config/load";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";
import { removeDistFolders } from "~/impl/utils/utils-clean";
import { handleDlerError } from "~/impl/utils/utils-error-cwd";
import { createCompletionTexts } from "../utils/finish-text";
import { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./postbuild";
import { dlerPreBuild } from "./prebuild";

// ==========================
// rse build
// ==========================

/**
 * Main entry point for the rse build process.
 * Handles building for both main project and libraries.
 * @see `src/impl/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild({
  flow,
  timer,
  isDev,
  config,
  debugOnlyCopyNonBuildFiles,
  debugDontCopyNonBuildFiles,
  disableOwnSpinner,
}: {
  flow: "build" | "pub";
  timer: PerfTimer;
  isDev: boolean;
  config?: ReliverseConfig;
  debugOnlyCopyNonBuildFiles?: boolean;
  debugDontCopyNonBuildFiles?: boolean;
  disableOwnSpinner?: boolean;
}) {
  let effectiveConfig = config;
  let shouldShowSpinner = false;
  let multiStepSpinner: ReturnType<typeof createMultiStepSpinner> | null = null;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Start multi-step spinner if displayBuildPubLogs is false and not disabled by caller
    shouldShowSpinner = effectiveConfig.displayBuildPubLogs === false && !disableOwnSpinner;

    const buildSteps = [
      "Loading configuration",
      "Cleaning previous build",
      "Pre-build setup",
      "Building main project",
      "Building libraries",
      "Building binaries",
      "Post-build cleanup",
    ];

    multiStepSpinner = shouldShowSpinner
      ? createMultiStepSpinner("Build Process", buildSteps, { color: "blue" })
      : null;

    if (multiStepSpinner) multiStepSpinner.nextStep(); // Move to cleaning step

    // Clean up previous run artifacts
    if (effectiveConfig.logsFreshFile) {
      await fs.remove(path.join(PROJECT_ROOT, effectiveConfig.logsFileName));
    }
    await removeDistFolders(
      effectiveConfig.distNpmDirName,
      effectiveConfig.distJsrDirName,
      effectiveConfig.libsDirDist,
      effectiveConfig.libsList,
      "dist-tmp",
    );

    // Move to pre-build step
    if (multiStepSpinner) multiStepSpinner.nextStep();

    if (debugOnlyCopyNonBuildFiles) {
      if (debugDontCopyNonBuildFiles) {
        relinka(
          "error",
          "📝 debugOnlyCopyNonBuildFiles and debugDontCopyNonBuildFiles cannot be used together",
        );
        process.exit(1);
      }

      await wrapper_CopyNonBuildFiles(effectiveConfig);

      relinka("info", "📝 debugOnlyCopyNonBuildFiles was used, build finished, exiting...");
      process.exit(0);
    }

    // Run pre checks/tools/hooks and copy files to temp directories
    await dlerPreBuild(effectiveConfig);

    // Move to building main project step
    if (multiStepSpinner) multiStepSpinner.nextStep();

    // Build main project and, if configured, libraries
    // Use temporary directories as source for bundlers
    const tempDirs = {
      npm: "dist-tmp/tmp-npm",
      jsr: "dist-tmp/tmp-jsr",
      libs: "dist-tmp/tmp-libs",
    };

    // Create a modified config that points to temp directories
    const tempConfig = {
      ...effectiveConfig,
      coreEntrySrcDir: tempDirs.npm,
      libsDirSrc: tempDirs.libs,
    };

    await regular_buildFlow(timer, isDev, tempConfig);

    // Move to building libraries step
    if (multiStepSpinner) multiStepSpinner.nextStep();
    await library_buildFlow(timer, isDev, tempConfig);

    // Move to building binaries step
    if (multiStepSpinner) multiStepSpinner.nextStep();
    await binary_buildFlow(timer, isDev, tempConfig);

    // Move to post-build step
    if (multiStepSpinner) multiStepSpinner.nextStep();

    // Run post checks/tools/hooks and copy non-build files
    await dlerPostBuild(isDev, debugDontCopyNonBuildFiles);

    // Clean up temp directories
    if (effectiveConfig.postBuildSettings?.deleteDistTmpAfterBuild) {
      await fs.remove(path.join(PROJECT_ROOT, "dist-tmp"));
    }

    // Complete multi-step spinner with success message
    if (flow === "build") {
      const { plain, withEmoji } = await createCompletionTexts(effectiveConfig, timer, "build");
      if (multiStepSpinner) {
        multiStepSpinner.complete(plain);
      } else {
        relinka("success", withEmoji);
      }
    }

    return { timer, effectiveConfig };
  } catch (error) {
    // Stop multi-step spinner with error message if it was running
    if (multiStepSpinner) {
      const currentStep = multiStepSpinner.getCurrentStep();
      multiStepSpinner.error(error as Error, currentStep);
    }
    handleDlerError(error);
  }
}
