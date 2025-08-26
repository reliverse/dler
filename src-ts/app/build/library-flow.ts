import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import pAll from "p-all";
import { library_buildLibrary } from "~/app/build/build-library";
import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "~/app/config/constants";
import { library_publishLibrary } from "~/app/pub/pub-library";
import type {
  BundlerName,
  Esbuild,
  LibConfig,
  NpmOutExt,
  ReliverseConfig,
  Sourcemap,
  TranspileFormat,
  TranspileTarget,
} from "~/app/schema/mod";
import type { PerfTimer } from "~/app/types/mod";
import { resumePerfTimer } from "~/app/utils/utils-perf";

/**
 * Builds libraries based on build mode.
 */
export async function library_buildFlow(
  timer: PerfTimer,
  isDev: boolean,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "— — — library_buildFlow — — —");

  if (config.libsActMode !== "libs-only" && config.libsActMode !== "main-and-libs") {
    relinka("verbose", "Skipping libs build as libsActMode is set to 'main-project-only'");
    return;
  }

  await libraries_build(
    isDev,
    timer,
    config.libsList,
    config.libsDirDist,
    config.libsDirSrc,
    config.commonPubRegistry,
    config.distNpmOutFilesExt,
    config.distNpmBuilder,
    config.coreEntrySrcDir,
    config.filterDepsPatterns,
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
    config,
  );
}

/**
 * Publishes libraries based on build mode.
 */
export async function library_pubFlow(
  timer: PerfTimer,
  isDev: boolean,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "— — — library_pubFlow — — —");

  if (config.libsActMode !== "libs-only" && config.libsActMode !== "main-and-libs") {
    relinka("verbose", "Skipping libs publish as libsActMode is set to 'main-project-only'");
    return;
  }

  await libraries_publish(
    isDev,
    timer,
    config.libsList,
    config.distJsrDryRun,
    config.distJsrFailOnWarn,
    config.libsDirDist,
    config.commonPubPause,
    config.commonPubRegistry,
    config.distJsrAllowDirty,
    config.distJsrSlowTypes,
  );
}

/**
 * Extracts the folder name for a library, handling scoped packages or config overrides.
 */
function extractFolderName(libName: string, libConfig?: LibConfig): string {
  // If user provided a custom directory name, use that
  if (libConfig?.libDirName) {
    return libConfig.libDirName;
  }

  // Otherwise, derive from libName
  const parts = libName.split("/");
  // If scoped (e.g., "@scope/package"), focus on the last chunk
  let baseName = parts[parts.length - 1];

  // If there's a dash, we split on the dash and use the last piece
  if (baseName?.includes("-")) {
    const dashParts = baseName.split("-");
    baseName = dashParts[dashParts.length - 1];
  }

  if (!baseName) {
    baseName = libName;
  }

  return baseName;
}

/**
 * Builds all libs defined in config.libsList.
 */
export async function libraries_build(
  isDev: boolean,
  timer: PerfTimer,
  libsList: Record<string, LibConfig>,
  libsDirDist: string,
  libsDirSrc: string,
  commonPubRegistry: "jsr" | "npm" | "npm-jsr",
  unifiedBundlerOutExt: NpmOutExt,
  distNpmBuilder: BundlerName,
  coreEntrySrcDir: string,
  filterDepsPatterns: {
    global: string[];
    "dist-npm": string[];
    "dist-jsr": string[];
    "dist-libs": Record<string, { npm: string[]; jsr: string[] }>;
  },
  transpileEsbuild: Esbuild,
  transpileTarget: TranspileTarget,
  transpileFormat: TranspileFormat,
  transpileSplitting: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  distJsrBuilder: BundlerName,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrOutFilesExt: NpmOutExt,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "Starting libraries_build");

  if (!libsList || Object.keys(libsList).length === 0) {
    relinka("verbose", "No lib configs found in config, skipping libs build.");
    return;
  }

  const libsEntries = Object.entries(libsList);

  // Create a set of build tasks and run them in parallel (concurrency limited)
  const tasks = libsEntries.map(([libName, libConfig]) => {
    return async () => {
      try {
        if (!libConfig.libMainFile) {
          throw new Error(`Library ${libName} is missing "libMainFile" property.`);
        }

        // Determine top-level folder name for dist output
        const folderName = extractFolderName(libName, libConfig);
        const libBaseDir = path.resolve(PROJECT_ROOT, libsDirDist, folderName);
        const npmOutDir = path.join(libBaseDir, "npm");
        const jsrOutDir = path.join(libBaseDir, "jsr");

        // Parse the mainFile path
        const libMainPath = path.parse(libConfig.libMainFile);
        const libMainFile = libMainPath.base;
        let libMainDir: string;

        // Check for various path styles
        if (libConfig.libMainFile.startsWith(libsDirSrc)) {
          // Case 1: Fully qualified path already includes libsDirSrc
          libMainDir = libMainPath.dir || ".";
        } else if (libMainPath.dir) {
          // Case 2: Has directory component, but does not start with libsDirSrc
          libMainDir = path.join(libsDirSrc, libMainPath.dir);
        } else {
          // Case 3: Just a filename, use folderName as fallback
          libMainDir = path.join(libsDirSrc, folderName);
        }

        relinka(
          "verbose",
          `Processing library ${libName}: libMainDir=${libMainDir}, libMainFile=${libMainFile}`,
        );

        const libTranspileMinify = (libConfig as any)?.libTranspileMinify === true;

        // Build library
        await library_buildLibrary({
          ...config,
          effectivePubRegistry: libConfig.libPubRegistry || commonPubRegistry,
          libName,
          mainDir: libMainDir,
          npm: {
            npmOutDir,
            distNpmBuilder,
            coreEntrySrcDir,
          },
          jsr: {
            jsrOutDir,
            distJsrBuilder,
            distJsrOutFilesExt,
          },
          libMainFile,
          isDev,
          libsList,
          unifiedBundlerOutExt,
          filterDepsPatterns,
          transpileEsbuild,
          transpileTarget,
          transpileFormat,
          transpileSplitting,
          libTranspileMinify,
          transpileSourcemap,
          transpilePublicPath,
          timer,
          transpileStub,
          transpileWatch,
        });
      } catch (error) {
        relinka(
          "error",
          `Failed to build library ${libName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    };
  });

  try {
    await pAll(tasks, {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka("verbose", "Completed libraries_build");
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    throw error;
  }
}

/**
 * Publishes all libs defined in config.libsList.
 */
export async function libraries_publish(
  isDev: boolean,
  timer: PerfTimer,
  libsList: Record<string, LibConfig>,
  distJsrDryRun: boolean,
  distJsrFailOnWarn: boolean,
  libsDirDist: string,
  commonPubPause: boolean,
  commonPubRegistry: "jsr" | "npm" | "npm-jsr",
  distJsrAllowDirty: boolean,
  distJsrSlowTypes: boolean,
): Promise<void> {
  relinka("verbose", "Starting libraries_publish");

  if (!libsList || Object.keys(libsList).length === 0) {
    relinka("verbose", "No lib configs found in config, skipping libs publish.");
    return;
  }

  const libsEntries = Object.entries(libsList);

  // Create a set of publish tasks and run them in parallel (concurrency limited)
  const tasks = libsEntries.map(([libName, libConfig]) => {
    return async () => {
      try {
        // Determine top-level folder name for dist output
        const folderName = extractFolderName(libName, libConfig);
        const libBaseDir = path.resolve(PROJECT_ROOT, libsDirDist, folderName);
        const npmOutDir = path.join(libBaseDir, "npm");
        const jsrOutDir = path.join(libBaseDir, "jsr");

        // Publish if not paused
        if (!commonPubPause && !libConfig.libPubPause) {
          const effectivePubRegistry =
            libConfig.libPubRegistry || (commonPubRegistry as "jsr" | "npm" | "npm-jsr");
          await library_publishLibrary(
            effectivePubRegistry,
            libName,
            npmOutDir,
            jsrOutDir,
            distJsrDryRun,
            distJsrFailOnWarn,
            distJsrAllowDirty,
            distJsrSlowTypes,
            isDev,
            timer,
          );
        } else if (libConfig.libPubPause && !commonPubPause) {
          relinka("verbose", `Publishing is paused for lib ${libName} (libPubPause: true)`);
        }
      } catch (error) {
        relinka(
          "error",
          `Failed to publish library ${libName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    };
  });

  try {
    await pAll(tasks, {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka("verbose", "Completed libraries_publish");
  } catch (error) {
    if (timer) resumePerfTimer(timer);
    throw error;
  }
}
