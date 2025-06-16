import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { library_buildFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { regular_buildFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";
import { createPerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

import { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./postbuild";
import { dlerPreBuild } from "./prebuild";

// ==========================
// dler build
// ==========================

/**
 * Main entry point for the dler build process.
 * Handles building for both main project and libraries.
 * @see `src/app/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild(
  isDev: boolean,
  config?: DlerConfig,
  debugOnlyCopyNonBuildFiles?: boolean,
  debugDontCopyNonBuildFiles?: boolean,
) {
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

    return { timer, effectiveConfig };
  } catch (error) {
    handleDlerError(error);
  }
}
