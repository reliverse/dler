import type { BuildOptions } from "@reliverse/build";
import {
  applyPresets,
  runBuildOnAllPackages,
  validateAndExit,
} from "@reliverse/build";
import {
  clearLoggerInternalsInPackages,
  replaceExportsInPackages,
} from "@reliverse/helpers";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  description:
    "Build all workspace packages using configurable bundler (mkdist for libraries, bun for apps) with dler.ts configuration. Auto-detects frontend apps and libraries. Supports presets: --production, --dev, --library, --react, --node, --monorepo.",
  options: {
    ignore: option(type("string | undefined"), {
      description:
        "Package(s) to ignore (supports wildcards like @reliverse/*)",
    }),
    filter: option(type("string | undefined"), {
      description:
        "Package(s) to include (supports wildcards and comma-separated values like '@reliverse/rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
    }),
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    concurrency: option(type("number | undefined"), {
      description: "Number of packages to build concurrently (default: 5)",
    }),
    stopOnError: option(type("boolean | undefined"), {
      description:
        "Stop on first error instead of collecting all errors (default: false)",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose mode (default: false)",
    }),
    watch: option(type("boolean | undefined"), {
      description: "Watch mode for hot rebuild (default: false)",
    }),
    bundler: option(type("string | undefined"), {
      description:
        "Bundler to use: bun (fast, bundles deps) or mkdist (preserves structure, default for libraries)",
    }),
    target: option(type("string | undefined"), {
      description: "Build target: browser, bun, or node (default: bun)",
    }),
    format: option(type("string | undefined"), {
      description: "Output format: esm, cjs, or iife (default: esm)",
    }),
    minify: option(type("boolean | undefined"), {
      description: "Enable all minification options (default: false)",
    }),
    minifyWhitespace: option(type("boolean | undefined"), {
      description: "Minify whitespace (default: false)",
    }),
    minifySyntax: option(type("boolean | undefined"), {
      description: "Minify syntax and inline constants (default: false)",
    }),
    minifyIdentifiers: option(type("boolean | undefined"), {
      description: "Minify variable and function identifiers (default: false)",
    }),
    sourcemap: option(type("string | undefined"), {
      description:
        "Sourcemap option: none, linked, inline, or external (default: none)",
    }),
    splitting: option(type("boolean | undefined"), {
      description: "Enable code splitting (default: true)",
    }),
    external: option(type("string | undefined"), {
      description:
        "External packages to exclude from bundle (supports wildcards)",
    }),
    bytecode: option(type("boolean | undefined"), {
      description:
        "Generate bytecode for faster cold starts (requires format: cjs, target: bun)",
    }),
    drop: option(type("string | undefined"), {
      description: "Drop function calls (e.g., 'console.log', 'debugger')",
    }),
    packages: option(type("string | undefined"), {
      description:
        "How to handle dependencies: bundle or external (default: bundle)",
    }),
    publicPath: option(type("string | undefined"), {
      description: "Prefix for import paths in bundled code",
    }),
    root: option(type("string | undefined"), {
      description: "Project root for resolving relative paths",
    }),
    define: option(type("string | undefined"), {
      description:
        'Define global constants (JSON format, e.g., \'{"__VERSION__":"1.0.0"}\')',
    }),
    naming: option(type("string | undefined"), {
      description: "Customize output file naming (JSON format)",
    }),
    env: option(type("string | undefined"), {
      description:
        "Environment variable handling: inline, disable, or prefix like PUBLIC_*",
    }),
    banner: option(type("string | undefined"), {
      description: "Add banner to bundled code (e.g., 'use client')",
    }),
    footer: option(type("string | undefined"), {
      description: "Add footer to bundled code",
    }),
    conditions: option(type("string | undefined"), {
      description: "Package.json exports conditions for import resolution",
    }),
    loader: option(type("string | undefined"), {
      description: "Custom loaders for file extensions (JSON format)",
    }),
    ignoreDCEAnnotations: option(type("boolean | undefined"), {
      description: "Ignore dead code elimination annotations",
    }),
    emitDCEAnnotations: option(type("boolean | undefined"), {
      description: "Force emit dead code elimination annotations",
    }),
    throw: option(type("boolean | undefined"), {
      description: "Throw on build errors instead of returning success: false",
    }),
    production: option(type("boolean | undefined"), {
      description:
        "Enable production mode (minify=true, sourcemap=none, env=inline)",
    }),
    dev: option(type("boolean | undefined"), {
      description:
        "Enable development mode (watch=true, sourcemap=linked, env=disable)",
    }),
    library: option(type("boolean | undefined"), {
      description:
        "Enable library mode (packages=external, bundler=mkdist, generateTypes=true)",
    }),
    react: option(type("boolean | undefined"), {
      description: "Enable React preset (jsx=automatic, target=browser)",
    }),
    node: option(type("boolean | undefined"), {
      description: "Enable Node preset (target=node, format=cjs)",
    }),
    monorepo: option(type("boolean | undefined"), {
      description:
        "Enable monorepo preset (concurrency=auto, validateTsconfig=true)",
    }),
    compile: option(type("boolean | undefined"), {
      description: "Generate standalone executable (default: false)",
    }),
    allowPrivateBuild: option(type("string | undefined"), {
      description:
        "Allow building packages with private: true in package.json. Can be a package name pattern or comma-separated patterns (e.g., '@reliverse/*')",
    }),
    replaceExports: option(type("boolean | undefined"), {
      description:
        "Replace exports from ./dist/*.js to ./src/*.ts after build (default: false)",
    }),
    replaceExportsIgnorePackages: option(type("string | undefined"), {
      description:
        "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
    }),
    loggerClearInternals: option(type("boolean | undefined"), {
      description:
        "Remove logger.internal() and logInternal() calls from built dist files (default: false)",
    }),
    loggerClearInternalsIgnorePackages: option(type("string | undefined"), {
      description:
        "Packages to ignore when clearing logger internals (supports glob patterns like @reliverse/*)",
    }),
    cache: option(type("boolean | undefined"), {
      description: "Enable build cache (default: true)",
    }),
    noCache: option(type("boolean | undefined"), {
      description: "Disable build cache (default: false)",
    }),
    generateTypes: option(type("boolean | undefined"), {
      description: "Generate TypeScript declaration files (default: false)",
    }),
    typeCheck: option(type("boolean | undefined"), {
      description: "Run type checking during build (default: false)",
    }),
    validateTsconfig: option(type("boolean | undefined"), {
      description: "Validate tsconfig.json for common issues (default: true)",
    }),
    strictTsconfig: option(type("boolean | undefined"), {
      description: "Make tsconfig validation errors fatal (default: false)",
    }),
    dtsProvider: option(type("string | undefined"), {
      description:
        "DTS generation provider: dts-bundle-generator, api-extractor, typescript, or mkdist (default: dts-bundle-generator)",
    }),
    maxConfigDepth: option(type("number | undefined"), {
      description:
        "Maximum depth to search for dler.ts config files (default: 3)",
    }),
    entryNaming: option(type("string | undefined"), {
      description:
        "Naming pattern for entry files (e.g., '[dir]/[name].[ext]')",
    }),
    chunkNaming: option(type("string | undefined"), {
      description:
        "Naming pattern for chunk files (e.g., '[name]-[hash].[ext]')",
    }),
    assetNaming: option(type("string | undefined"), {
      description:
        "Naming pattern for asset files (e.g., '[name]-[hash].[ext]')",
    }),
    noBundle: option(type("boolean | undefined"), {
      description: "Disable bundling (transpile only) (default: false)",
    }),
    reactFastRefresh: option(type("boolean | undefined"), {
      description: "Enable React Fast Refresh (default: false)",
    }),
    noClearScreen: option(type("boolean | undefined"), {
      description: "Don't clear screen in watch mode (default: false)",
    }),
    app: option(type("boolean | undefined"), {
      description: "Enable app mode (default: false)",
    }),
    serverComponents: option(type("boolean | undefined"), {
      description: "Enable server components support (default: false)",
    }),
    debugDumpServerFiles: option(type("boolean | undefined"), {
      description: "Dump server files for debugging (default: false)",
    }),
    debugNoMinify: option(type("boolean | undefined"), {
      description: "Disable minification for debugging (default: false)",
    }),
    bundleAnalyzer: option(type("boolean | undefined"), {
      description: "Enable bundle analyzer (default: false)",
    }),
    performanceMonitoring: option(type("boolean | undefined"), {
      description: "Enable performance monitoring (default: false)",
    }),
    bundleSizeLimit: option(type("number | undefined"), {
      description: "Maximum bundle size in bytes (default: unlimited)",
    }),
    performanceBudget: option(type("string | undefined"), {
      description:
        "Performance budget configuration (JSON format, e.g., '{\"maxBundleSize\":1048576}')",
    }),
    imageOptimization: option(type("boolean | undefined"), {
      description: "Enable image optimization (default: false)",
    }),
    fontOptimization: option(type("boolean | undefined"), {
      description: "Enable font optimization (default: false)",
    }),
    cssOptimization: option(type("boolean | undefined"), {
      description: "Enable CSS optimization (default: false)",
    }),
    svgAsReact: option(type("boolean | undefined"), {
      description: "Convert SVG to React components (default: false)",
    }),
    cssModules: option(type("boolean | undefined"), {
      description: "Enable CSS modules (default: false)",
    }),
    workerSupport: option(type("boolean | undefined"), {
      description: "Enable worker support (default: false)",
    }),
    plugins: option(type("string | undefined"), {
      description:
        "Comma-separated list of plugins (e.g., 'react-refresh,typescript-declarations')",
    }),
    macros: option(type("boolean | undefined"), {
      description: "Enable Bun macros (default: false)",
    }),
    sideEffects: option(type("boolean | undefined"), {
      description: "Mark package as side-effect free (default: false)",
    }),
    devServer: option(type("boolean | undefined"), {
      description: "Enable development server (default: false)",
    }),
    port: option(type("number | undefined"), {
      description: "Development server port (default: 3000)",
    }),
    open: option(type("boolean | undefined"), {
      description: "Open browser on dev server start (default: false)",
    }),
    html: option(type("boolean | undefined"), {
      description: "Generate HTML file (default: false)",
    }),
    cssChunking: option(type("boolean | undefined"), {
      description: "Enable CSS chunking (default: false)",
    }),
    publicAssets: option(type("string | undefined"), {
      description: "Public assets directory (default: 'public')",
    }),
    assets: option(type("string | undefined"), {
      description: "Assets directory (default: 'assets')",
    }),
    kind: option(type("string | undefined"), {
      description: "Package kind: app or library (default: auto-detect)",
    }),
    // CLI-specific options
    entry: option(type("string | undefined"), {
      short: "e",
      description:
        "Entry file (defaults to auto-detect), supports comma-separated multiple entries",
    }),
    outdir: option(type("string | undefined"), {
      short: "o",
      description: "Output directory",
    }),
    outfile: option(type("string | undefined"), {
      description: "Output filename (for single executable)",
    }),
    runtime: option(type("'bun'|'node' | undefined"), {
      short: "r",
      description: "Runtime target (for non-compiled builds)",
    }),
    targets: option(type("string | undefined"), {
      short: "t",
      description: "Target platforms for compilation (e.g., darwin-arm64,linux-x64,all,native)",
    }),
    compress: option(type("boolean | undefined"), {
      description: "Compress multi-target builds into tar.gz files (default: false)",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Apply presets and validate options
      const buildOptions = applyPresets(flags as BuildOptions);
      validateAndExit(buildOptions);

      // If entry is specified, ensure compile is enabled for single-entry builds
      if (flags.entry && flags.targets && !buildOptions.compile) {
        buildOptions.compile = true;
      }

      const results = await runBuildOnAllPackages(flags.ignore, flags.cwd, {
        ...buildOptions,
        allowPrivateBuild: flags.allowPrivateBuild,
        filter: flags.filter,
        // Pass CLI-specific options to build
        entry: flags.entry,
        outdir: flags.outdir,
        outfile: flags.outfile,
        targets: flags.targets,
        runtime: flags.runtime,
        compress: flags.compress,
      });

      if (results.hasErrors) {
        process.exit(1);
      }

      // Post-build operations
      await handlePostBuildOperations(flags, buildOptions, results);

      logger.success("\n✅ All packages built successfully!");
    } catch (error) {
      logger.error("\n❌ Build failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

async function handlePostBuildOperations(flags: any, buildOptions: BuildOptions, results: any) {
  // Replace exports if enabled (default: false, only when explicitly requested)
  const shouldReplaceExports = flags.replaceExports === true;
  if (shouldReplaceExports && !buildOptions.watch) {
    if (flags.verbose) {
      logger.info(
        "\n📝 Replacing exports from ./src/*.ts to ./dist/*.js after build...",
      );
    }
    await replaceExportsInPackages({
      direction: "ts-to-js",
      cwd: flags.cwd,
      ignorePackages: flags.replaceExportsIgnorePackages,
      verbose: flags.verbose,
    });
  }

  // Clear logger internals if enabled (default: false, only when explicitly requested)
  const shouldClearLoggerInternals = flags.loggerClearInternals === true;
  if (shouldClearLoggerInternals) {
    if (buildOptions.watch) {
      if (flags.verbose) {
        logger.warn(
          "\n⚠️  --loggerClearInternals is not supported in watch mode (skipped)",
        );
      }
    } else {
      if (flags.verbose) {
        logger.info(
          "\n🧹 Clearing logger.internal() and logInternal() calls from dist files...",
        );
      }

      // Extract package information from build results
      const allResults = results.results;
      const successfulResults = allResults.filter(
        (result: any) => result.success && !result.skipped,
      );
      const packages = successfulResults.map((result: any) => ({
        name: result.package.name,
        outputDir: result.package.outputDir,
        path: result.package.path,
      }));

      if (flags.verbose) {
        logger.info(
          `   Found ${allResults.length} build result(s), ${successfulResults.length} successful package(s) to process`,
        );
      }

      if (packages.length > 0) {
        const clearResult = await clearLoggerInternalsInPackages({
          packages,
          ignorePackages: flags.loggerClearInternalsIgnorePackages,
          verbose: flags.verbose,
          onLog: flags.verbose ? (msg: string) => logger.info(msg) : undefined,
        });

        if (flags.verbose) {
          logger.info(
            `\n✅ Logger internals cleared: Updated ${clearResult.updated} file(s), skipped ${clearResult.skipped} package(s)`,
          );
          if (
            clearResult.files.length > 0 &&
            clearResult.files.length <= 10
          ) {
            logger.info(
              `   Files updated: ${clearResult.files.join(", ")}`,
            );
          } else if (clearResult.files.length > 10) {
            logger.info(
              `   Files updated: ${clearResult.files.slice(0, 10).join(", ")} ... and ${clearResult.files.length - 10} more`,
            );
          }
        } else {
          logger.info(
            `✅ Logger internals cleared: ${clearResult.updated} file(s) updated`,
          );
        }
      } else {
        if (flags.verbose) {
          logger.warn(
            "   ⚠️  No successful packages found to process (all packages were skipped or failed)",
          );
        }
      }
    }
  }
}

