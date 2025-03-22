import { build as bunBuild } from "bun";
import fs from "fs-extra";
import MagicString from "magic-string";
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
} from "~/libs/sdk/sdk-types.js";

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
  createJsrJSON,
  renameTsxFiles,
} from "~/libs/sdk/sdk-impl/utils/utils-jsr-json.js";
import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";
import {
  convertImportExtensionsJsToTs,
  convertImportPaths,
} from "~/libs/sdk/sdk-impl/utils/utils-paths.js";
import {
  getElapsedPerfTime,
  type PerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";
import { library_createPackageJSON } from "~/libs/sdk/sdk-impl/utils/utils-pkg-json-libs.js";

import { ensuredir } from "./bundlers/unified/utils.js";

type ReplacementRecord = {
  filePath: string;
  newContent: string;
  originalContent: string;
};

/**
 * Main entry point to build a library for the specified commonPubRegistry.
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
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  transpileEsbuild: Esbuild,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  libTranspileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  distJsrBuilder: BundlerName,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrOutFilesExt: NpmOutExt,
): Promise<void> {
  // We'll do a pre-build pass on 'mainDir' before we do anything
  let replacedFiles: ReplacementRecord[] = [];
  try {
    relinka("info", `Running pre-build replacements for ${libName}...`);
    replacedFiles = await preBuildReplacements(mainDir);

    // Do normal build tasks
    switch (commonPubRegistry) {
      case "jsr":
        relinka("info", `Building lib ${libName} for JSR-only...`);
        await library_buildJsrDist(
          isDev,
          libName,
          mainDir,
          jsrOutDir,
          distJsrBuilder,
          mainFile,
          libsList,
          rmDepsMode,
          rmDepsPatterns,
          unifiedBundlerOutExt,
          transpileTarget,
          transpileFormat,
          transpileSplitting,
          libTranspileMinify,
          transpileSourcemap,
          transpilePublicPath,
          transpileEsbuild,
          timer,
          transpileStub,
          transpileWatch,
          distJsrOutFilesExt,
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
          unifiedBundlerOutExt,
          rmDepsMode,
          rmDepsPatterns,
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
          distJsrOutFilesExt,
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
              unifiedBundlerOutExt,
              rmDepsMode,
              rmDepsPatterns,
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
              distJsrOutFilesExt,
            ),
          () =>
            library_buildJsrDist(
              isDev,
              libName,
              mainDir,
              jsrOutDir,
              distJsrBuilder,
              mainFile,
              libsList,
              rmDepsMode,
              rmDepsPatterns,
              unifiedBundlerOutExt,
              transpileTarget,
              transpileFormat,
              transpileSplitting,
              libTranspileMinify,
              transpileSourcemap,
              transpilePublicPath,
              transpileEsbuild,
              timer,
              transpileStub,
              transpileWatch,
              distJsrOutFilesExt,
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
  } catch (err) {
    // If anything failed, we rethrow. (We'll still revert in the finally block)
    relinka(
      "error",
      `Build process for ${libName} encountered an error: ${(err as Error).message}`,
    );
    throw err;
  } finally {
    // post-build revert so that the original source files are restored
    // even if an error occurred.
    relinka("verbose", `Reverting pre-build changes for ${libName}...`);
    await postBuildReplacements(replacedFiles);
    relinka("verbose", `Done reverting changes for ${libName}.`);
  }
}

/**
 * Recursively finds all .ts files in a directory.
 */
async function collectTsFilesRecursively(
  dir: string,
  output: string[],
): Promise<void> {
  if (!(await fs.pathExists(dir))) {
    throw new Error(`Directory not found for pre-build scanning: ${dir}`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTsFilesRecursively(fullPath, output);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      output.push(fullPath);
    }
  }
}

/**
 * Builds a lib distribution for JSR.
 */
async function library_buildJsrDist(
  isDev: boolean,
  libName: string,
  mainDir: string,
  distJsrDirName: string,
  distJsrBuilder: BundlerName,
  coreEntryFile: string,
  libsList: Record<string, LibConfig>,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  unifiedBundlerOutExt: NpmOutExt,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  libTranspileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  transpileEsbuild: Esbuild,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrOutFilesExt: NpmOutExt,
): Promise<void> {
  relinka("info", "Building JSR distribution...");

  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, mainDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);
  const outDirBinResolved = path.resolve(distJsrDirNameResolved, "bin");

  await ensuredir(distJsrDirNameResolved);
  await ensuredir(outDirBinResolved);
  relinka("info", `Using JSR builder: ${distJsrBuilder}`);

  // Pick between the entire folder or single file
  // so that "jsr" builder copies everything
  const srcDirectory = coreEntrySrcDirResolved; // entire library folder
  const srcFile = coreEntryFilePath; // single file

  // If the user chose "jsr" bundler, we pass the entire directory for copying
  // Otherwise (bun/unified), pass only the single entry file
  const toBundle = distJsrBuilder === "jsr" ? srcDirectory : srcFile;

  const libConfig = libsList[libName];
  const libDeclarations = libConfig?.libDeclarations ?? false;
  const libDescription = libConfig?.libDescription ?? "";

  await library_bundleWithBuilder(distJsrBuilder, {
    entryFile: toBundle,
    libDeclarations,
    libName,
    outDir: outDirBinResolved,
    timer,
    transpileEsbuild,
    transpileFormat,
    libTranspileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  });

  // Perform common steps for JSR
  await library_performCommonBuildSteps({
    coreEntryFile,
    isJsr: true,
    libName,
    libsList,
    outDirRoot: distJsrDirNameResolved,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
  });

  // Additional JSR-specific transformations
  await convertImportExtensionsJsToTs(outDirBinResolved);
  await renameTsxFiles(outDirBinResolved);
  await createJsrJSON(distJsrDirNameResolved, true, libName, libDescription);

  // Logging
  const dirSize = await getDirectorySize(distJsrDirNameResolved, isDev);
  const filesCount = await outDirBinFilesCount(outDirBinResolved);
  relinka(
    "success",
    `JSR distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
  relinka(
    "success",
    `[${distJsrDirNameResolved}] Successfully created library distribution: ${libName} (${outDirBinResolved}/main.ts) with (${filesCount} files, ${prettyBytes(dirSize)})`,
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
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  transpileEsbuild: Esbuild,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  libTranspileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrOutFilesExt: NpmOutExt,
): Promise<void> {
  // =====================================================
  // [dist-libs/npm] 1. Initialize
  // =====================================================
  const distName = determineDistName(libOutDirRoot, false, libsList);
  relinka(
    "verbose",
    `[${distName}] Starting library_buildNpmDist for: ${libName}`,
  );
  relinka("info", `[${distName}] Building NPM dist for lib: ${libName}...`);

  const libOutDirBinResolved = path.resolve(libOutDirRoot, "bin");
  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);

  // Attempt to find the library-specific source directory
  const libNameSimple = libName.split("/").pop() || libName;
  let libSrcDir = path.join(coreEntrySrcDirResolved, "libs", libNameSimple);

  const libConfig = libsList?.[libName];
  if (libConfig?.libMainFile) {
    // 1) If libDirName is explicitly specified, use it
    if (libConfig.libDirName) {
      libSrcDir = path.join(
        coreEntrySrcDirResolved,
        "libs",
        libConfig.libDirName,
      );
    }
    // 2) Otherwise, try to parse from libMainFile
    else if (libConfig.libMainFile.includes("/")) {
      const libDirMatch = /src\/libs\/([^/]+)\//.exec(libConfig.libMainFile);
      if (libDirMatch?.[1]) {
        libSrcDir = path.join(coreEntrySrcDirResolved, "libs", libDirMatch[1]);
      } else {
        // fallback
        const parsedPath = path.parse(libConfig.libMainFile);
        if (parsedPath.dir) {
          const firstDir = parsedPath.dir.split("/")[0];
          if (firstDir) {
            libSrcDir = path.join(coreEntrySrcDirResolved, "libs", firstDir);
          }
        }
      }
    }
  }

  // Construct the full entry file
  const fullEntryFilePath = path.join(libSrcDir, path.basename(libEntryFile));

  const libDeclarations = libConfig?.libDeclarations ?? false;

  // =====================================================
  // [dist-libs/npm] 2. Build using the chosen bundler
  // =====================================================
  await library_bundleWithBuilder(distNpmBuilder, {
    entryFile: fullEntryFilePath,
    libDeclarations,
    libName,
    outDir: libOutDirBinResolved,
    timer,
    transpileEsbuild,
    transpileFormat,
    libTranspileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  });

  // =====================================================
  // [dist-libs/npm] 3. Perform common library build steps
  // =====================================================
  await library_performCommonBuildSteps({
    coreEntryFile: libEntryFile,
    deleteFiles: false,
    isJsr: false,
    libName,
    libsList,
    outDirRoot: libOutDirRoot,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
  });

  // =====================================================
  // [dist-libs/npm] 4. Finalize
  // =====================================================
  const dirSize = await getDirectorySize(libOutDirRoot, isDev);
  const filesCount = await outDirBinFilesCount(libOutDirBinResolved);
  relinka(
    "success",
    `[${libOutDirRoot}] Successfully created library distribution: ${libName} (${libOutDirRoot}/main.js) with (${filesCount} files, ${prettyBytes(dirSize)})`,
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
  libTranspileMinify: boolean,
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
      minify: libTranspileMinify,
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
 * Bundles a library project using JSR by copying the entire directory or file.
 */
async function library_bundleUsingJsr(
  src: string,
  dest: string,
): Promise<void> {
  relinka("info", `Starting library JSR bundle: ${src} -> ${dest}`);
  await ensuredir(path.dirname(dest));

  // If 'src' is a directory, copy everything inside.
  // If 'src' is a file, copy just that file.
  const stats = await fs.stat(src);
  const isDirectory = stats.isDirectory();

  try {
    if (isDirectory) {
      relinka("verbose", `Copying library directory from ${src} to ${dest}`);
      const files = await fs.readdir(src);
      await ensuredir(dest);

      for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        await fs.copy(srcPath, destPath);
      }
    } else {
      // It's a file — copy it directly
      await fs.copy(src, path.join(dest, path.basename(src)));
    }
    relinka("verbose", `Copied from ${src} to ${dest}`);
    relinka("success", "Completed library JSR bundling");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Builds using a unified builder for library projects (rollup, mkdist, etc.).
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
  libTranspileMinify: boolean,
  transpileSourcemap: Sourcemap,
  timer: PerfTimer,
  libDeclarations: boolean,
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

    // Validate extension
    if (!validExtensions.includes(unifiedBundlerOutExt)) {
      relinka(
        "warn",
        `Invalid output extension: ${unifiedBundlerOutExt}, defaulting to 'js'`,
      );
      unifiedBundlerOutExt = "js";
    }

    // Prepare the configuration
    const unifiedBuildConfig = {
      clean: false,
      concurrency: CONCURRENCY_DEFAULT,
      declaration: libDeclarations,
      entries: [
        {
          builder,
          ext: unifiedBundlerOutExt,
          // If using mkdist, pass directory. Otherwise, pass the file.
          input: builder === "mkdist" ? coreEntrySrcDir : coreEntryFile,
          outDir: outDirBin,
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
      showOutLog: true,
      transpileStub: transpileStub,
      transpileWatch: transpileWatch ?? false,
    } satisfies UnifiedBuildConfig & { concurrency?: number };

    await unifiedBuild(rootDir, transpileStub, unifiedBuildConfig, outDirBin);

    // Calculate and log build duration
    const durationSeconds = (getElapsedPerfTime(timer) / 1000).toFixed(2);
    relinka(
      "success",
      `Library bundle completed in ${durationSeconds}s using ${builder} builder.`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Failed to bundle library using ${builder}: ${errorMessage}`,
    );

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
 * Centralized helper to handle bundling with "jsr", "bun", or "unified" logic.
 */
async function library_bundleWithBuilder(
  builder: BundlerName,
  params: {
    entryFile: string;
    libDeclarations: boolean;
    libName: string;
    outDir: string;
    timer: PerfTimer;
    transpileEsbuild: Esbuild;
    transpileFormat: transpileFormat;
    libTranspileMinify: boolean;
    transpilePublicPath: string;
    transpileSourcemap: Sourcemap;
    transpileSplitting: boolean;
    transpileStub: boolean;
    transpileTarget: transpileTarget;
    transpileWatch: boolean;
    unifiedBundlerOutExt: NpmOutExt;
  },
): Promise<void> {
  const {
    entryFile,
    libDeclarations,
    libName,
    outDir,
    timer,
    transpileEsbuild,
    transpileFormat,
    libTranspileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  } = params;

  // Decide which bundling approach to use
  if (builder === "jsr") {
    await library_bundleUsingJsr(entryFile, outDir);
    return;
  }

  if (builder === "bun") {
    // Bundling with Bun
    await library_bundleUsingBun(
      entryFile,
      outDir,
      libName,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      libTranspileMinify,
      transpileSourcemap,
      transpilePublicPath,
      timer,
    );
    return;
  }

  // Otherwise, use one of the "unified" bundlers (rollup, mkdist, etc.)
  await library_bundleUsingUnified(
    entryFile,
    outDir,
    builder,
    path.dirname(entryFile),
    unifiedBundlerOutExt,
    transpileStub,
    transpileWatch,
    transpileEsbuild,
    libTranspileMinify,
    transpileSourcemap,
    timer,
    libDeclarations,
  );
}

/**
 * Common library build steps shared between JSR and NPM distributions.
 */
async function library_performCommonBuildSteps({
  coreEntryFile,
  deleteFiles = true,
  isJsr,
  libName,
  libsList,
  outDirRoot,
  rmDepsMode,
  rmDepsPatterns,
  unifiedBundlerOutExt,
  distJsrOutFilesExt,
}: {
  coreEntryFile: string;
  deleteFiles?: boolean;
  isJsr: boolean;
  libName: string;
  libsList: Record<string, LibConfig>;
  outDirRoot: string;
  rmDepsMode: ExcludeMode;
  rmDepsPatterns: string[];
  unifiedBundlerOutExt: NpmOutExt;
  distJsrOutFilesExt: NpmOutExt;
}): Promise<void> {
  const outDirBin = path.resolve(outDirRoot, "bin");

  // Create package.json for this library distribution
  await library_createPackageJSON(
    libName,
    outDirRoot,
    isJsr,
    libsList,
    rmDepsMode,
    rmDepsPatterns,
    unifiedBundlerOutExt,
  );

  if (deleteFiles) {
    await deleteSpecificFiles(outDirBin);
  }

  // Copy root-level files (README.md, LICENSE, etc.)
  const FILES_TO_COPY = ["README.md", "LICENSE"];
  await copyRootFile(outDirRoot, FILES_TO_COPY);
  relinka("verbose", `Copied root files to ${outDirRoot}`);

  // Convert internal alias imports (~/...) to relative
  await convertImportPaths({
    aliasPrefix: "~/",
    baseDir: outDirBin,
    fromType: "alias",
    libsList,
    strip: [`libs/${libsList[libName].libDirName}`],
    toType: "relative",
  });

  // Rename the main entry file (e.g. sdk-main.js -> main.js).
  await renameEntryFile(
    isJsr,
    outDirBin,
    coreEntryFile,
    unifiedBundlerOutExt,
    distJsrOutFilesExt,
  );
}

/**
 * Reverts any changes made by `preBuildReplacements`.
 * Accepts the array of replaced files from pre-build.
 * Writes back the original content for each file.
 */
async function postBuildReplacements(
  replacedFiles: ReplacementRecord[],
): Promise<void> {
  for (const rec of replacedFiles) {
    try {
      await fs.writeFile(rec.filePath, rec.originalContent, "utf-8");
      relinka("verbose", `Reverted changes in ${rec.filePath}`);
    } catch (err) {
      throw new Error(
        `Failed to revert file ${rec.filePath}: ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Scans all .ts files in the given directory (recursively).
 * For each line that ends with `// relidler-replace-me`,
 * remove that line and replace with the entire content of `src/types.ts`.
 * Returns an array describing changed files, so we can revert them later.
 */
async function preBuildReplacements(
  librarySrcDir: string,
): Promise<ReplacementRecord[]> {
  // We'll store each changed file's original and new content
  const replacedFiles: ReplacementRecord[] = [];

  // The file we want to inject. TODO: implement auto paths.
  const typesPath = path.join(PROJECT_ROOT, "src", "types.ts");
  if (!(await fs.pathExists(typesPath))) {
    throw new Error(`Cannot find source types file: ${typesPath}`);
  }
  const typesContent = await fs.readFile(typesPath, "utf-8");

  // We'll gather all .ts files from 'librarySrcDir' recursively
  const allFiles: string[] = [];
  await collectTsFilesRecursively(librarySrcDir, allFiles);

  // Process each .ts file
  for (const filePath of allFiles) {
    const originalCode = await fs.readFile(filePath, "utf-8");

    // Use MagicString to do line-based replacements
    const magic = new MagicString(originalCode);
    let hasAtLeastOneReplacement = false;

    // We'll search for lines that end with `// relidler-replace-me`
    // i.e. something like: `export * from "../../types.js"; // relidler-replace-me`
    const regex = /^.*\/\/\s*relidler-replace-me\s*$/gm;

    let match: null | RegExpExecArray;
    while ((match = regex.exec(originalCode)) !== null) {
      hasAtLeastOneReplacement = true;

      const startIdx = match.index; // start of the entire line
      const endIdx = startIdx + match[0].length; // end of that line

      // Overwrite that entire line with the content from 'types.ts'
      // plus a newline to separate it
      magic.overwrite(startIdx, endIdx, `${typesContent}\n`);
    }

    if (hasAtLeastOneReplacement) {
      // Get final replaced content
      const updatedCode = magic.toString();

      // For safety, do a quick check if the result changed
      if (updatedCode === originalCode) {
        throw new Error(
          `Logic error: found 'relidler-replace-me' but content did not change in ${filePath}`,
        );
      }

      // Save the replaced file so we can revert later
      replacedFiles.push({
        filePath,
        newContent: updatedCode,
        originalContent: originalCode,
      });

      // Write the updated code back to disk
      await fs.writeFile(filePath, updatedCode, "utf-8");
      relinka("info", `Applied pre-build replacement in ${filePath}`);
    }
  }

  return replacedFiles;
}
