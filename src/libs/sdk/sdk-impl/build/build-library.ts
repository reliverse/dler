import type { CopyOptions } from "fs-extra";

import { relinka } from "@reliverse/relinka";
import { build as bunBuild, type BuildConfig } from "bun";
import fs from "fs-extra";
import MagicString from "magic-string";
import pAll from "p-all";
import path from "pathe";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";

import type { UnifiedBuildConfig } from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";
import type {
  BundlerName,
  Esbuild,
  ExcludeMode,
  LibConfig,
  NpmOutExt,
  Sourcemap,
  transpileFormat,
  transpileTarget,
} from "~/libs/sdk/sdk-types.js";

import { unifiedBuild } from "~/libs/sdk/sdk-impl/build/bundlers/unified/build.js";
import { ensuredir } from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils.js";
import {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
  renameEntryFile,
} from "~/libs/sdk/sdk-impl/utils/utils-build.js";
import {
  CONCURRENCY_DEFAULT,
  PROJECT_ROOT,
  validExtensions,
} from "~/libs/sdk/sdk-impl/utils/utils-consts.js";
import { determineDistName } from "~/libs/sdk/sdk-impl/utils/utils-determine.js";
import {
  copyRootFile,
  deleteSpecificFiles,
  getDirectorySize,
  outDirBinFilesCount,
} from "~/libs/sdk/sdk-impl/utils/utils-fs.js";
import {
  createJsrJSON,
  renameTsxFiles,
} from "~/libs/sdk/sdk-impl/utils/utils-jsr-json.js";
import {
  convertImportExtensionsJsToTs,
  convertImportPaths,
} from "~/libs/sdk/sdk-impl/utils/utils-paths.js";
import {
  getElapsedPerfTime,
  type PerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";
import { library_createPackageJSON } from "~/libs/sdk/sdk-impl/utils/utils-pkg-json-libs.js";

// ============================================================================
// Constants
// ============================================================================

const BIN_DIR_NAME = "bin"; // Directory name for bundled output within dist
const REPLACEMENT_MARKER = "// dler-replace-me"; // Marker for source replacement
const FILES_TO_COPY_ROOT = ["README.md", "LICENSE"]; // Common files to copy to dist
const TYPES_REPLACEMENT_PATH = "src/types.ts"; // Relative path to types file used for replacement
const ALIAS_PREFIX_TO_CONVERT = "~/"; // Alias prefix used in internal imports

// ============================================================================
// Type Definitions
// ============================================================================

/** Describes a file whose content was temporarily replaced during pre-build */
type ReplacementRecord = {
  filePath: string;
  newContent: string; // Stored for debugging/verification
  originalContent: string;
};

/** Configuration for the source file replacement process */
type SourceReplacementConfig = {
  librarySrcDir: string; // Directory to scan for replacements
  replacementFilePath: string; // Path to the file providing replacement content
  replacementMarker: string; // Comment marker indicating replacement line
};

/** Options common to both NPM and JSR build targets */
type BaseLibBuildOptions = {
  libName: string;
  mainDir: string; // Source directory (e.g., "src") - Used mainly for pre-build replacements
  libMainFile: string; // Relative path of the main entry file within its source dir
  isDev: boolean;
  libsList: Record<string, LibConfig>;
  rmDepsMode: ExcludeMode;
  rmDepsPatterns: string[];
  timer: PerfTimer;
};

/** Options specific to the transpilation/bundling process */
type TranspileOptions = {
  transpileTarget: transpileTarget;
  transpileFormat: transpileFormat;
  transpileSplitting: boolean;
  libTranspileMinify: boolean;
  transpileSourcemap: Sourcemap;
  transpilePublicPath: string;
  transpileEsbuild: Esbuild;
  transpileStub: boolean;
  transpileWatch: boolean; // Potentially used by bundlers
  unifiedBundlerOutExt: NpmOutExt; // Output extension for bun/unified builders
};

/** Options specific to the NPM build target */
type NpmBuildOptions = {
  npmOutDir: string; // Output directory for NPM build (relative to project root)
  distNpmBuilder: BundlerName;
  coreEntrySrcDir: string; // Base source directory containing libs (e.g., "src")
};

/** Options specific to the JSR build target */
type JsrBuildOptions = {
  jsrOutDir: string; // Output directory for JSR build (relative to project root)
  distJsrBuilder: BundlerName;
  distJsrOutFilesExt: NpmOutExt; // Specific output extension for JSR files
};

/** Consolidated options for the main library build function */
export type LibraryBuildOptions = {
  commonPubRegistry: "npm" | "jsr" | "npm-jsr" | string | undefined; // Explicit options + string for flexibility
  npm?: NpmBuildOptions;
  jsr?: JsrBuildOptions;
} & BaseLibBuildOptions &
  TranspileOptions;

/** Parameters for the unified `library_buildDistributionTarget` function */
type BuildTargetParams = {
  targetType: "npm" | "jsr";
  builder: BundlerName;
  libSourceDir: string; // The specific source directory for this library
  entryFilePath: string; // Absolute path to the entry file or directory
  outputDirRoot: string; // Absolute path to the root output dir for this target (e.g., dist/npm/lib-a)
  outputDirBin: string; // Absolute path to the 'bin' subdir within outputDirRoot
  libDeclarations: boolean;
  distJsrOutFilesExt: NpmOutExt; // Needed for common steps & JSR specifics
  options: LibraryBuildOptions;
  libDirName?: string; // Optional specific directory name of the lib (e.g., my-lib)
};

/** Parameters required by the individual bundler executor functions (Bun, Unified, JSR Copy) */
type BundleExecutorParams = {
  entryPoint: string; // Absolute path to entry file OR directory (for 'jsr' copy)
  outDir: string; // Absolute path to output directory (usually the 'bin' subdir)
  libName: string; // For logging context
  timer: PerfTimer;
  // Transpilation/bundler options relevant to the specific executor
  libDeclarations: boolean; // Primarily for unified
  libTranspileMinify: boolean;
  transpileTarget: transpileTarget;
  transpileFormat: transpileFormat;
  transpileSplitting: boolean;
  transpileSourcemap: Sourcemap;
  transpilePublicPath: string;
  transpileEsbuild: Esbuild; // For unified
  transpileStub: boolean; // For unified
  transpileWatch: boolean; // For unified (or potentially others)
  unifiedBundlerOutExt: NpmOutExt; // For bun/unified
};

/** Parameters for the central bundler dispatcher function `library_bundleWithBuilder` */
type BundleRequestParams = {
  builder: BundlerName; // The specific builder to use
} & BundleExecutorParams;

/** Parameters for common post-bundling steps */
type CommonStepsParams = {
  coreEntryFileName: string; // Original base name of the entry file (e.g., "index.ts")
  outDirRoot: string; // Absolute path to root output dir for the target
  outDirBin: string; // Absolute path to 'bin' subdirectory
  isJsr: boolean;
  libName: string;
  libsList: Record<string, LibConfig>;
  rmDepsMode: ExcludeMode;
  rmDepsPatterns: string[];
  unifiedBundlerOutExt: NpmOutExt; // Used for package.json generation and renaming
  distJsrOutFilesExt: NpmOutExt; // Used for renaming JSR entry file
  deleteFiles?: boolean; // Whether to delete specific files (usually true for JSR)
  libDirName?: string; // Optional specific directory name of the lib (e.g., my-lib)
};

// ============================================================================
// Main Orchestration
// ============================================================================

/**
 * Main entry point to build a library based on the provided options.
 * Manages pre-build source modifications, orchestrates target builds, and ensures post-build cleanup.
 * @param options - The consolidated build configuration.
 */
export async function library_buildLibrary(
  options: LibraryBuildOptions,
): Promise<void> {
  const { libName, mainDir } = options;
  let replacedFiles: ReplacementRecord[] = [];

  // Configure source replacement
  const replacementConfig: SourceReplacementConfig = {
    librarySrcDir: path.resolve(PROJECT_ROOT, mainDir),
    replacementFilePath: path.resolve(PROJECT_ROOT, TYPES_REPLACEMENT_PATH),
    replacementMarker: REPLACEMENT_MARKER,
  };

  try {
    // --- Pre-build Step: Modify source files ---
    relinka("log", `Running pre-build replacements for ${libName}...`);
    replacedFiles = await preBuildReplacements(replacementConfig);
    relinka("verbose", `Pre-build: ${replacedFiles.length} files modified.`);

    // --- Core Build Step: Execute NPM/JSR builds ---
    await executeBuildTasks(options);
  } catch (err) {
    // --- Error Handling ---
    const error = err instanceof Error ? err : new Error(String(err));
    relinka(
      "error",
      `Build process for ${libName} failed: ${error.message}`,
      error.stack,
    );
    // Re-throw to halt the overall process if this is part of a larger sequence
    throw error;
  } finally {
    // --- Post-build Step: Revert source file modifications ---
    if (replacedFiles.length > 0) {
      relinka(
        "verbose",
        `Reverting ${replacedFiles.length} pre-build changes for ${libName}...`,
      );
      try {
        await postBuildReplacements(replacedFiles);
        relinka("verbose", `Done reverting changes for ${libName}.`);
      } catch (revertError) {
        const error =
          revertError instanceof Error
            ? revertError
            : new Error(String(revertError));
        relinka(
          "error",
          `CRITICAL: Failed to revert pre-build changes for ${libName}: ${error.message}. Source files may be left modified!`,
          error.stack,
        );
        // throw new Error(`Revert failed for ${libName}: ${error.message}`);
      }
    } else {
      relinka("verbose", `No pre-build changes to revert for ${libName}.`);
    }
  }
}

/**
 * Determines which build targets (NPM, JSR) are needed and executes them, potentially concurrently.
 * @param options - The consolidated build configuration.
 */
async function executeBuildTasks(options: LibraryBuildOptions): Promise<void> {
  const { commonPubRegistry, libName } = options;
  const buildTasks: (() => Promise<void>)[] = [];

  // Queue JSR build task if requested
  if (commonPubRegistry === "jsr" || commonPubRegistry === "npm-jsr") {
    if (!options.jsr) {
      // This check ensures options.jsr exists before queueing the task
      throw new Error(
        `JSR build requested for ${libName} but 'options.jsr' is missing.`,
      );
    }
    relinka("log", `Queueing JSR build for lib ${libName}...`);
    buildTasks.push(() => library_buildJsrDist(options));
  }

  // Queue NPM build task if requested
  if (commonPubRegistry === "npm" || commonPubRegistry === "npm-jsr") {
    if (!options.npm) {
      // This check ensures options.npm exists before queueing the task
      throw new Error(
        `NPM build requested for ${libName} but 'options.npm' is missing.`,
      );
    }
    relinka("log", `Queueing NPM build for lib ${libName}...`);
    buildTasks.push(() => library_buildNpmDist(options));
  }

  // Execute tasks
  if (buildTasks.length === 0) {
    relinka(
      "warn",
      `No valid build targets specified by 'commonPubRegistry' ("${commonPubRegistry}") for lib ${libName}. Skipping build.`,
    );
    return;
  }

  if (buildTasks.length > 1) {
    relinka("log", `Building lib ${libName} for NPM and JSR concurrently...`);
    await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
  } else {
    relinka(
      "log",
      `Building lib ${libName} for ${options.commonPubRegistry || "single target"}...`,
    );
    // Execute the single task - Added check for safety although length is 1
    const task = buildTasks[0];
    if (task) {
      await task();
    }
  }
}

// ============================================================================
// Target-Specific Build Entry Points (NPM & JSR)
// ============================================================================

/**
 * Prepares configuration and initiates the build process for the JSR target.
 * @param options - The consolidated build configuration.
 */
async function library_buildJsrDist(
  options: LibraryBuildOptions,
): Promise<void> {
  const { libName, libMainFile, libsList } = options;

  // Check for JSR options internally, removing need for non-null assertion
  if (!options.jsr) {
    throw new Error(
      `Internal Error: library_buildJsrDist called for ${libName} but options.jsr is missing.`,
    );
  }
  const jsrOptions = options.jsr;
  const { jsrOutDir, distJsrBuilder, distJsrOutFilesExt } = jsrOptions;

  const targetType = "jsr";
  relinka("log", `[JSR] Initializing JSR build for ${libName}...`);

  // Resolve paths
  const libSourceDirResolved = path.resolve(PROJECT_ROOT, options.mainDir);
  const entryFilePathResolved = path.resolve(libSourceDirResolved, libMainFile);
  const outputDirRootResolved = path.resolve(PROJECT_ROOT, jsrOutDir);
  const outputDirBinResolved = path.resolve(
    outputDirRootResolved,
    BIN_DIR_NAME,
  );

  // Ensure output directories exist
  await fs.ensureDir(outputDirRootResolved);
  await fs.ensureDir(outputDirBinResolved);

  // Determine bundler entry point: directory for 'jsr' copy, file for others
  const bundlerEntryPoint =
    distJsrBuilder === "jsr" ? libSourceDirResolved : entryFilePathResolved;

  const libConfig = libsList[libName];
  const libDeclarations = libConfig?.libDeclarations ?? false;

  // Determine libDirName for JSR from config.
  const actualLibDirName = libConfig?.libDirName;
  if (!actualLibDirName) {
    relinka(
      "warn",
      `[JSR:${libName}] libDirName not found in libConfig. Path stripping in common steps might be affected.`,
    );
  }

  // Prepare parameters for the core build function
  const buildParams: BuildTargetParams = {
    targetType,
    builder: distJsrBuilder,
    libSourceDir: libSourceDirResolved, // e.g., /abs/path/to/project/src/libs/sdk
    entryFilePath: bundlerEntryPoint,
    outputDirRoot: outputDirRootResolved,
    outputDirBin: outputDirBinResolved,
    libDeclarations,
    distJsrOutFilesExt,
    options,
    libDirName: actualLibDirName,
  };

  await library_buildDistributionTarget(buildParams);

  // --- JSR Specific Post-Build Steps ---
  relinka(
    "verbose",
    `[JSR] Performing JSR-specific transformations in ${outputDirBinResolved}`,
  );
  await convertImportExtensionsJsToTs({ dirPath: outputDirBinResolved });
  await renameTsxFiles(outputDirBinResolved);
  await createJsrJSON(
    outputDirRootResolved,
    true,
    libName,
    libConfig?.libDescription ?? "",
  );

  // Final logging
  const dirSize = await getDirectorySize(outputDirRootResolved, options.isDev);
  const filesCount = await outDirBinFilesCount(outputDirBinResolved);
  relinka(
    "success",
    `[JSR] JSR distribution for ${libName} built successfully (${filesCount} files, ${prettyBytes(dirSize)}) -> ${outputDirRootResolved}`,
  );
}

/**
 * Prepares configuration and initiates the build process for the NPM target.
 * @param options - The consolidated build configuration.
 */
async function library_buildNpmDist(
  options: LibraryBuildOptions,
): Promise<void> {
  const { libName, libMainFile, libsList } = options;

  // Check for NPM options internally, removing need for non-null assertion
  if (!options.npm) {
    throw new Error(
      `Internal Error: library_buildNpmDist called for ${libName} but options.npm is missing.`,
    );
  }
  const npmOptions = options.npm;
  const { npmOutDir, distNpmBuilder, coreEntrySrcDir } = npmOptions;

  // JSR extension might be needed for common steps (renaming consistency), default if JSR not built
  const distJsrOutFilesExt = options.jsr?.distJsrOutFilesExt || "ts";

  const targetType = "npm";
  const distName = determineDistName(npmOutDir, false, libsList); // For logging
  relinka("log", `[NPM:${distName}] Initializing NPM build for ${libName}...`);

  // Ensure output directories exist
  const outputDirRootResolved = path.resolve(PROJECT_ROOT, npmOutDir);
  const outputDirBinResolved = path.resolve(
    outputDirRootResolved,
    BIN_DIR_NAME,
  );
  await fs.ensureDir(outputDirRootResolved);
  await fs.ensureDir(outputDirBinResolved);

  // Determine the specific source directory for *this* library within the core source dir
  const { libSpecificSrcDir, libDirName } = await determineNpmSourceDirectory(
    libName,
    libMainFile,
    path.resolve(PROJECT_ROOT, coreEntrySrcDir),
    libsList,
    distName,
  );
  const entryFilePathResolved = path.resolve(
    libSpecificSrcDir,
    path.basename(libMainFile),
  );

  // Validate entry file existence
  if (!(await fs.pathExists(entryFilePathResolved))) {
    const relativeEntryPath = path.relative(
      PROJECT_ROOT,
      entryFilePathResolved,
    );
    const relativeSrcDir = path.relative(PROJECT_ROOT, libSpecificSrcDir);
    throw new Error(
      `[NPM:${distName}] Library entry file not found: ${relativeEntryPath} (expected in: ${relativeSrcDir})`,
    );
  }
  relinka(
    "verbose",
    `[NPM:${distName}] Using entry file: ${entryFilePathResolved}`,
  );

  const libConfig = libsList[libName];
  const libDeclarations = libConfig?.libDeclarations ?? false;

  // Prepare parameters for the core build function
  const buildParams: BuildTargetParams = {
    targetType,
    builder: distNpmBuilder,
    libSourceDir: libSpecificSrcDir,
    entryFilePath: entryFilePathResolved,
    outputDirRoot: outputDirRootResolved,
    outputDirBin: outputDirBinResolved,
    libDeclarations,
    distJsrOutFilesExt,
    options,
    libDirName,
  };

  await library_buildDistributionTarget(buildParams);

  // --- NPM Specific Post-Build Steps ---
  // (None currently defined)

  // Final logging
  const dirSize = await getDirectorySize(outputDirRootResolved, options.isDev);
  const filesCount = await outDirBinFilesCount(outputDirBinResolved);
  relinka(
    "success",
    `[NPM:${distName}] NPM distribution for ${libName} built successfully (${filesCount} files, ${prettyBytes(dirSize)}) -> ${outputDirRootResolved}`,
  );
}

// ============================================================================
// Core Build Logic for a Single Target (NPM or JSR)
// ============================================================================

/**
 * Executes the main build steps for a single distribution target (NPM or JSR).
 * Handles directory setup, bundling, and common post-build tasks.
 * @param params - Parameters specific to the build target. Includes optional libDirName.
 */
async function library_buildDistributionTarget(
  params: BuildTargetParams,
): Promise<void> {
  const {
    targetType,
    builder,
    entryFilePath, // Entry for bundler (file path or dir path for 'jsr' copy)
    outputDirRoot,
    outputDirBin,
    libDeclarations,
    distJsrOutFilesExt,
    options,
    libDirName,
  } = params;
  const {
    libName,
    timer,
    libMainFile,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    // Transpile/Bundle Options from `options`
    libTranspileMinify,
    transpileTarget,
    transpileFormat,
    transpileSplitting,
    transpileSourcemap,
    transpilePublicPath,
    transpileEsbuild,
    transpileStub,
    transpileWatch,
    unifiedBundlerOutExt,
  } = options;

  const isJsr = targetType === "jsr";
  const logPrefix = isJsr
    ? "[JSR]"
    : `[NPM:${determineDistName(path.relative(PROJECT_ROOT, outputDirRoot), false, libsList)}]`;

  relinka("log", `${logPrefix} Starting build target processing...`);

  // Ensure output directories exist
  await ensuredir(outputDirRoot);
  await ensuredir(outputDirBin);
  relinka("log", `${logPrefix} Using builder: ${builder}`);

  // --- Bundling Step ---
  // Use BundleRequestParams type for the object passed to the dispatcher
  const bundleRequest: BundleRequestParams = {
    builder,
    entryPoint: entryFilePath,
    outDir: outputDirBin,
    libName,
    timer,
    libDeclarations,
    libTranspileMinify,
    transpileTarget,
    transpileFormat,
    transpileSplitting,
    transpileSourcemap,
    transpilePublicPath,
    transpileEsbuild,
    transpileStub,
    transpileWatch,
    unifiedBundlerOutExt,
  };
  await library_bundleWithBuilder(bundleRequest);

  // --- Common Post-Bundling Steps ---
  const commonStepsParams: CommonStepsParams = {
    coreEntryFileName: path.basename(libMainFile),
    outDirRoot: outputDirRoot,
    outDirBin: outputDirBin,
    isJsr,
    libName,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
    deleteFiles: isJsr,
    libDirName,
  };
  await library_performCommonBuildSteps(commonStepsParams);

  relinka("log", `${logPrefix} Completed build target processing.`);
}

// ============================================================================
// Bundler Dispatcher & Implementations
// ============================================================================

/**
 * Centralized helper to dispatch to the correct bundler function based on builder name.
 * @param params - Parameters required for bundling execution, including the builder name.
 */
async function library_bundleWithBuilder(
  params: BundleRequestParams,
): Promise<void> {
  // Destructure builder separately, pass the rest matching BundleExecutorParams
  const { builder, ...executorParams } = params;
  const { entryPoint, outDir, libName } = executorParams; // Get some details for logging

  relinka(
    "verbose",
    `[${libName}] Bundling using '${builder}' builder... Entry: ${entryPoint}, Out: ${outDir}`,
  );

  switch (builder) {
    case "jsr":
      // JSR uses a simple copy mechanism

      await library_bundleUsingJsrCopy(entryPoint, outDir, libName);
      break;
    case "bun":
      // Bundling with Bun

      await library_bundleUsingBun(entryPoint, outDir, libName, {
        timer: executorParams.timer,
        libTranspileMinify: executorParams.libTranspileMinify,
        transpileTarget: executorParams.transpileTarget,
        transpileFormat: executorParams.transpileFormat,
        transpileSplitting: executorParams.transpileSplitting,
        transpileSourcemap: executorParams.transpileSourcemap,
        transpilePublicPath: executorParams.transpilePublicPath,
      });
      break;
    case "rollup":
    case "mkdist":
      // Use one of the "unified" bundlers

      await library_bundleUsingUnified(
        entryPoint,
        outDir,
        builder,
        path.dirname(entryPoint), // Source directory context
        {
          timer: executorParams.timer,
          libDeclarations: executorParams.libDeclarations,
          libTranspileMinify: executorParams.libTranspileMinify,
          transpileSourcemap: executorParams.transpileSourcemap,
          transpileEsbuild: executorParams.transpileEsbuild,
          transpileStub: executorParams.transpileStub,
          unifiedBundlerOutExt: executorParams.unifiedBundlerOutExt,
        },
      );
      break;
    default:
      // Optional: Exhaustive check for type safety
      // const _exhaustiveCheck: never = builder;
      throw new Error(`Unsupported library builder specified: ${builder}`);
  }
  relinka("verbose", `[${libName}] Bundling finished using '${builder}'.`);
}

/** Bundles (copies) a library project using the 'jsr' (directory copy) strategy. */
async function library_bundleUsingJsrCopy(
  srcDir: string, // Expecting a source directory path
  destDir: string, // Expecting a destination directory path
  libName: string,
): Promise<void> {
  relinka(
    "verbose",
    `[JSR Copy:${libName}] Starting copy: ${srcDir} -> ${destDir}`,
  );
  await ensuredir(destDir);

  try {
    // Copy directory contents - recursive is implied for dir copy in fs-extra
    const copyOptions: CopyOptions = { overwrite: true };
    await fs.copy(srcDir, destDir, copyOptions);
    relinka(
      "success",
      `[JSR Copy:${libName}] Completed copying library source from ${srcDir} to ${destDir}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `[JSR Copy:${libName}] Failed to copy library source from ${srcDir} to ${destDir}: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new Error(`[JSR Copy:${libName}] Failed: ${errorMessage}`);
  }
}

/** Bundles using Bun. */
async function library_bundleUsingBun(
  entryPoint: string, // Expecting a file path
  outDirBin: string,
  libName: string,
  // Select only options relevant to Bun
  options: Pick<
    BundleExecutorParams,
    | "timer"
    | "libTranspileMinify"
    | "transpileTarget"
    | "transpileFormat"
    | "transpileSplitting"
    | "transpileSourcemap"
    | "transpilePublicPath"
  >,
): Promise<void> {
  const {
    timer,
    libTranspileMinify,
    transpileTarget,
    transpileFormat,
    transpileSplitting,
    transpileSourcemap,
    transpilePublicPath,
  } = options;

  relinka("verbose", `[Bun:${libName}] Starting Bun build...`);

  // Input validation
  if (!(await fs.pathExists(entryPoint))) {
    throw new Error(
      `[Bun:${libName}] Library entry file not found: ${entryPoint}`,
    );
  }
  if (!(await fs.stat(entryPoint)).isFile()) {
    throw new Error(
      `[Bun:${libName}] Entry point must be a file for Bun bundler: ${entryPoint}`,
    );
  }

  try {
    const buildConfig: BuildConfig = {
      entrypoints: [entryPoint],
      outdir: outDirBin,
      target: transpileTarget,
      format: transpileFormat,
      splitting: transpileSplitting,
      minify: libTranspileMinify,
      sourcemap: getBunSourcemapOption(transpileSourcemap),
      publicPath: transpilePublicPath,
      naming: {
        entry: "[dir]/[name].[ext]",
        chunk: "[name]-[hash].[ext]",
        asset: "[name]-[hash].[ext]",
      },
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
      plugins: [],
      loader: {},
      banner: `/* ${libName} - Bundled by @reliverse/dler (Bun) */`,
      throw: true, // Ensure build errors are thrown
    };

    const buildResult = await bunBuild(buildConfig);
    const duration = getElapsedPerfTime(timer);

    if (buildResult.success) {
      relinka(
        "success",
        `[Bun:${libName}] Library build completed in ${prettyMilliseconds(duration)} (${buildResult.outputs.length} outputs).`,
      );
      if (buildResult.logs?.length > 0) {
        for (const log of buildResult.logs) {
          relinka("verbose", `[Bun Log:${log.level}] ${log.message}`);
        }
      }
    } else {
      relinka(
        "error",
        `[Bun:${libName}] Library build failed after ${prettyMilliseconds(duration)}.`,
      );
      if (buildResult.logs?.length > 0) {
        for (const log of buildResult.logs) {
          relinka("error", `[Bun Log:${log.level}] ${log.message}`);
        }
      }
      throw new Error(
        `[Bun:${libName}] Build process reported failure. Check logs.`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `[Bun:${libName}] Library build threw an error: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new Error(`[Bun:${libName}] Bundle failed: ${errorMessage}`);
  }
}

/** Builds using a unified builder (e.g., rollup, mkdist via unjs/unbuild). */
async function library_bundleUsingUnified(
  entryPoint: string, // File path (rollup) or directory path (mkdist)
  outDirBin: string,
  builder: Extract<BundlerName, "rollup" | "mkdist">, // Specific unified builder
  sourceDirContext: string, // Directory containing the entryPoint, relative to project root
  // Select only options relevant to Unified/Unbuild
  options: Pick<
    BundleExecutorParams,
    | "timer"
    | "libDeclarations"
    | "libTranspileMinify"
    | "transpileSourcemap"
    | "transpileEsbuild"
    | "transpileStub"
    | "unifiedBundlerOutExt"
  >,
): Promise<void> {
  const {
    timer,
    libDeclarations,
    libTranspileMinify,
    transpileSourcemap,
    transpileEsbuild,
    transpileStub,
    unifiedBundlerOutExt,
  } = options;

  relinka("verbose", `[Unified:${builder}] Starting ${builder} build...`);

  const rootDir = PROJECT_ROOT;

  let validatedExt = unifiedBundlerOutExt;
  if (!validExtensions.includes(validatedExt)) {
    relinka(
      "warn",
      `[Unified:${builder}] Invalid output extension '${validatedExt}', defaulting to 'js'.`,
    );
    validatedExt = "js";
  }

  const inputRelative = path.relative(rootDir, entryPoint);
  const outDirRelative = path.relative(rootDir, outDirBin);

  const unifiedBuildConfig: UnifiedBuildConfig = {
    clean: false,
    declaration: libDeclarations ? "compatible" : false,
    entries: [
      {
        builder: builder,
        input: inputRelative,
        outDir: outDirRelative,
        ext: validatedExt,
        isLib: true,
      },
    ],
    rollup: {
      emitCJS: false,
      esbuild: {
        minify: libTranspileMinify,
        target: transpileEsbuild,
      },
      inlineDependencies: true,
      output: {
        sourcemap: getUnifiedSourcemapOption(transpileSourcemap),
      },
    },
    hooks: {},
    stub: transpileStub,
  };

  try {
    await unifiedBuild(true, rootDir, unifiedBuildConfig, outDirBin);

    const duration = getElapsedPerfTime(timer);
    relinka(
      "success",
      `[Unified:${builder}] Library build completed in ${prettyMilliseconds(duration)}.`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `[Unified:${builder}] Library build failed: ${errorMessage}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new Error(`[Unified:${builder}] Bundle failed: ${errorMessage}`);
  }
}

// ============================================================================
// Common Post-Build Steps & File Utilities
// ============================================================================

/**
 * Performs common library build steps shared between JSR and NPM distributions.
 * (Creates package.json, copies root files, converts paths, renames entry file, deletes files).
 * @param params - Parameters for the common steps.
 */
async function library_performCommonBuildSteps(
  params: CommonStepsParams,
): Promise<void> {
  const {
    coreEntryFileName,
    outDirRoot,
    outDirBin,
    isJsr,
    libName,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
    deleteFiles = false,
    libDirName,
  } = params;

  const targetType = isJsr ? "JSR" : "NPM";
  const logPrefix = `[Common:${targetType}:${libName}]`;

  relinka("verbose", `${logPrefix} Performing common steps in ${outDirRoot}`);

  // 1. Create package.json
  await library_createPackageJSON(
    libName,
    outDirRoot,
    isJsr,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
  );
  relinka("verbose", `${logPrefix} Created package.json.`);

  // 2. Delete specific intermediate/unwanted files if requested
  if (deleteFiles) {
    await deleteSpecificFiles(outDirBin);
    relinka(
      "verbose",
      `${logPrefix} Deleted specific files from ${outDirBin}.`,
    );
  }

  // 3. Copy root-level files
  await copyRootFile(outDirRoot, FILES_TO_COPY_ROOT);
  relinka(
    "verbose",
    `${logPrefix} Copied root files (${FILES_TO_COPY_ROOT.join(", ")}) to ${outDirRoot}`,
  );

  // 4. Convert internal alias imports
  const stripSegments = libDirName ? [`libs/${libDirName}`] : [];
  relinka(
    "verbose",
    `${logPrefix} Converting alias paths in ${outDirBin}, stripping: [${stripSegments.join(", ")}]`,
  );

  // Convert any "~/..." alias imports to relative
  relinka("log", `Performing alias path conversion in ${outDirBin}`);
  await convertImportPaths({
    aliasPrefix: ALIAS_PREFIX_TO_CONVERT,
    baseDir: outDirBin,
    fromType: "alias",
    toType: "relative",
    libsList,
    strip: stripSegments,
  });

  // 5. Rename the main entry file
  relinka("verbose", `${logPrefix} Renaming entry file in ${outDirBin}.`);
  await renameEntryFile(
    isJsr,
    outDirBin,
    coreEntryFileName,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
  );

  relinka("verbose", `${logPrefix} Completed common build steps.`);
}

/**
 * Determines the specific source directory for an NPM library.
 * @returns An object containing the resolved `libSpecificSrcDir` and `libDirName` (if found).
 */
async function determineNpmSourceDirectory(
  libName: string,
  mainFile: string, // Base name of the main file
  coreEntrySrcDirResolved: string, // Absolute path to the base dir containing libs
  libsList: Record<string, LibConfig>,
  distName: string, // For logging context
): Promise<{ libSpecificSrcDir: string; libDirName: string | undefined }> {
  const logPrefix = `[NPM:${distName}:${libName}]`;
  const libConfig = libsList?.[libName];
  let libSpecificSrcDir = coreEntrySrcDirResolved; // Default
  let libDirName: string | undefined;

  if (libConfig?.libMainFile) {
    // Option 1: Use explicit libDirName if provided
    if (libConfig.libDirName) {
      const potentialLibDirName = libConfig.libDirName;
      const potentialPath = path.join(
        coreEntrySrcDirResolved,
        "libs",
        potentialLibDirName,
      );
      if (await fs.pathExists(potentialPath)) {
        libSpecificSrcDir = potentialPath;
        libDirName = potentialLibDirName; // Assign only if path exists
        relinka(
          "verbose",
          `${logPrefix} Using explicit libDirName '${libDirName}' to set source dir: ${libSpecificSrcDir}`,
        );
      } else {
        relinka(
          "warn",
          `${logPrefix} Explicit libDirName '${potentialLibDirName}' provided, but path not found: ${potentialPath}. Falling back.`,
        );
        libDirName = undefined; // Clear libDirName
      }
    } else {
      // Option 2: Infer directory from libMainFile path
      const baseLibsDir = path.join(PROJECT_ROOT, "src", "libs");
      try {
        const absoluteLibMainFile = path.resolve(
          PROJECT_ROOT,
          libConfig.libMainFile,
        );
        if (absoluteLibMainFile.startsWith(baseLibsDir + path.sep)) {
          const mainFilePathRelative = path.relative(
            baseLibsDir,
            absoluteLibMainFile,
          );
          const pathSegments = mainFilePathRelative.split(path.sep);
          if (pathSegments.length > 1) {
            const inferredDirName = pathSegments[0];
            const potentialPath = inferredDirName
              ? path.join(baseLibsDir, inferredDirName)
              : baseLibsDir;
            // Check existence before assigning
            if (await fs.pathExists(potentialPath)) {
              libDirName = inferredDirName;
              libSpecificSrcDir = potentialPath;
              relinka(
                "verbose",
                `${logPrefix} Inferred libDirName '${libDirName}' from libMainFile. Source dir: ${libSpecificSrcDir}`,
              );
            } else {
              relinka(
                "verbose",
                `${logPrefix} Inferred directory '${inferredDirName}' from libMainFile does not exist. Falling back.`,
              );
              libDirName = undefined;
            }
          } else {
            relinka(
              "verbose",
              `${logPrefix} libMainFile '${libConfig.libMainFile}' is directly in base libs dir? No specific subdir inferred.`,
            );
          }
        } else {
          relinka(
            "verbose",
            `${logPrefix} libMainFile '${libConfig.libMainFile}' is outside the expected '${baseLibsDir}' structure.`,
          );
        }
      } catch (pathError) {
        relinka(
          "warn",
          `${logPrefix} Could not reliably determine relative path for ${libConfig.libMainFile}. Falling back. Error: ${pathError instanceof Error ? pathError.message : String(pathError)}`,
        );
      }
    }
  } else {
    relinka(
      "verbose",
      `${logPrefix} No libMainFile configured. Using core source directory: ${coreEntrySrcDirResolved}`,
    );
  }

  // Final check: ensure the determined directory exists before returning
  // This check might be redundant due to checks within the logic above, but adds safety.
  if (!(await fs.pathExists(libSpecificSrcDir))) {
    relinka(
      "warn",
      `${logPrefix} Determined source directory does not exist: ${libSpecificSrcDir}. Falling back to core source dir: ${coreEntrySrcDirResolved}`,
    );
    libSpecificSrcDir = coreEntrySrcDirResolved; // Fallback
    libDirName = undefined; // Clear name if path doesn't exist
  }

  relinka(
    "verbose",
    `${logPrefix} Final determined library source directory: ${libSpecificSrcDir}`,
  );

  return { libSpecificSrcDir, libDirName };
}

// ============================================================================
// Source File Modification Utilities (Pre/Post Build)
// ============================================================================

/**
 * Scans source files for a specific marker comment and replaces matching lines
 * with the content of a designated file.
 *
 * @example `export * from "../../types.js"; // dler-replace-me`
 * @example `export type { SpecificTypeName1, SpecificTypeName2 } from "../../types.js"; // dler-replace-me`
 *
 * @param config - Configuration for the replacement process.
 * @returns An array of records describing the replacements made.
 */
async function preBuildReplacements(
  config: SourceReplacementConfig,
): Promise<ReplacementRecord[]> {
  const { librarySrcDir, replacementFilePath, replacementMarker } = config;
  const replacedFiles: ReplacementRecord[] = [];

  // Validate inputs
  if (!(await fs.pathExists(replacementFilePath))) {
    relinka(
      "warn",
      `Replacement content file not found: ${replacementFilePath}. Skipping pre-build replacements.`,
    );
    return [];
  }
  if (!(await fs.pathExists(librarySrcDir))) {
    relinka(
      "warn",
      `Library source directory for replacement scan not found: ${librarySrcDir}. Skipping pre-build replacements.`,
    );
    return [];
  }

  relinka(
    "verbose",
    `Reading replacement content from: ${replacementFilePath}`,
  );
  const replacementContent = await fs.readFile(replacementFilePath, "utf-8");

  const allFiles: string[] = [];
  relinka("verbose", `Scanning for .ts/.tsx files in: ${librarySrcDir}`);
  await collectTsFilesRecursively(librarySrcDir, allFiles);
  relinka(
    "verbose",
    `Found ${allFiles.length} potential files for replacement scan.`,
  );

  const escapedMarker = replacementMarker.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  /**
   * Regular expression to match lines ending with the replacement marker.
   * The marker is expected to be at the end of the line, with optional trailing whitespace.
   * The `gm` flags ensure that the regex matches across multiple lines.
   * The `.*` prefix allows for any content before the marker.
   * The `^` anchor ensures that the match is at the start of a line.
   *
   * @example `export * from "../../types.js"; // dler-replace-me`
   * @example `export type { SpecificTypeName1, SpecificTypeName2 } from "../../types.js"; // dler-replace-me`
   */
  const regex = new RegExp(`^.*${escapedMarker}\\s*$`, "gm");

  for (const filePath of allFiles) {
    try {
      const originalCode = await fs.readFile(filePath, "utf-8");
      if (!originalCode.includes(replacementMarker)) {
        continue;
      }

      const magic = new MagicString(originalCode);
      let replacementOccurred = false;
      let match: RegExpExecArray | null;

      while (true) {
        match = regex.exec(originalCode);
        if (match === null) break;

        replacementOccurred = true;
        const lineContent = match[0];
        const matchStartIndex = match.index;
        const matchEndIndex = matchStartIndex + lineContent.length;

        let lineStartIndex = matchStartIndex;
        while (
          lineStartIndex > 0 &&
          originalCode[lineStartIndex - 1] !== "\n"
        ) {
          lineStartIndex--;
        }

        let lineEndIndex = matchEndIndex;
        while (
          lineEndIndex > lineStartIndex &&
          lineEndIndex - 1 < originalCode.length &&
          originalCode[lineEndIndex - 1] !== undefined &&
          originalCode[lineEndIndex - 1] !== null &&
          typeof originalCode[lineEndIndex - 1] === "string" &&
          /\s/.test(originalCode[lineEndIndex - 1] as string)
        ) {
          lineEndIndex--;
        }
        if (
          lineEndIndex < originalCode.length &&
          originalCode[lineEndIndex] === "\r"
        )
          lineEndIndex++;
        if (
          lineEndIndex < originalCode.length &&
          originalCode[lineEndIndex] === "\n"
        )
          lineEndIndex++;

        relinka(
          "verbose",
          `Replacing line in ${path.relative(PROJECT_ROOT, filePath)} (range ${lineStartIndex}-${lineEndIndex})`,
        );

        const contentToInsert = replacementContent.endsWith("\n")
          ? replacementContent
          : `${replacementContent}\n`;
        magic.overwrite(lineStartIndex, lineEndIndex, contentToInsert);
      }

      if (replacementOccurred) {
        const updatedCode = magic.toString();
        if (updatedCode !== originalCode) {
          replacedFiles.push({
            filePath,
            newContent: updatedCode,
            originalContent: originalCode,
          });
          await fs.writeFile(filePath, updatedCode, "utf-8");
          relinka(
            "info",
            `Applied pre-build replacement in ${path.relative(PROJECT_ROOT, filePath)}`,
          );
        } else {
          relinka(
            "verbose",
            `Replacement marker found but content identical after processing ${filePath}. Skipping write.`,
          );
        }
      }
    } catch (fileError) {
      relinka(
        "error",
        `Failed processing file for replacement ${filePath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
      );
    }
  }

  return replacedFiles;
}

/**
 * Reverts changes made by `preBuildReplacements` by writing the original content back.
 * @param replacedFiles - The records of files that were modified.
 */
async function postBuildReplacements(
  replacedFiles: ReplacementRecord[],
): Promise<void> {
  if (replacedFiles.length === 0) {
    return;
  }
  relinka(
    "verbose",
    `Reverting modifications in ${replacedFiles.length} files...`,
  );

  const revertTasks = replacedFiles.map((record) => async () => {
    try {
      await fs.writeFile(record.filePath, record.originalContent, "utf-8");
      relinka(
        "verbose",
        `Reverted changes in ${path.relative(PROJECT_ROOT, record.filePath)}`,
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      relinka(
        "error",
        `Failed to revert file ${record.filePath}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to revert ${record.filePath}`);
    }
  });

  try {
    await pAll(revertTasks, { concurrency: 1, stopOnError: false });
    relinka("verbose", "Attempted revert for all modified files.");
  } catch (aggregateError) {
    relinka(
      "error",
      "One or more files failed to revert during post-build cleanup. Check preceding error logs.",
      aggregateError instanceof Error ? aggregateError : undefined,
    );
    throw aggregateError;
  }
}

/**
 * Recursively finds all TypeScript (.ts, .tsx) files in a directory, avoiding common exclusion directories.
 * @param dir - The absolute directory path to scan.
 * @param fileList - An array accumulator for the found file paths.
 */
async function collectTsFilesRecursively(
  dir: string,
  fileList: string[],
): Promise<void> {
  try {
    if (!(await fs.pathExists(dir))) {
      relinka("warn", `Directory not found for scanning: ${dir}`);
      return;
    }
    if (!(await fs.stat(dir)).isDirectory()) {
      relinka("warn", `Path is not a directory, cannot scan: ${dir}`);
      return;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== "node_modules" &&
          !entry.name.startsWith("dist") &&
          entry.name !== ".git" &&
          entry.name !== ".svn" &&
          entry.name !== ".hg" &&
          entry.name !== ".turbo" &&
          entry.name !== ".next" &&
          entry.name !== ".nuxt"
        ) {
          await collectTsFilesRecursively(fullPath, fileList);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/i.test(entry.name)) {
        fileList.push(fullPath);
      }
    }
  } catch (error) {
    relinka(
      "error",
      `Failed to read directory during file collection: ${dir}`,
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}
