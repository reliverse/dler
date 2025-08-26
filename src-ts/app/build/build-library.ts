import path, {
  convertImportsAliasToRelative,
  convertImportsExt,
  stripPathSegmentsInDirectory,
} from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { type BuildConfig, build as bunBuild } from "bun";
import pAll from "p-all";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { unifiedBuild } from "~/app/build/providers/build";
import { CONCURRENCY_DEFAULT, PROJECT_ROOT, validExtensions } from "~/app/config/constants";
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
import type { PerfTimer, UnifiedBuildConfig } from "~/app/types/mod";
import { getBunSourcemapOption, getUnifiedSourcemapOption } from "~/app/utils/utils-build";
import { removeLogInternalCalls } from "~/app/utils/utils-clean";
import { determineDistName } from "~/app/utils/utils-determine";
import {
  copyRootFile,
  deleteSpecificFiles,
  getDirectorySize,
  outDirBinFilesCount,
} from "~/app/utils/utils-fs";
import { createJsrJSON, renameTsxFiles } from "~/app/utils/utils-jsr-json";
import { library_createPackageJSON } from "~/app/utils/utils-package-json-libraries";
import { getElapsedPerfTime } from "~/app/utils/utils-perf";

// ============================================================================
// Constants
// ============================================================================

const BIN_DIR_NAME = "bin"; // Directory name for bundled output within dist
const ALIAS_PREFIX_TO_CONVERT = "~"; // Alias prefix used in internal imports

// ============================================================================
// Type Definitions
// ============================================================================

/** Options specific to the NPM build target */
interface NpmBuildOptions {
  npmOutDir: string; // Output directory for NPM build (relative to project root)
  distNpmBuilder: BundlerName;
  coreEntrySrcDir: string; // Base source directory containing libs (e.g., "src")
}

/** Options specific to the JSR build target */
interface JsrBuildOptions {
  jsrOutDir: string; // Output directory for JSR build (relative to project root)
  distJsrBuilder: BundlerName;
  distJsrOutFilesExt: NpmOutExt; // Specific output extension for JSR files
}

/** Consolidated options for the main library build function */
export type LibraryBuildOptions = ReliverseConfig & {
  effectivePubRegistry: "npm" | "jsr" | "npm-jsr" | undefined;
  npm?: NpmBuildOptions;
  jsr?: JsrBuildOptions;
  libName: string;
  mainDir: string;
  libMainFile: string;
  isDev: boolean;
  libsList: Record<string, LibConfig>;
  timer: PerfTimer;
  libTranspileMinify: boolean;
  transpileTarget: TranspileTarget;
  transpileFormat: TranspileFormat;
  transpileSplitting: boolean;
  transpileSourcemap: Sourcemap;
  transpilePublicPath: string;
  transpileEsbuild: Esbuild;
  transpileStub: boolean;
  transpileWatch: boolean;
  unifiedBundlerOutExt: NpmOutExt;
};

/** Parameters for the unified `library_buildDistributionTarget` function */
interface BuildTargetParams {
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
}

/** Parameters required by the individual bundler executor functions (Bun, Unified, JSR Copy) */
interface BundleExecutorParams {
  entryPoint: string; // Absolute path to entry file OR directory (for 'jsr' copy)
  outDir: string; // Absolute path to output directory (usually the 'bin' subdir)
  libName: string; // For logging context
  timer: PerfTimer;
  // Transpilation/bundler options relevant to the specific executor
  libDeclarations: boolean; // Primarily for unified
  libTranspileMinify: boolean;
  transpileTarget: TranspileTarget;
  transpileFormat: TranspileFormat;
  transpileSplitting: boolean;
  transpileSourcemap: Sourcemap;
  transpilePublicPath: string;
  transpileEsbuild: Esbuild; // For unified
  transpileStub: boolean; // For unified
  transpileWatch: boolean; // For unified (or potentially others)
  unifiedBundlerOutExt: NpmOutExt; // For bun/unified
}

/** Parameters for the central bundler dispatcher function `library_bundleWithBuilder` */
type BundleRequestParams = {
  builder: BundlerName; // The specific builder to use
} & BundleExecutorParams;

/** Parameters for common post-bundling steps */
interface CommonStepsParams {
  coreEntryFileName: string;
  outputDirRoot: string;
  npmOutputDirRoot?: string;
  jsrOutputDirRoot?: string;
  effectivePubRegistry: "npm" | "jsr" | "npm-jsr" | undefined;
  outDirBin: string;
  isJsr: boolean;
  libName: string;
  libsList: Record<string, LibConfig>;
  config: ReliverseConfig;
  unifiedBundlerOutExt: NpmOutExt;
  distJsrOutFilesExt: NpmOutExt;
  deleteFiles?: boolean;
  libDirName?: string;
}

// ============================================================================
// Main Orchestration
// ============================================================================

/**
 * Main entry point to build a library based on the provided options.
 * Manages pre-build source modifications, orchestrates target builds, and ensures post-build cleanup.
 * @param options - The consolidated build configuration.
 */
export async function library_buildLibrary(options: LibraryBuildOptions): Promise<void> {
  const { libName } = options;

  try {
    // --- Core Build Step: Execute NPM/JSR builds ---
    await executeBuildTasks(options);
  } catch (err) {
    // --- Error Handling ---
    const error = err instanceof Error ? err : new Error(String(err));
    relinka("error", `Build process for ${libName} failed: ${error.message}`);
    throw error;
  }
}

/**
 * Determines which build targets (NPM, JSR) are needed and executes them, potentially concurrently.
 * @param options - The consolidated build configuration.
 */
async function executeBuildTasks(options: LibraryBuildOptions): Promise<void> {
  const { libName, npm, jsr, effectivePubRegistry } = options;
  relinka("verbose", `Executing build tasks for ${libName} (Registry: ${effectivePubRegistry})...`);

  const buildTasks: (() => Promise<void>)[] = [];

  if (effectivePubRegistry === "jsr" || effectivePubRegistry === "npm-jsr") {
    if (!jsr) {
      throw new Error(
        `Build Error (executeBuildTasks): JSR config missing for ${libName} when registry includes JSR.`,
      );
    }
    buildTasks.push(() => library_buildJsrDist(options)); // options includes jsr.jsrOutDir
  }

  if (effectivePubRegistry === "npm" || effectivePubRegistry === "npm-jsr") {
    if (!npm) {
      throw new Error(
        `Build Error (executeBuildTasks): NPM config missing for ${libName} when registry includes NPM.`,
      );
    }
    buildTasks.push(() => library_buildNpmDist(options)); // options includes npm.npmOutDir
  }

  if (buildTasks.length === 0) {
    relinka("warn", `No build tasks for ${libName} based on registry: ${effectivePubRegistry}`);
    return;
  }

  await pAll(buildTasks, { concurrency: CONCURRENCY_DEFAULT });
  relinka("success", `All build tasks completed for ${libName}.`);
}

// ============================================================================
// Target-Specific Build Entry Points (NPM & JSR)
// ============================================================================

/**
 * Prepares configuration and initiates the build process for the JSR target.
 * @param options - The consolidated build configuration.
 */
async function library_buildJsrDist(options: LibraryBuildOptions): Promise<void> {
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
  relinka("verbose", `[JSR] Initializing JSR build for ${libName}...`);

  // Resolve paths
  const libSourceDirResolved = path.resolve(PROJECT_ROOT, options.mainDir);
  const entryFilePathResolved = path.resolve(libSourceDirResolved, libMainFile);
  const outputDirRootResolved = path.resolve(PROJECT_ROOT, jsrOutDir);
  const outputDirBinResolved = path.resolve(outputDirRootResolved, BIN_DIR_NAME);

  // Ensure output directories exist
  await fs.ensureDir(outputDirRootResolved);
  await fs.ensureDir(outputDirBinResolved);

  // Determine bundler entry point: directory for 'jsr' copy, file for others
  const bundlerEntryPoint = distJsrBuilder === "jsr" ? libSourceDirResolved : entryFilePathResolved;

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
    libSourceDir: libSourceDirResolved,
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
  relinka("verbose", `[JSR] Performing JSR-specific transformations in ${outputDirBinResolved}`);
  await createJsrJSON(
    outputDirRootResolved,
    true,
    options.libsList,
    options,
    libName,
    libConfig?.libDescription ?? "",
  );
  await renameTsxFiles(outputDirBinResolved);

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
async function library_buildNpmDist(options: LibraryBuildOptions): Promise<void> {
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
  relinka("verbose", `[NPM:${distName}] Initializing NPM build for ${libName}...`);

  // Ensure output directories exist
  const outputDirRootResolved = path.resolve(PROJECT_ROOT, npmOutDir);
  const outputDirBinResolved = path.resolve(outputDirRootResolved, BIN_DIR_NAME);
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
  const entryFilePathResolved = path.resolve(libSpecificSrcDir, path.basename(libMainFile));

  // Validate entry file existence
  if (!(await fs.pathExists(entryFilePathResolved))) {
    const relativeEntryPath = path.relative(PROJECT_ROOT, entryFilePathResolved);
    const relativeSrcDir = path.relative(PROJECT_ROOT, libSpecificSrcDir);
    throw new Error(
      `[NPM:${distName}] Library entry file not found: ${relativeEntryPath} (expected in: ${relativeSrcDir})`,
    );
  }
  relinka("verbose", `[NPM:${distName}] Using entry file: ${entryFilePathResolved}`);

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
  params: BuildTargetParams & { npmOutDir?: string; jsrOutDir?: string },
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
    npmOutDir,
    jsrOutDir,
  } = params;
  const {
    libName,
    timer,
    libMainFile,
    libsList,
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

  relinka("verbose", `${logPrefix} Starting build target processing...`);

  // Ensure output directories exist
  await fs.ensureDir(outputDirRoot);
  await fs.ensureDir(outputDirBin);
  relinka("verbose", `${logPrefix} Using builder: ${builder}`);

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
    outputDirRoot,
    outDirBin: outputDirBin,
    isJsr,
    libName,
    libsList,
    config: options,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
    deleteFiles: isJsr,
    libDirName,
    npmOutputDirRoot: npmOutDir || (options.npm ? options.npm.npmOutDir : undefined),
    jsrOutputDirRoot: jsrOutDir || (options.jsr ? options.jsr.jsrOutDir : undefined),
    effectivePubRegistry: options.effectivePubRegistry,
  };
  await library_performCommonBuildSteps(commonStepsParams);

  relinka("verbose", `${logPrefix} Completed build target processing.`);
}

// ============================================================================
// Bundler Dispatcher & Implementations
// ============================================================================

/**
 * Centralized helper to dispatch to the correct bundler function based on builder name.
 * @param params - Parameters required for bundling execution, including the builder name.
 */
async function library_bundleWithBuilder(params: BundleRequestParams): Promise<void> {
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
  relinka("verbose", `[JSR Copy:${libName}] Starting copy: ${srcDir} -> ${destDir}`);
  await fs.ensureDir(destDir);

  try {
    // Get all files in the source directory
    const files = await fs.readdir(srcDir, { withFileTypes: true });

    // Copy each file/directory individually to maintain the correct structure
    for (const file of files) {
      const srcPath = path.join(srcDir, file.name);
      const destPath = path.join(destDir, file.name);

      if (file.isDirectory()) {
        // Recursively copy directories
        await fs.copy(srcPath, destPath, { overwrite: true });
      } else {
        // Copy individual files
        await fs.copy(srcPath, destPath, { overwrite: true });
      }
    }

    relinka(
      "success",
      `[JSR Copy:${libName}] Completed copying library source from ${srcDir} to ${destDir}`,
    );
  } catch (error) {
    relinka(
      "error",
      `Failed to copy library source from ${srcDir} to ${destDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
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
    throw new Error(`[Bun:${libName}] Library entry file not found: ${entryPoint}`);
  }
  if (!(await fs.stat(entryPoint)).isFile()) {
    throw new Error(`[Bun:${libName}] Entry point must be a file for Bun bundler: ${entryPoint}`);
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
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
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
      throw new Error(`[Bun:${libName}] Build process reported failure. Check logs.`);
    }
  } catch (error) {
    relinka(
      "error",
      `Library build threw an error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/** Builds using a unified builder (e.g., rollup, mkdist via unjs/unbuild). */
async function library_bundleUsingUnified(
  entryPoint: string, // File path (rollup) or directory path (mkdist)
  outDirBin: string,
  builder: Extract<BundlerName, "rollup" | "mkdist">, // Specific unified builder
  _sourceDirContext: string, // Directory containing the entryPoint, relative to project root
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
    await unifiedBuild(
      entryPoint,
      { enabled: false, scripts: {} },
      true,
      rootDir,
      unifiedBuildConfig,
      outDirBin,
    );

    const duration = getElapsedPerfTime(timer);
    relinka(
      "success",
      `[Unified:${builder}] Library build completed in ${prettyMilliseconds(duration)}.`,
    );
  } catch (error) {
    relinka(
      "error",
      `Library build failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
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
async function library_performCommonBuildSteps(params: CommonStepsParams): Promise<void> {
  const {
    coreEntryFileName,
    outputDirRoot,
    outDirBin,
    isJsr,
    libName,
    libsList,
    config,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
    deleteFiles = false,
    libDirName,
    npmOutputDirRoot,
    jsrOutputDirRoot,
    effectivePubRegistry,
  } = params;

  const targetType = isJsr ? "JSR" : "NPM";
  const logPrefix = `[Common:${targetType}:${libName}]`;

  relinka(
    "verbose",
    `${logPrefix} Performing common steps in ${outputDirRoot}. Entry file: ${coreEntryFileName}. ${isJsr ? `JSR out files ext: ${distJsrOutFilesExt}` : `NPM out files ext: ${unifiedBundlerOutExt}`}`,
  );

  // Create package.json
  await library_createPackageJSON(
    libName,
    npmOutputDirRoot || outputDirRoot,
    jsrOutputDirRoot || outputDirRoot,
    effectivePubRegistry,
    libsList,
    config,
    unifiedBundlerOutExt,
  );
  relinka("verbose", `${logPrefix} Created package.json.`);

  // Clean up the dist from potential internal logging
  await removeLogInternalCalls(outDirBin);

  // Delete specific intermediate/unwanted files if requested
  if (deleteFiles) {
    await deleteSpecificFiles(outDirBin);
    relinka("verbose", `${logPrefix} Deleted specific files from ${outDirBin}.`);
  }

  // Copy root-level files
  const filesToCopy = isJsr
    ? config.publishArtifacts?.["dist-libs"]?.[libName]?.jsr ||
      config.publishArtifacts?.["dist-jsr"] || ["jsr.json"]
    : config.publishArtifacts?.["dist-libs"]?.[libName]?.npm ||
      config.publishArtifacts?.["dist-npm"] ||
      [];

  // Always include global files, but exclude jsr.json/jsonc, package.json, and bin since they are generated
  const globalFiles = config.publishArtifacts?.global || ["package.json", "README.md", "LICENSE"];
  const allFilesToCopy = [...new Set([...globalFiles, ...filesToCopy])];

  await copyRootFile(outputDirRoot, allFilesToCopy);
  relinka(
    "verbose",
    `${logPrefix} Copied root files (${allFilesToCopy.join(", ")}) to ${outputDirRoot}`,
  );

  // Convert internal alias imports
  const stripSegments = libDirName ? [`libs/${libDirName}`] : [];
  relinka(
    "verbose",
    `${logPrefix} Converting alias paths in ${outDirBin}, stripping: [${stripSegments.join(", ")}]`,
  );

  // relinka("info", `[${libName}] Step 2: Stripping segments`);
  relinka("info", `[${libName}] Stripping segments`);
  await stripPathSegmentsInDirectory({
    targetDir: outDirBin,
    segmentsToStrip: 2,
    alias: ALIAS_PREFIX_TO_CONVERT,
  });
  // await convertImportPaths({
  //   aliasPrefix: ALIAS_PREFIX_TO_CONVERT,
  //   baseDir: outDirBin,
  //   fromType: "alias",
  //   toType: "relative",
  //   libsList,
  //   strip: stripSegments,
  // });
  // Convert any "~/..." alias imports to relative
  // relinka("info", `[${libName}] Step 3: Performing alias path conversion in ${outDirBin}`);
  relinka("info", `[${libName}] Performing alias path conversion in ${outDirBin}`);
  await convertImportsAliasToRelative({
    targetDir: outDirBin,
    aliasToReplace: ALIAS_PREFIX_TO_CONVERT,
    pathExtFilter: "js-ts-none",
  });
  if (isJsr) {
    relinka("info", `[${libName}] Performing paths ext conversion in ${outDirBin} (from js to ts)`);
    await convertImportsExt({
      targetDir: outDirBin,
      extFrom: "js",
      extTo: "ts",
    });
    await convertImportsExt({
      targetDir: outDirBin,
      extFrom: "none",
      extTo: "ts",
    });
  }

  // Rename the main entry file
  // TODO: remove in the future (deprecated)
  // relinka("verbose", `${logPrefix} Renaming entry file in ${outDirBin}.`);
  // await renameEntryFile(
  //   isJsr,
  //   outDirBin,
  //   coreEntryFileName,
  //   unifiedBundlerOutExt,
  //   distJsrOutFilesExt,
  // );

  relinka("verbose", `${logPrefix} Completed common build steps.`);
}

/**
 * Determines the specific source directory for an NPM library.
 * @returns An object containing the resolved `libSpecificSrcDir` and `libDirName` (if found).
 */
async function determineNpmSourceDirectory(
  libName: string,
  _mainFile: string, // Base name of the main file
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
      const potentialPath = path.join(coreEntrySrcDirResolved, "libs", potentialLibDirName);
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
        const absoluteLibMainFile = path.resolve(PROJECT_ROOT, libConfig.libMainFile);
        if (absoluteLibMainFile.startsWith(baseLibsDir + path.sep)) {
          const mainFilePathRelative = path.relative(baseLibsDir, absoluteLibMainFile);
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
