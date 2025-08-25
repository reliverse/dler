import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { library_buildFlow } from "~/app/build/library-flow";
import { regular_buildFlow } from "~/app/build/regular-flow";
import { PROJECT_ROOT } from "~/app/config/constants";
import { getConfigDler } from "~/app/config/load";
import type { DlerConfig } from "~/app/types/mod";
import { createSpinner } from "~/app/utils/spinner";
import { removeDistFolders } from "~/app/utils/utils-clean";
import { handleDlerError } from "~/app/utils/utils-error-cwd";
import { createPerfTimer } from "~/app/utils/utils-perf";

import { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./postbuild";
import { dlerPreBuild } from "./prebuild";

// ==========================
// dler build
// ==========================

/**
 * Main entry point for the dler build process.
 * Handles building for both main project and libraries.
 * @see `src-ts/app/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild(
  isDev: boolean,
  config?: DlerConfig,
  debugOnlyCopyNonBuildFiles?: boolean,
  debugDontCopyNonBuildFiles?: boolean,
  disableOwnSpinner?: boolean,
) {
  // Create a performance timer
  const timer = createPerfTimer();

  let effectiveConfig = config;
  let shouldShowSpinner = false;
  let spinner: ReturnType<typeof createSpinner> | null = null;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Start spinner if displayBuildPubLogs is false and not disabled by caller
    shouldShowSpinner = effectiveConfig.displayBuildPubLogs === false && !disableOwnSpinner;
    spinner = shouldShowSpinner ? createSpinner("Building...").start() : null;

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
    await library_buildFlow(timer, isDev, tempConfig);

    // Run post checks/tools/hooks and copy non-build files
    await dlerPostBuild(isDev, debugDontCopyNonBuildFiles);

    // Clean up temp directories
    if (effectiveConfig.postBuildSettings?.deleteDistTmpAfterBuild) {
      await fs.remove(path.join(PROJECT_ROOT, "dist-tmp"));
    }

    // Stop spinner with success message
    if (shouldShowSpinner && spinner) {
      spinner.succeed("Build completed successfully!");
    }

    return { timer, effectiveConfig };
  } catch (error) {
    // Stop spinner with error message if it was running
    if (shouldShowSpinner && spinner) {
      spinner.fail("Build failed!");
    }
    handleDlerError(error);
  }
}
