import { build as bunBuild } from "bun";
import fs from "fs-extra";
import path from "pathe";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";

import type { UnifiedBuildConfig } from "~/libs/sdk/sdk-main.js";
import type {
  BundlerName,
  ExcludeMode,
  NpmOutExt,
  Sourcemap,
  transpileFormat,
  transpileTarget,
} from "~/libs/sdk/sdk-types.js";

import { build as unifiedBuild } from "~/libs/sdk/sdk-impl/build/bundlers/unified/build.js";
import {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
} from "~/libs/sdk/sdk-impl/utils/utils-build.js";
import {
  CONCURRENCY_DEFAULT,
  PROJECT_ROOT,
  validExtensions,
} from "~/libs/sdk/sdk-impl/utils/utils-consts.js";
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
import { regular_createPackageJSON } from "~/libs/sdk/sdk-impl/utils/utils-pkg-json-reg.js";
import { createTSConfig } from "~/libs/sdk/sdk-impl/utils/utils-tsconfig.js";

import { ensuredir } from "./bundlers/unified/utils.js";

/**
 * Builds a regular JSR distribution.
 * - Copies the entire source directory if `distJsrBuilder` = "jsr"
 * - Otherwise uses bun or a "unified" bundler.
 */
export async function regular_buildJsrDist(
  isDev: boolean,
  isJsr: boolean,
  coreIsCLI: boolean,
  coreEntrySrcDir: string,
  distJsrDirName: string,
  distJsrBuilder: BundlerName,
  coreEntryFile: string,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  timer: PerfTimer,
  transpileStub: boolean,
  transpileWatch: boolean,
  distJsrGenTsconfig: boolean,
  coreDeclarations: boolean,
): Promise<void> {
  relinka("info", "Building JSR distribution...");

  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);
  const outDirBin = path.resolve(distJsrDirNameResolved, "bin");

  await ensuredir(distJsrDirNameResolved);
  await ensuredir(outDirBin);
  relinka("info", `Using JSR builder: ${distJsrBuilder}`);

  // Decide how to do the bundling
  await regular_bundleWithBuilder(distJsrBuilder, {
    coreDeclarations,
    outDir: outDirBin,
    packageName: "", // not strictly needed, keeping it for logs
    singleFile: coreEntryFilePath, // single entry (used if "bun"/"unified")
    srcDir: coreEntrySrcDirResolved, // entire dir (used if "jsr")
    timer,
    transpileFormat,
    transpileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  });

  // Perform standard steps after bundling
  await regular_performCommonBuildSteps({
    coreIsCLI,
    isJsr,
    outDirBin,
    outDirRoot: distJsrDirNameResolved,
    rmDepsMode,
    unifiedBundlerOutExt,
  });

  // Additional JSR-specific transformations
  await convertImportExtensionsJsToTs(outDirBin);
  await renameTsxFiles(outDirBin);
  await createJsrJSON(distJsrDirNameResolved, false);

  // Optionally generate a tsconfig if it's a CLI in JSR mode
  if (coreIsCLI && isJsr && distJsrGenTsconfig) {
    await createTSConfig(distJsrDirNameResolved, true);
  }

  const dirSize = await getDirectorySize(distJsrDirNameResolved, isDev);
  const filesCount = await outDirBinFilesCount(outDirBin);
  relinka(
    "success",
    `[${distJsrDirNameResolved}] Successfully created regular distribution: "dist-jsr" (${outDirBin}/main.ts) with (${filesCount} files (${prettyBytes(
      dirSize,
    )}))`,
  );
}

/**
 * Builds a regular NPM distribution.
 * - Copies entire src dir if "jsr"
 * - Otherwise uses Bun or a unified builder
 */
export async function regular_buildNpmDist(
  isDev: boolean,
  coreEntrySrcDir: string,
  distNpmDirName: string,
  distNpmBuilder: BundlerName,
  coreEntryFile: string,
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  coreIsCLI: boolean,
  transpileTarget: transpileTarget,
  transpileFormat: transpileFormat,
  transpileSplitting: boolean,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  transpilePublicPath: string,
  transpileStub: boolean,
  transpileWatch: boolean,
  timer: PerfTimer,
  coreDeclarations: boolean,
): Promise<void> {
  relinka("info", "Building NPM distribution...");

  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distNpmDirNameResolved = path.resolve(PROJECT_ROOT, distNpmDirName);
  const outDirBin = path.resolve(distNpmDirNameResolved, "bin");

  await ensuredir(distNpmDirNameResolved);
  await ensuredir(outDirBin);
  relinka("info", `Using NPM builder: ${distNpmBuilder}`);

  // Decide how to do the bundling
  await regular_bundleWithBuilder(distNpmBuilder, {
    coreDeclarations,
    outDir: outDirBin,
    packageName: "", // For logging
    singleFile: coreEntryFilePath,
    srcDir: coreEntrySrcDirResolved,
    timer,
    transpileFormat,
    transpileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  });

  // Perform standard steps after bundling
  await regular_performCommonBuildSteps({
    coreIsCLI,
    isJsr: false,
    outDirBin,
    outDirRoot: distNpmDirNameResolved,
    rmDepsMode,
    unifiedBundlerOutExt,
  });

  const dirSize = await getDirectorySize(distNpmDirNameResolved, isDev);
  const filesCount = await outDirBinFilesCount(outDirBin);
  relinka(
    "success",
    `NPM distribution built successfully (${filesCount} files, ${prettyBytes(dirSize)})`,
  );
  relinka(
    "success",
    `[${distNpmDirNameResolved}] Successfully created regular distribution: "dist-npm" (${outDirBin}/main.js) with (${filesCount} files (${prettyBytes(
      dirSize,
    )}))`,
  );
}

/**
 * Bundles a regular project using Bun.
 */
async function regular_bundleUsingBun(
  coreEntryFile: string,
  outDirBin: string,
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
    `Bundling regular project using Bun (entry: ${coreEntryFile}, outDir: ${outDirBin})`,
  );

  if (!(await fs.pathExists(coreEntryFile))) {
    relinka("error", `Could not find entry file at: ${coreEntryFile}`);
    throw new Error(`Entry file not found: ${coreEntryFile}`);
  }

  try {
    const buildResult = await bunBuild({
      banner: "/* Bundled by @reliverse/relidler */",
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
      publicPath: transpilePublicPath || "/",
      sourcemap: getBunSourcemapOption(transpileSourcemap),
      splitting: transpileSplitting,
      target: transpileTarget,
      throw: true,
    });

    // Build duration
    const duration = getElapsedPerfTime(timer);
    const transpileFormattedDuration = prettyMilliseconds(duration, {
      verbose: true,
    });
    relinka(
      "success",
      `Regular bun build completed in ${transpileFormattedDuration} with ${buildResult.outputs.length} output file(s).`,
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
      `Regular build failed while using bun bundler: ${errorMessage}`,
    );

    const enhancedError = new Error(
      `Regular bundle failed for ${outDirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }
    throw enhancedError;
  }
}

/**
 * Bundles a regular project using JSR by copying the source directory.
 */
async function regular_bundleUsingJsr(
  src: string,
  dest: string,
): Promise<void> {
  relinka("info", `Starting regular_bundleUsingJsr: ${src} -> ${dest}`);
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
    relinka("success", "Completed regular JSR bundling");
  } catch (error) {
    // Fallback if there's an error
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Bundles a regular project using a unified builder (rollup, mkdist, etc.).
 */
async function regular_bundleUsingUnified(
  coreEntryFile: string,
  outDirBin: string,
  builder: BundlerName,
  unifiedBundlerOutExt: NpmOutExt,
  coreEntrySrcDir: string,
  transpileStub: boolean,
  transpileWatch: boolean,
  transpileTarget: transpileTarget,
  transpileMinify: boolean,
  transpileSourcemap: Sourcemap,
  timer: PerfTimer,
  coreDeclarations: boolean,
): Promise<void> {
  if (builder === "jsr" || builder === "bun") {
    throw new Error(
      "'jsr'/'bun' builder not supported for regular_bundleUsingUnified",
    );
  }

  try {
    relinka(
      "verbose",
      `Starting regular_bundleUsingUnified (builder: ${builder}): ${coreEntryFile} -> ${outDirBin}`,
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

    // For mkdist, pass the entire directory
    // For other unified builders, pass the single file
    const input =
      builder === "mkdist" ? path.dirname(coreEntryFile) : coreEntryFile;

    const unifiedBuildConfig = {
      clean: false,
      concurrency: CONCURRENCY_DEFAULT,
      declaration: coreDeclarations,
      entries: [
        {
          builder,
          ext: unifiedBundlerOutExt,
          input: builder === "mkdist" ? rootDir : input,
          outDir: outDirBin,
        },
      ],
      rollup: {
        emitCJS: false,
        esbuild: {
          minify: transpileMinify,
          target: transpileTarget,
        },
        inlineDependencies: true,
        output: {
          sourcemap: getUnifiedSourcemapOption(transpileSourcemap),
        },
      },
      showOutLog: true,
      transpileStub,
      transpileWatch: transpileWatch ?? false,
    } satisfies UnifiedBuildConfig & { concurrency?: number };

    await unifiedBuild(rootDir, transpileStub, unifiedBuildConfig, outDirBin);

    // Calculate and log build duration
    const duration = getElapsedPerfTime(timer);
    const transpileFormattedDuration = prettyMilliseconds(duration, {
      verbose: true,
    });
    relinka(
      "success",
      `Regular bundle completed in ${transpileFormattedDuration} using ${builder} builder`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka(
      "error",
      `Failed to bundle regular project using ${builder}: ${errorMessage}`,
    );

    const enhancedError = new Error(
      `Regular bundle failed for ${outDirBin}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      enhancedError.stack = error.stack;
    }
    throw enhancedError;
  }
}

/**
 * Helper function to decide bundler approach: "jsr" vs "bun" vs "unified".
 */
async function regular_bundleWithBuilder(
  builder: BundlerName,
  params: {
    coreDeclarations: boolean;
    outDir: string;
    packageName?: string;
    singleFile: string; // single entry file (used if bun/unified)
    srcDir: string; // entire directory (used if builder=jsr)
    timer: PerfTimer;
    transpileFormat: transpileFormat;
    transpileMinify: boolean;
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
    coreDeclarations,
    outDir,
    singleFile,
    srcDir,
    timer,
    transpileFormat,
    transpileMinify,
    transpilePublicPath,
    transpileSourcemap,
    transpileSplitting,
    transpileStub,
    transpileTarget,
    transpileWatch,
    unifiedBundlerOutExt,
  } = params;

  // The "jsr" builder is basically a directory copy
  if (builder === "jsr") {
    await regular_bundleUsingJsr(srcDir, outDir);
    return;
  }

  // The "bun" builder uses a single entry file
  if (builder === "bun") {
    await regular_bundleUsingBun(
      singleFile,
      outDir,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      transpileMinify,
      transpileSourcemap,
      transpilePublicPath,
      timer,
    );
    return;
  }

  // Everything else is a "unified" type builder (rollup, mkdist, etc.)
  await regular_bundleUsingUnified(
    singleFile,
    outDir,
    builder,
    unifiedBundlerOutExt,
    // For mkdist, we pass the directory. For others, we pass the single file
    path.dirname(singleFile),
    transpileStub,
    transpileWatch,
    transpileTarget,
    transpileMinify,
    transpileSourcemap,
    timer,
    coreDeclarations,
  );
}

/**
 * Common build steps shared between JSR and NPM distributions.
 * - Convert imports, rename main entry file, optionally delete files, etc.
 */
async function regular_performCommonBuildSteps({
  coreIsCLI,
  deleteFiles = true,
  isJsr,
  outDirBin,
  outDirRoot,
  rmDepsMode,
  unifiedBundlerOutExt,
}: {
  coreIsCLI: boolean;
  deleteFiles?: boolean;
  isJsr: boolean;
  outDirBin: string;
  outDirRoot: string;
  rmDepsMode: ExcludeMode;
  unifiedBundlerOutExt: NpmOutExt;
}): Promise<void> {
  // Convert any "~/..." alias imports to relative
  await convertImportPaths({
    aliasPrefix: "~/",
    baseDir: outDirBin,
    fromType: "alias",
    libsList: {},
    toType: "relative",
  });

  // Delete undesired files
  if (deleteFiles) {
    await deleteSpecificFiles(outDirBin);
  }

  // Create a package.json for this distribution
  await regular_createPackageJSON(
    outDirRoot,
    isJsr,
    coreIsCLI,
    unifiedBundlerOutExt,
    rmDepsMode,
    [],
  );

  // Copy some root files (README, LICENSE, etc.)
  await copyRootFile(outDirRoot, ["README.md", "LICENSE"]);

  // Optionally copy a few more if it's JSR
  if (isJsr) {
    await copyRootFile(outDirRoot, [
      ".gitignore",
      "reliverse.jsonc",
      "drizzle.config.ts",
      "schema.json",
    ]);
  }
}
