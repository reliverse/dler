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
import { createPackageJSON } from "~/libs/sdk/sdk-impl/utils/utils-package.js";
import {
  convertImportExtensionsJsToTs,
  convertImportPaths,
} from "~/libs/sdk/sdk-impl/utils/utils-paths.js";
import {
  getElapsedPerfTime,
  type PerfTimer,
} from "~/libs/sdk/sdk-impl/utils/utils-perf.js";
import { createTSConfig } from "~/libs/sdk/sdk-impl/utils/utils-tsconfig.js";

import { ensuredir } from "./bundlers/unified/utils.js";

/**
 * Builds a regular JSR distribution.
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
): Promise<void> {
  relinka("info", "Building JSR distribution...");
  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distJsrDirNameResolved = path.resolve(PROJECT_ROOT, distJsrDirName);
  const outDirBin = path.resolve(distJsrDirNameResolved, "bin");
  await ensuredir(distJsrDirNameResolved);
  await ensuredir(outDirBin);
  relinka("info", `Using JSR builder: ${distJsrBuilder}`);
  if (distJsrBuilder === "jsr") {
    await regular_bundleUsingJsr(coreEntrySrcDirResolved, outDirBin);
  } else if (distJsrBuilder === "bun") {
    await regular_bundleUsingBun(
      coreEntryFilePath,
      outDirBin,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      transpileMinify,
      transpileSourcemap,
      transpilePublicPath,
      "",
      timer,
    );
  } else {
    await regular_bundleUsingUnified(
      coreEntryFilePath,
      outDirBin,
      distJsrBuilder,
      unifiedBundlerOutExt,
      coreEntrySrcDir,
      transpileStub,
      transpileWatch,
      transpileTarget,
      transpileMinify,
      transpileSourcemap,
      timer,
    );
  }
  await regular_performCommonBuildSteps({
    coreEntryFile,
    coreIsCLI,
    isJsr,
    outDirBin,
    outDirRoot: distJsrDirNameResolved,
    rmDepsMode,
    unifiedBundlerOutExt,
  });
  await convertImportExtensionsJsToTs(outDirBin);
  await renameTsxFiles(outDirBin);
  await createJsrJSONC(distJsrDirNameResolved, false);
  if (coreIsCLI && isJsr && distJsrGenTsconfig) {
    await createTSConfig(distJsrDirNameResolved, true);
  }
  const dirSize = await getDirectorySize(distJsrDirNameResolved, isDev);
  const filesCount = await outDirBinFilesCount(outDirBin);
  relinka(
    "success",
    `[${distJsrDirNameResolved}] Successfully created regular distribution: "dist-jsr" (${outDirBin}/main.ts) with (${filesCount} files (${prettyBytes(dirSize)})`,
  );
}

/**
 * Builds a regular NPM distribution.
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
): Promise<void> {
  relinka("info", "Building NPM distribution...");
  const coreEntrySrcDirResolved = path.resolve(PROJECT_ROOT, coreEntrySrcDir);
  const coreEntryFilePath = path.join(coreEntrySrcDirResolved, coreEntryFile);
  const distNpmDirNameResolved = path.resolve(PROJECT_ROOT, distNpmDirName);
  const outDirBin = path.resolve(distNpmDirNameResolved, "bin");
  await ensuredir(distNpmDirNameResolved);
  await ensuredir(outDirBin);
  relinka("info", `Using NPM builder: ${distNpmBuilder}`);
  if (distNpmBuilder === "jsr") {
    await regular_bundleUsingJsr(coreEntrySrcDirResolved, outDirBin);
  } else if (distNpmBuilder === "bun") {
    await regular_bundleUsingBun(
      coreEntryFilePath,
      outDirBin,
      transpileTarget,
      transpileFormat,
      transpileSplitting,
      transpileMinify,
      transpileSourcemap,
      transpilePublicPath,
      "",
      timer,
    );
  } else {
    await regular_bundleUsingUnified(
      coreEntryFilePath,
      outDirBin,
      distNpmBuilder,
      unifiedBundlerOutExt,
      coreEntrySrcDir,
      transpileStub,
      transpileWatch,
      transpileTarget,
      transpileMinify,
      transpileSourcemap,
      timer,
    );
  }
  await regular_performCommonBuildSteps({
    coreEntryFile,
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
    `[${distNpmDirNameResolved}] Successfully created regular distribution: "dist-npm" (${outDirBin}/main.js) with (${filesCount} files (${prettyBytes(dirSize)})`,
  );
}

/**
 * Bundles using Bun for regular projects.
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
  packageName: string,
  timer: PerfTimer,
): Promise<void> {
  relinka(
    "verbose",
    `Bundling regular project using Bun for ${packageName || "main project"} (entry: ${coreEntryFile}, outDir: ${outDirBin})`,
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

    // Calculate and log build duration
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

    // Provide more context in the error message
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
  relinka(
    "info",
    `Starting regular_bundleUsingJsr (builder: jsr): ${src} -> ${dest}`,
  );
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
    // Handle errors gracefully with fallback to original source
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest);
  }
}

/**
 * Builds using a unified builder for main project.
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

    // Validate and normalize the output file extension
    if (!validExtensions.includes(unifiedBundlerOutExt)) {
      relinka(
        "warn",
        `Invalid output extension: ${unifiedBundlerOutExt}, defaulting to 'js'`,
      );
      unifiedBundlerOutExt = "js";
    }

    // Determine source directory and input path
    const srcDir = coreEntrySrcDir || "src";
    const resolvedSrcDir = path.resolve(PROJECT_ROOT, srcDir);

    // For mkdist, we need to use the directory containing the entry file, not the file itself
    const input =
      builder === "mkdist" ? path.dirname(coreEntryFile) : coreEntryFile;

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
          input: builder === "mkdist" ? resolvedSrcDir : input,
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
      transpileStub: transpileStub,
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

    // Provide more context in the error message
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
 * Common build steps shared between JSR and NPM distributions
 */
async function regular_performCommonBuildSteps({
  coreEntryFile,
  coreIsCLI,
  deleteFiles = true,
  isJsr,
  outDirBin,
  outDirRoot,
  rmDepsMode,
  unifiedBundlerOutExt,
}: {
  coreEntryFile: string;
  coreIsCLI: boolean;
  deleteFiles?: boolean;
  isJsr: boolean;
  outDirBin: string;
  outDirRoot: string;
  rmDepsMode: ExcludeMode;
  unifiedBundlerOutExt: NpmOutExt;
}): Promise<void> {
  await convertImportPaths({
    aliasPrefix: "~/",
    baseDir: outDirBin,
    fromType: "alias",
    libsList: {},
    toType: "relative",
  });
  await renameEntryFile(isJsr, outDirBin, coreEntryFile, unifiedBundlerOutExt);
  if (deleteFiles) {
    await deleteSpecificFiles(outDirBin);
  }
  await createPackageJSON(
    outDirRoot,
    isJsr,
    coreIsCLI,
    unifiedBundlerOutExt,
    rmDepsMode,
    [],
  );
  await copyRootFile(outDirRoot, ["README.md", "LICENSE"]);
  if (isJsr && true) {
    // coreIsCLI assumed true; adjust if needed
    await copyRootFile(outDirRoot, [
      ".gitignore",
      "reliverse.jsonc",
      "drizzle.config.ts",
      "schema.json",
    ]);
  }
}
