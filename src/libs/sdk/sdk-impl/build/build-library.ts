import { build as bunBuild } from "bun";
import fs from "fs-extra";
import pAll from "p-all";
import path from "pathe";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";

import type { UnifiedBuildConfig } from "~/libs/sdk/sdk-main.js";
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

import { build as unifiedBuild } from "~/libs/sdk/sdk-impl/build/bundlers/unified/build.js";
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
  createJsrJSONC,
  renameTsxFiles,
} from "~/libs/sdk/sdk-impl/utils/utils-jsr.js";
import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";
import { createLibPackageJSON } from "~/libs/sdk/sdk-impl/utils/utils-package.js";
import {
  convertImportExtensionsJsToTs,
  convertImportPaths,
} from "~/libs/sdk/sdk-impl/utils/utils-paths.js";
import {
  getElapsedPerfTime,
  type PerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";

import { ensuredir } from "./bundlers/unified/utils.js";

/**
 * Builds a library for the specified commonPubRegistry.
 */
export async function library_buildLibrary(
  commonPubRegistry: string | undefined,
  libName: string,
  mainDir: string,
  npmOutDir: string,
  jsrOutDir: string,
  mainFile: string,
  isDev: boolean,
  coreEntrySrcDir: string,
  distNpmBuilder: BundlerName,
  libsList: Record<string, LibConfig>,
  coreIsCLI: boolean,
  unifiedBundlerOutExt: NpmOutExt,
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
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
): Promise<void> {
  switch (commonPubRegistry) {
    case "jsr":
      relinka("info", `Building lib ${libName} for JSR-only...`);
      await library_buildJsrDist(
        isDev,
        libName,
        mainDir,
        npmOutDir,
        distJsrBuilder,
        mainFile,
        coreIsCLI,
        libsList,
        rmDepsMode,
        rmDepsPatterns,
        unifiedBundlerOutExt,
        transpileTarget,
        transpileFormat,
        transpileSplitting,
        transpileMinify,
        transpileSourcemap,
        transpilePublicPath,
        npmOutDir,
        transpileEsbuild,
        timer,
        transpileStub,
        transpileWatch,
      );
      break;
    case "npm":
      relinka("info", `Building lib ${libName} for NPM-only...`);
      await library_buildNpmDist(
        libName,
        npmOutDir,
        mainFile,
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
        timer,
        transpileStub,
        transpileWatch,
      );
      break;
    case "npm-jsr": {
      relinka("info", `Building lib ${libName} for NPM and JSR...`);

      const buildTasks = [
        () =>
          library_buildNpmDist(
            libName,
            npmOutDir,
            mainFile,
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
            timer,
            transpileStub,
            transpileWatch,
          ),
        () =>
          library_buildJsrDist(
            isDev,
            libName,
            mainDir,
            jsrOutDir,
            distJsrBuilder,
            mainFile,
            coreIsCLI,
            libsList,
            rmDepsMode,
            rmDepsPatterns,
            unifiedBundlerOutExt,
            transpileTarget,
            transpileFormat,
            transpileSplitting,
            transpileMinify,
            transpileSourcemap,
            transpilePublicPath,
            jsrOutDir,
            transpileEsbuild,
            timer,
            transpileStub,
            transpileWatch,
          ),
      ];
      await pAll(buildTasks, {
        concurrency: CONCURRENCY_DEFAULT,
      });
      break;
    }
    default:
      relinka(
        "warn",
        `Unknown commonPubRegistry "${commonPubRegistry}" for lib ${libName}. Skipping build.`,
      );
  }
}

/**
 * Builds a lib distribution for JSR.
 */
async function library_buildJsrDist(
  isDev: boolean,
  libName: string,
  coreEntrySrcDir: string,
  distJsrDirName: string,
  distJsrBuilder: BundlerName,
  coreEntryFile: string,
  coreIsCLI: boolean,
  libsList: Record<string, LibConfig>,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  unifiedBundlerOutExt: NpmOutExt,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  outDirBin: string,
  transpileEsbuild: Esbuild,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
): Promise<void> {
  relinka("info", "Building JSR distribution...");
  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);
  const outDirBinResolved = path.resolve(distJsrDirNameResolved, "bin");
  await ensuredir(distJsrDirNameResolved);
  await ensuredir(outDirBinResolved);
  relinka("info", `Using JSR builder: ${distJsrBuilder}`);
  if (distJsrBuilder === "jsr") {
    await library_bundleUsingJsr(coreEntrySrcDirResolved, outDirBinResolved);
  } else if (distJsrBuilder === "bun") {
    await library_bundleUsingBun(
      coreEntryFile,
      outDirBin,
      libName,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      transpileMinify,
      transpileSourcemap,
      transpilePublicPath,
      timer,
    );
  } else {
    await library_bundleUsingUnified(
      coreEntryFilePath,
      outDirBinResolved,
      distJsrBuilder,
      coreEntrySrcDir,
      unifiedBundlerOutExt,
      transpileStub,
      transpileWatch,
      transpileEsbuild,
      transpileMinify,
      transpileSourcemap,
      timer,
      libsList,
    );
  }
  await library_performCommonBuildSteps({
    coreEntryFile,
    coreIsCLI,
    isJsr: true,
    libName,
    libsList,
    outDirRoot: distJsrDirNameResolved,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
  });
  await convertImportExtensionsJsToTs(outDirBinResolved);
  await renameTsxFiles(outDirBinResolved);
  await createJsrJSONC(distJsrDirNameResolved, false);
  const dirSize = await getDirectorySize(distJsrDirNameResolved, isDev);
  const filesCount = await outDirBinFilesCount(outDirBinResolved);
  relinka(
    "success",
    `JSR distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
  relinka(
    "success",
    `[${distJsrDirNameResolved}] Successfully created library distribution: ${libName} (${outDirBinResolved}/main.ts) with (${filesCount} files (${prettyBytes(dirSize)})`,
  );
}

/**
 * Builds a lib distribution for NPM.
 */
async function library_buildNpmDist(
  libName: string,
  libOutDirRoot: string,
  libEntryFile: string,
  isDev: boolean,
  coreEntrySrcDir: string,
  distNpmBuilder: BundlerName,
  libsList: Record<string, LibConfig>,
  coreIsCLI: boolean,
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  transpileEsbuild: Esbuild,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
): Promise<void> {
  // =====================================================
  // [dist-libs/npm] 1. Initialize
  // =====================================================
  const distName = determineDistName(libOutDirRoot, false, libsList);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildNpmDist for lib: ${libName}`,
  );
  const libOutDirBinResolved = path.resolve(libOutDirRoot, "bin");
  relinka("info", `[${distName}] Building NPM dist for lib: ${libName}...`);
  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  // Get the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;
  // Handle any "{prefix}-xyz" transpileFormat by extracting just "xyz" part
  const dashIndex = libNameSimple.indexOf("-");
  const normalizedLibName =
    dashIndex !== -1 ? libNameSimple.substring(dashIndex + 1) : libNameSimple;
  // Extract the actual directory from the main file path in the config
  let libSrcDir = path.join(coreEntrySrcDirResolved, "libs", normalizedLibName);
  // Check if we have a main file path in the config
  const libConfig = libsList?.[libName];
  if (libConfig?.libMainFile) {
    const mainFilePath = libConfig.libMainFile;
    const libDirMatch = /src\/libs\/([^/]+)\//.exec(mainFilePath);
    if (libDirMatch?.[1]) {
      // Use the directory from the main file path
      const actualLibDir = libDirMatch[1];
      libSrcDir = path.join(coreEntrySrcDirResolved, "libs", actualLibDir);
    }
  }

  // =====================================================
  // [dist-libs/npm] 2. Build using the appropriate builder
  // =====================================================
  if (distNpmBuilder === "jsr") {
    await library_bundleUsingJsr(libSrcDir, libOutDirBinResolved);
  } else if (distNpmBuilder === "bun") {
    await library_bundleUsingBun(
      libEntryFile,
      libOutDirBinResolved,
      libName,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      transpileMinify,
      transpileSourcemap,
      transpilePublicPath,
      timer,
    );
  } else {
    // Construct the full path to the entry file
    // For library builds, we need to use the library-specific entry file path
    const libEntryFilePath = path.join(libSrcDir, path.basename(libEntryFile));
    relinka("verbose", `[${distName}] libEntryFilePath: ${libEntryFilePath}`);
    relinka(
      "verbose",
      `[${distName}] libOutDirBinResolved: ${libOutDirBinResolved}`,
    );
    await library_bundleUsingUnified(
      libEntryFilePath,
      libOutDirBinResolved,
      distNpmBuilder,
      coreEntrySrcDir,
      unifiedBundlerOutExt,
      transpileStub,
      transpileWatch,
      transpileEsbuild,
      false,
      "none",
      timer,
      libsList,
    );
  }

  // =====================================================
  // [dist-libs/npm] 3. Perform common library build steps
  // =====================================================
  await library_performCommonBuildSteps({
    coreEntryFile: libEntryFile,
    coreIsCLI,
    deleteFiles: false,
    isJsr: false,
    libName,
    libsList,
    outDirRoot: libOutDirRoot,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
  });

  // =====================================================
  // [dist-libs/npm] 4. Finalize
  // =====================================================
  const dirSize = await getDirectorySize(libOutDirRoot, isDev);
  const filesCount = await outDirBinFilesCount(libOutDirBinResolved);
  relinka(
    "success",
    `[${libOutDirRoot}] Successfully created library distribution: ${libName} (${libOutDirRoot}/main.js) with (${filesCount} files (${prettyBytes(dirSize)})`,
  );
}

/**
 * Bundles using Bun for library projects.
 */
async function library_bundleUsingBun(
  coreEntryFile: string,
  outDirBin: string,
  libName: string,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  timer: PerfTimer,
): Promise<void> {
  relinka(
    "verbose",
    `Bundling library using Bun for ${libName} (entry: ${coreEntryFile}, outDir: ${outDirBin})`,
  );

  if (!(await fs.pathExists(coreEntryFile))) {
    relinka("error", `Could not find library entry file at: ${coreEntryFile}`);
    throw new Error(`Library entry file not found: ${coreEntryFile}`);
  }

  try {
    const buildResult = await bunBuild({
      banner: `/* Library: ${libName} - Bundled by @reliverse/relidler */`,
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
      drop: ["debugger"],
      entrypoints: [coreEntryFile],
      footer: "/* End of bundle */",
      format: transpileFormat,
      minify: transpileMinify,
      naming: {
        asset: "[name]-[hash].[ext]",
        chunk: "[name]-[hash].[ext]",
        entry: "[dir]/[name]-[hash].[ext]",
      },
      outdir: outDirBin,
      publicPath: transpilePublicPath,
      sourcemap: getBunSourcemapOption(transpileSourcemap),
      splitting: transpileSplitting,
      target: transpileTarget,
      throw: true,
    });

    // Calculate and log build duration
    const duration = getElapsedPerfTime(timer);
    const transpileFormattedDuration = prettyMilliseconds(duration, {
      verbose: true,
    });
    relinka(
      "success",
      `Library bun build completed in ${transpileFormattedDuration} for ${libName} with ${buildResult.outputs.length} output file(s).`,
    );

    if (buildResult.logs && buildResult.logs.length > 0) {
      buildResult.logs.forEach((log, index) => {
        relinka("verbose", `Log ${index + 1}: ${JSON.stringify(log)}`);
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Library build failed for ${libName} while using bun bundler: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Library bundle failed for ${libName} (${outDirBin}): ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

/**
 * Bundles a library project using JSR by copying the appropriate library directory.
 */
async function library_bundleUsingJsr(
  src: string,
  dest: string,
): Promise<void> {
  relinka("info", `Starting library JSR bundle: ${src} -> ${dest}`);
  await ensuredir(path.dirname(dest));

  // Validate source is a directory
  const stats = await fs.stat(src);
  if (!stats.isDirectory()) {
    throw new Error(
      "You are using the 'jsr' builder, but path to file was provided. Please provide path to directory instead.",
    );
  }

  try {
    await fs.copy(src, dest);
    relinka("verbose", `Copied directory from ${src} to ${dest}`);
    relinka("success", "Completed library JSR bundling");
  } catch (error) {
    // Handle errors gracefully with fallback to original source
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Builds using a unified builder for library projects.
 */
async function library_bundleUsingUnified(
  coreEntryFile: string,
  outDirBin: string,
  builder: BundlerName,
  coreEntrySrcDir: string,
  unifiedBundlerOutExt: NpmOutExt,
  transpileStub: boolean,
  transpileWatch: boolean,
  transpileEsbuild: Esbuild,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  timer: PerfTimer,
  libsList?: Record<string, LibConfig>,
): Promise<void> {
  if (builder === "jsr" || builder === "bun") {
    throw new Error(
      "'jsr'/'bun' builder not supported for library_bundleUsingUnified",
    );
  }
  try {
    relinka(
      "verbose",
      `Starting library_bundleUsingUnified with builder: ${builder}`,
    );
    const rootDir = path.resolve(PROJECT_ROOT, coreEntrySrcDir || ".");

    // Extract the library name from the path
    // Normalize path for regex processing (replace Windows backslashes with forward slashes)
    const normalizedPath = outDirBin.replace(/\\/g, "/");
    const libNameMatch = /dist-libs\/([^/]+)\//.exec(normalizedPath);

    if (!libNameMatch?.[1]) {
      throw new Error(
        `Could not determine library name from path: ${outDirBin}`,
      );
    }

    // The distribution directory name which may contain a prefix
    const distLibName = libNameMatch[1];

    // Look for a matching library in the config if available
    let libName = "";
    let libSrcDir = "";

    if (libsList) {
      for (const [pkgName, config] of Object.entries(libsList)) {
        const mainPath = config.libMainFile;
        const simpleLibName = pkgName.split("/").pop() || pkgName;

        // Check if this is the correct library by comparing distribution dir name
        if (
          distLibName === simpleLibName ||
          distLibName.endsWith(`-${simpleLibName.replace(/^.*?-/, "")}`) ||
          // For prefixed names like relidler-cfg where cfg is the actual dir
          mainPath.includes(`/${distLibName.split("-").pop()}/`)
        ) {
          // Found a match - extract the library name and source directory
          libName = simpleLibName.split("-").pop() || simpleLibName;

          // Try different approaches to find the correct source directory
          const possibilities = [
            // From the main path directly (cfg/cfg-main.ts -> src/libs/cfg)
            path.join(rootDir, "libs", path.dirname(mainPath)),
            // Just the library directory (src/libs/cfg)
            path.join(rootDir, "libs", libName),
            // Full path from main (src/libs/cfg)
            path.join(rootDir, path.dirname(mainPath)),
          ];

          // Use the first path that exists
          for (const possiblePath of possibilities) {
            try {
              if (fs.existsSync(possiblePath)) {
                libSrcDir = possiblePath;
                break;
              }
            } catch (_e) {
              // Ignore errors and try next option
            }
          }

          if (libSrcDir) {
            break;
          }
        }
      }
    }

    // Fallback to the old parsing logic if we didn't find a match in the config
    if (!libSrcDir) {
      // Extract the actual library name without any prefix if it contains a dash
      libName = distLibName;
      // Handle "{any-prefix}-xyz" transpileFormat by extracting just the "xyz" part
      const dashIndex = libName.indexOf("-");
      if (dashIndex !== -1) {
        libName = libName.substring(dashIndex + 1);
      }

      // Construct the full path to the library directory
      const coreEntrySrcDirResolved = path.resolve(
        PROJECT_ROOT,
        coreEntrySrcDir,
      );
      libSrcDir = path.join(coreEntrySrcDirResolved, "libs", libName);

      // Make sure the directory exists
      if (!fs.existsSync(libSrcDir)) {
        throw new Error(
          `Library source directory not found: ${libSrcDir} for library: ${libName}`,
        );
      }
    }

    relinka(
      "info",
      `Library build detected for ${libName}. Using source directory: ${libSrcDir}`,
    );

    // Validate and normalize the output file extension
    if (!validExtensions.includes(unifiedBundlerOutExt)) {
      relinka(
        "warn",
        `Invalid output extension: ${unifiedBundlerOutExt}, defaulting to 'js'`,
      );
      unifiedBundlerOutExt = "js";
    }

    // For mkdist, we need to use the directory containing the entry file, not the file itself
    const input = builder === "mkdist" ? libSrcDir : coreEntryFile;

    // Determine optimal concurrency based on configuration and system resources
    const concurrency = CONCURRENCY_DEFAULT;
    relinka("verbose", `Using concurrency level: ${concurrency}`);

    const unifiedBuildConfig = {
      clean: false,
      concurrency,
      declaration: false,
      entries: [
        {
          builder,
          ext: unifiedBundlerOutExt,
          input: builder === "mkdist" ? libSrcDir : input,
          outDir: outDirBin,
        },
      ],
      rollup: {
        emitCJS: false,
        esbuild: {
          minify: transpileMinify,
          target: transpileEsbuild,
        },
        inlineDependencies: true,
        output: {
          sourcemap: getUnifiedSourcemapOption(transpileSourcemap),
        },
      },
      showOutLog: true,
      transpileStub: transpileStub,
      transpileWatch: transpileWatch ?? false,
    } satisfies UnifiedBuildConfig & { concurrency?: number };

    await unifiedBuild(rootDir, transpileStub, unifiedBuildConfig, outDirBin);

    // Calculate and log build duration
    const duration = (getElapsedPerfTime(timer) / 1000).toFixed(2);
    relinka(
      "success",
      `Library bundle completed in ${duration}s using ${builder} builder for library ${libName}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Failed to bundle library using ${builder}: ${errorMessage}`,
    );

    // Provide more context in the error message
    const enhancedError = new Error(
      `Library bundle failed for ${outDirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }

    throw enhancedError;
  }
}

/**
 * Common library build steps shared between JSR and NPM distributions
 */
async function library_performCommonBuildSteps({
  coreEntryFile,
  coreIsCLI,
  deleteFiles = true,
  isJsr,
  libName,
  libsList,
  outDirRoot,
  rmDepsMode,
  rmDepsPatterns,
  unifiedBundlerOutExt,
}: {
  coreEntryFile: string;
  coreIsCLI: boolean;
  deleteFiles?: boolean;
  isJsr: boolean;
  libName: string;
  libsList: Record<string, LibConfig>;
  outDirRoot: string;
  rmDepsMode: ExcludeMode;
  rmDepsPatterns: string[];
  unifiedBundlerOutExt: NpmOutExt;
}): Promise<void> {
  const outDirBinResolved = path.resolve(outDirRoot, "bin");
  await createLibPackageJSON(
    libName,
    outDirRoot,
    isJsr,
    coreIsCLI,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
  );
  if (deleteFiles) {
    await deleteSpecificFiles(outDirBinResolved);
  }

  const FILES_TO_COPY = ["README.md", "LICENSE"];
  await copyRootFile(outDirRoot, FILES_TO_COPY);
  relinka("verbose", `Copied root files to ${outDirRoot}`);

  await convertImportPaths({
    aliasPrefix: "~/",
    baseDir: outDirBinResolved,
    fromType: "alias",
    libsList,
    toType: "relative",
    strip: ["libs/sdk"],
  });
  await renameEntryFile(isJsr, outDirRoot, coreEntryFile, unifiedBundlerOutExt);
}
