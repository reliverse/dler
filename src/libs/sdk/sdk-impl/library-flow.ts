import pAll from "p-all";
import path from "pathe";

import type {
  BundlerName,
  Esbuild,
  ExcludeMode,
  LibConfig,
  NpmOutExt,
  Sourcemap,
  transpileFormat,
  transpileTarget,
} from "~/types.js";

import type { PerfTimer } from "./utils/utils-perf.js";

import { library_buildLibrary } from "./build/build-library.js";
import { library_publishLibrary } from "./pub/pub-library.js";
import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "./utils/utils-consts.js";
import { relinka } from "./utils/utils-logs.js";

/**
 * Processes libraries based on build mode.
 */
export async function processLibraryFlow(
  timer: PerfTimer,
  isDev: boolean,
  libsActMode: string,
  libsList: Record<string, LibConfig>,
  distJsrDryRun: boolean,
  libsDirDist: string,
  libsDirSrc: string,
  commonPubPause: boolean,
  commonPubRegistry: string,
  unifiedBundlerOutExt: NpmOutExt,
  distNpmBuilder: BundlerName,
  coreIsCLI: boolean,
  coreEntrySrcDir: string,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  transpileEsbuild: Esbuild,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  distJsrBuilder: BundlerName,
  transpileStub: boolean,
  transpileWatch: boolean,
): Promise<void> {
  if (libsActMode !== "libs-only" && libsActMode !== "main-and-libs") {
    relinka(
      "verbose",
      "Skipping libs build/publish as libsActMode is set to 'main-project-only'",
    );
    return;
  }
  await libraries_buildPublish(
    isDev,
    timer,
    libsList,
    distJsrDryRun,
    libsDirDist,
    libsDirSrc,
    commonPubPause,
    commonPubRegistry,
    unifiedBundlerOutExt,
    distNpmBuilder,
    coreIsCLI,
    coreEntrySrcDir,
    rmDepsMode,
    rmDepsPatterns,
    transpileEsbuild,
    transpileTarget,
    transpileFormat,
    transpileSplitting,
    transpileMinify,
    transpileSourcemap,
    transpilePublicPath,
    distJsrBuilder,
    transpileStub,
    transpileWatch,
  );
}

/**
 * Extracts folder name from library name, handling scoped packages.
 * If libDirName is specified in the library config, that value is used instead.
 */
function extractFolderName(libName: string, libConfig?: LibConfig): string {
  // Use libDirName if available
  if (libConfig?.libDirName) {
    return libConfig.libDirName;
  }

  // Default behavior (fallback)
  if (libName.startsWith("@")) {
    const parts = libName.split("/");
    if (parts.length > 1) return parts[1]!;
  }
  return libName;
}

/**
 * Processes all libs defined in config.libsList.
 * Builds and optionally publishes each library based on configuration.
 */
async function libraries_buildPublish(
  isDev: boolean,
  timer: PerfTimer,
  libsList: Record<string, LibConfig>,
  distJsrDryRun: boolean,
  libsDirDist: string,
  libsDirSrc: string,
  commonPubPause: boolean,
  commonPubRegistry: string,
  unifiedBundlerOutExt: NpmOutExt,
  distNpmBuilder: BundlerName,
  coreIsCLI: boolean,
  coreEntrySrcDir: string,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  transpileEsbuild: Esbuild,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  distJsrBuilder: BundlerName,
  transpileStub: boolean,
  transpileWatch: boolean,
): Promise<void> {
  relinka("verbose", "Starting libraries_buildPublish");
  if (!libsList || Object.keys(libsList).length === 0) {
    relinka("info", "No lib configs found in config, skipping libs build.");
    return;
  }
  const libsEntries = Object.entries(libsList);
  const tasks = libsEntries.map(([libName, libConfig]) => async () => {
    try {
      if (!libConfig.libMainFile) {
        relinka(
          "info",
          `Library ${libName} is missing "libMainFile" property. Skipping...`,
        );
        return;
      }
      const folderName = extractFolderName(libName, libConfig);
      const libBaseDir = path.resolve(PROJECT_ROOT, libsDirDist, folderName);
      const npmOutDir = path.join(libBaseDir, "npm");
      const jsrOutDir = path.join(libBaseDir, "jsr");
      const libMainPath = path.parse(libConfig.libMainFile);
      const libMainFile = libMainPath.base;
      let libMainDir: string;
      if (libConfig.libMainFile.startsWith(libsDirSrc)) {
        libMainDir = libMainPath.dir || ".";
      } else {
        libMainDir = path.join(libsDirSrc, libMainPath.dir || ".");
      }
      relinka(
        "verbose",
        `Processing library ${libName}: libMainDir=${libMainDir}, libMainFile=${libMainFile}`,
      );
      await library_buildLibrary(
        commonPubRegistry,
        libName,
        libMainDir,
        npmOutDir,
        jsrOutDir,
        libMainFile,
        isDev,
        coreEntrySrcDir,
        distNpmBuilder,
        libsList,
        coreIsCLI,
        unifiedBundlerOutExt,
        rmDepsMode,
        rmDepsPatterns,
        transpileEsbuild,
        transpileTarget,
        transpileFormat,
        transpileSplitting,
        transpileMinify,
        transpileSourcemap,
        transpilePublicPath,
        distJsrBuilder,
        timer,
        transpileStub,
        transpileWatch,
      );
      if (!commonPubPause) {
        await library_publishLibrary(
          commonPubRegistry,
          libName,
          npmOutDir,
          jsrOutDir,
          distJsrDryRun,
          isDev,
          timer,
        );
      }
    } catch (error) {
      relinka(
        "error",
        `Failed to process library ${libName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (isDev) {
        relinka(
          "verbose",
          `Error details: ${error instanceof Error ? error.stack : "No stack trace available"}`,
        );
      }
      throw error;
    }
  });
  const concurrency = CONCURRENCY_DEFAULT;
  try {
    await pAll(tasks, {
      concurrency,
    });
    relinka("verbose", "Completed libraries_buildPublish");
  } catch (error) {
    if (error instanceof AggregateError) {
      relinka(
        "error",
        "Multiple libraries failed to process. See above for details.",
      );
    } else {
      relinka("error", "Library processing stopped due to an error.");
    }
    throw error;
  }
}
