// apps/dler/src/cmds/build/cmd.ts

import type { BuildOptions } from "@reliverse/dler-build";
import {
  applyPresets,
  runBuildOnAllPackages,
  validateAndExit,
} from "@reliverse/dler-build";
import { replaceExportsInPackages } from "@reliverse/dler-helpers";
import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";

export default defineCommand({
  meta: {
    name: "build",
    description:
      "Build all workspace packages using configurable bundler (mkdist for libraries, bun for apps) with dler.ts configuration. Auto-detects frontend apps and libraries. Supports presets: --production, --dev, --library, --react, --node, --monorepo.",
    examples: [
      "dler build",
      'dler build --filter "@reliverse/dler-prompt,@reliverse/dler-build"',
      'dler build --filter "@reliverse/dler-*"',
      'dler build --ignore "@reliverse/*"',
      'dler build --ignore "@reliverse/dler-colors" --ignore "@reliverse/dler-v1"',
      'dler build --ignore "@reliverse/dler-colors @reliverse/dler-v1"',
      "dler build --cwd /path/to/monorepo",
      "dler build --cwd /path/to/monorepo --ignore @reliverse/*",
      "dler build --concurrency 8",
      "dler build --concurrency 2 --stopOnError",
      "dler build --ignore @reliverse/* --concurrency 6 --stopOnError",
      "dler build --verbose",
      "dler build --verbose --ignore @reliverse/*",
      "dler build --verbose --concurrency 2 --stopOnError",
      "dler build --watch",
      "dler build --watch --verbose",
      "dler build --target node --format cjs",
      "dler build --minify --sourcemap linked",
      "dler build --target browser --format esm --splitting false",
      "dler build --external react --external react-dom",
      "dler build --watch --target browser --minify --sourcemap inline",
      "dler build --production",
      "dler build --dev",
      "dler build --bytecode --format cjs --target bun",
      "dler build --minifyWhitespace --minifySyntax --minifyIdentifiers",
      "dler build --drop console.log --drop debugger",
      'dler build --env PUBLIC_* --define \'{"__VERSION__":"1.0.0"}\'',
      "dler build --banner 'use client' --footer '// built with dler'",
      "dler build --entryNaming '[dir]/[name].[ext]' --chunkNaming '[name]-[hash].[ext]'",
      "dler build --compile --production",
      "dler build --noCache --verbose",
      "dler build --packages external --external 'react*'",
      "dler build --publicPath /assets/ --root ./src",
      "",
      "# Standalone Executable Examples:",
      "dler build --compile --production --target bun",
      "dler build --compile --target node --format cjs --minify",
      "dler build --compile --bytecode --format cjs --target bun",
      "dler build --compile --windowsIcon app.ico --windowsTitle 'My App'",
      "dler build --compile --production --env inline --drop console.log",
      "",
      "# Note: --compile generates executables alongside bundles",
      "# For Bun executables, use --target bun --format cjs --bytecode for best performance",
      "# For Node executables, use --target node --format cjs",
      "",
      "# Preset Examples:",
      "dler build --production  # Optimized for production",
      "dler build --dev         # Development mode with watch",
      "dler build --library     # Library build (external deps)",
      "dler build --react       # React app with JSX support",
      "dler build --node        # Node.js server build",
      "dler build --monorepo    # Monorepo optimized build",
      "",
      "# Bundler Examples:",
      "dler build --bundler mkdist  # Use mkdist bundler (default for libraries)",
      "dler build --bundler bun     # Use Bun bundler (default for apps)",
      "dler build --bundler mkdist --kind library",
      "dler build --bundler bun --kind library",
      "",
      "# Note: mkdist preserves file structure and is ideal for libraries",
      "# bun bundles dependencies and is ideal for applications",
      "",
      "# New Bun bundler features:",
      "dler build --noBundle --target node",
      "dler build --reactFastRefresh --watch",
      "dler build --noClearScreen --watch",
      "dler build --windowsHideConsole --windowsIcon app.ico --compile",
      "dler build --app --serverComponents",
      "dler build --debugDumpServerFiles --debugNoMinify",
      "",
      "# Enhanced Features:",
      "dler build --bundleAnalyzer --performanceMonitoring",
      "dler build --generateTypes --typeCheck",
      "dler build --macros --sideEffects false",
      "dler build --bundleSizeLimit 1048576 --performanceBudget '{\"maxBundleSize\":1048576}'",
      "dler build --imageOptimization --fontOptimization --cssOptimization",
      "dler build --svgAsReact --cssModules --workerSupport",
      "dler build --plugins 'react-refresh,typescript-declarations,bundle-analyzer'",
      "",
      "# Frontend App Examples:",
      "dler build --devServer --watch --open --reactFastRefresh",
      "dler build --production --html --cssChunking --bundleAnalyzer",
      "dler build --target browser --format esm --html --cssChunking --svgAsReact",
      "dler build --devServer --port 8080 --open --cssModules",
      "dler build --html --publicAssets static --cssChunking --imageOptimization",
      "",
      "# Full-stack App Examples:",
      "dler build --target browser --format esm --html --assets public --workerSupport",
      "dler build --devServer --watch --target browser --html --performanceMonitoring",
      "",
      "# Library Examples:",
      "dler build --library --generateTypes --typeCheck",
      "dler build --target bun --format esm --generateTypes --bundleAnalyzer",
      "dler build --target node --format cjs --generateTypes --sideEffects false",
      "",
      "# Configuration Examples:",
      "# Create dler.ts in your monorepo root:",
      "# export default {",
      "#   build: {",
      "#     global: { target: 'bun', format: 'esm' },",
      "#     packages: { 'my-package': { minify: true, generateTypes: true } },",
      "#     patterns: [{ pattern: 'apps/*', config: { target: 'browser', html: true, bundleAnalyzer: true } }]",
      "#   }",
      "# }",
      "",
      "# Note: Configuration is only supported via dler.ts",
      "# package.json build fields are not supported",
      "",
      "# Config Discovery Examples:",
      "dler build --maxConfigDepth 5",
      "",
      "# TSConfig Validation Examples:",
      "dler build --validateTsconfig",
      "dler build --strictTsconfig",
      "dler build --validateTsconfig --verbose",
      "dler build --noValidateTsconfig",
      "",
      "# Note: --validateTsconfig checks tsconfig.json for common issues",
      "# Use --strictTsconfig to make validation errors fatal",
      "",
      "# DTS Provider Examples:",
      "dler build --dtsProvider dts-bundle-generator",
      "dler build --dtsProvider api-extractor",
      "dler build --dtsProvider typescript",
      "dler build --dtsProvider mkdist",
      "dler build --generateTypes --dtsProvider dts-bundle-generator",
      "",
      "# Note: dts-bundle-generator is the default provider for better bundling",
      "# mkdist provider offers VFS-based processing with automatic relative import resolution",
      "# Use --dtsProvider to override the default provider",
      "",
      "# Go Build Examples:",
      "dler build --go-provider xgo",
      "dler build --go-provider native",
      "dler build --go-targets linux/amd64",
      "dler build --go-targets 'linux/amd64,windows/amd64,darwin/arm64'",
      "dler build --go-output-dir release",
      "dler build --go-output-name my-binary",
      "dler build --go-build-mode c-shared",
      "dler build --go-ldflags '-s -w -X main.version=1.0.0'",
      "dler build --go-main-file main.go",
      "dler build --go-version 1.21.0",
      "dler build --go-enable",
      "",
      "# Note: Go build is auto-detected if .go files exist in the package",
      "# Use --go-enable to explicitly enable, or configure in dler.ts",
      "# Use --go-provider xgo for cross-compilation (requires xgo installed)",
      "# Use --go-provider native for native builds (limited cross-compilation)",
      "",
      "# Build Type Selection Examples:",
      "dler build --go-only",
      "dler build --ts-only",
      "dler build --go-only --go-targets linux/amd64",
      "dler build --ts-only --target node --format cjs",
      "",
      "# Note: --go-only skips TypeScript builds and only builds Go binaries",
      "# Note: --ts-only skips Go builds and only builds TypeScript/JavaScript",
      "# Note: --go-only and --ts-only cannot be used together",
    ],
  },
  args: defineArgs({
    ignore: {
      type: "string",
      description:
        "Package(s) to ignore (supports wildcards like @reliverse/*)",
    },
    filter: {
      type: "string",
      description:
        "Package(s) to include (supports wildcards and comma-separated values like '@reliverse/dler-prompt,@reliverse/dler-build'). Takes precedence over --ignore when both are provided.",
    },
    cwd: {
      type: "string",
      description: "Working directory (monorepo root)",
    },
    concurrency: {
      type: "number",
      description: "Number of packages to build concurrently (default: 5)",
    },
    stopOnError: {
      type: "boolean",
      description:
        "Stop on first error instead of collecting all errors (default: false)",
    },
    verbose: {
      type: "boolean",
      description: "Verbose mode (default: false)",
    },
    watch: {
      type: "boolean",
      description: "Watch mode for hot rebuild (default: false)",
    },
    bundler: {
      type: "string",
      description:
        "Bundler to use: bun (fast, bundles deps) or mkdist (preserves structure, default for libraries)",
    },
    target: {
      type: "string",
      description: "Build target: browser, bun, or node (default: bun)",
    },
    format: {
      type: "string",
      description: "Output format: esm, cjs, or iife (default: esm)",
    },
    minify: {
      type: "boolean",
      description: "Enable all minification options (default: false)",
    },
    minifyWhitespace: {
      type: "boolean",
      description: "Minify whitespace (default: false)",
    },
    minifySyntax: {
      type: "boolean",
      description: "Minify syntax and inline constants (default: false)",
    },
    minifyIdentifiers: {
      type: "boolean",
      description: "Minify variable and function identifiers (default: false)",
    },
    sourcemap: {
      type: "string",
      description:
        "Sourcemap option: none, linked, inline, or external (default: none)",
    },
    splitting: {
      type: "boolean",
      description: "Enable code splitting (default: true)",
    },
    external: {
      type: "string",
      description:
        "External packages to exclude from bundle (supports wildcards)",
    },
    bytecode: {
      type: "boolean",
      description:
        "Generate bytecode for faster cold starts (requires format: cjs, target: bun)",
    },
    drop: {
      type: "string",
      description: "Drop function calls (e.g., 'console.log', 'debugger')",
    },
    packages: {
      type: "string",
      description:
        "How to handle dependencies: bundle or external (default: bundle)",
    },
    publicPath: {
      type: "string",
      description: "Prefix for import paths in bundled code",
    },
    root: {
      type: "string",
      description: "Project root for resolving relative paths",
    },
    define: {
      type: "string",
      description:
        'Define global constants (JSON format, e.g., \'{"__VERSION__":"1.0.0"}\')',
    },
    naming: {
      type: "string",
      description: "Customize output file naming (JSON format)",
    },
    env: {
      type: "string",
      description:
        "Environment variable handling: inline, disable, or prefix like PUBLIC_*",
    },
    banner: {
      type: "string",
      description: "Add banner to bundled code (e.g., 'use client')",
    },
    footer: {
      type: "string",
      description: "Add footer to bundled code",
    },
    conditions: {
      type: "string",
      description: "Package.json exports conditions for import resolution",
    },
    loader: {
      type: "string",
      description: "Custom loaders for file extensions (JSON format)",
    },
    ignoreDCEAnnotations: {
      type: "boolean",
      description: "Ignore dead code elimination annotations",
    },
    emitDCEAnnotations: {
      type: "boolean",
      description: "Force emit dead code elimination annotations",
    },
    throw: {
      type: "boolean",
      description: "Throw on build errors instead of returning success: false",
    },
    production: {
      type: "boolean",
      description:
        "Enable production mode (minify=true, sourcemap=none, env=inline)",
    },
    dev: {
      type: "boolean",
      description:
        "Enable development mode (watch=true, sourcemap=linked, env=disable)",
    },
    library: {
      type: "boolean",
      description:
        "Enable library mode (packages=external, bundler=mkdist, generateTypes=true)",
    },
    react: {
      type: "boolean",
      description: "Enable React preset (jsx=automatic, target=browser)",
    },
    node: {
      type: "boolean",
      description: "Enable Node preset (target=node, format=cjs)",
    },
    monorepo: {
      type: "boolean",
      description:
        "Enable monorepo preset (concurrency=auto, validateTsconfig=true)",
    },
    compile: {
      type: "boolean",
      description: "Generate standalone executable (default: false)",
    },
    allowPrivateBuild: {
      type: "string",
      description:
        "Allow building packages with private: true in package.json. Can be a package name pattern or comma-separated patterns (e.g., '@reliverse/*')",
    },
    replaceExports: {
      type: "boolean",
      description:
        "Replace exports from ./dist/*.js to ./src/*.ts after build (default: false)",
    },
    replaceExportsIgnorePackages: {
      type: "string",
      description:
        "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
    },
    cache: {
      type: "boolean",
      description: "Enable build cache (default: true)",
    },
    noCache: {
      type: "boolean",
      description: "Disable build cache (default: false)",
    },
    generateTypes: {
      type: "boolean",
      description: "Generate TypeScript declaration files (default: false)",
    },
    typeCheck: {
      type: "boolean",
      description: "Run type checking during build (default: false)",
    },
    validateTsconfig: {
      type: "boolean",
      description: "Validate tsconfig.json for common issues (default: true)",
    },
    strictTsconfig: {
      type: "boolean",
      description: "Make tsconfig validation errors fatal (default: false)",
    },
    dtsProvider: {
      type: "string",
      description:
        "DTS generation provider: dts-bundle-generator, api-extractor, typescript, or mkdist (default: dts-bundle-generator)",
    },
    maxConfigDepth: {
      type: "number",
      description:
        "Maximum depth to search for dler.ts config files (default: 3)",
    },
    entryNaming: {
      type: "string",
      description:
        "Naming pattern for entry files (e.g., '[dir]/[name].[ext]')",
    },
    chunkNaming: {
      type: "string",
      description:
        "Naming pattern for chunk files (e.g., '[name]-[hash].[ext]')",
    },
    assetNaming: {
      type: "string",
      description:
        "Naming pattern for asset files (e.g., '[name]-[hash].[ext]')",
    },
    noBundle: {
      type: "boolean",
      description: "Disable bundling (transpile only) (default: false)",
    },
    reactFastRefresh: {
      type: "boolean",
      description: "Enable React Fast Refresh (default: false)",
    },
    noClearScreen: {
      type: "boolean",
      description: "Don't clear screen in watch mode (default: false)",
    },
    windowsHideConsole: {
      type: "boolean",
      description: "Hide console window on Windows (default: false)",
    },
    windowsIcon: {
      type: "string",
      description: "Path to Windows icon file (.ico) for executable",
    },
    windowsTitle: {
      type: "string",
      description: "Windows executable title",
    },
    app: {
      type: "boolean",
      description: "Enable app mode (default: false)",
    },
    serverComponents: {
      type: "boolean",
      description: "Enable server components support (default: false)",
    },
    debugDumpServerFiles: {
      type: "boolean",
      description: "Dump server files for debugging (default: false)",
    },
    debugNoMinify: {
      type: "boolean",
      description: "Disable minification for debugging (default: false)",
    },
    bundleAnalyzer: {
      type: "boolean",
      description: "Enable bundle analyzer (default: false)",
    },
    performanceMonitoring: {
      type: "boolean",
      description: "Enable performance monitoring (default: false)",
    },
    bundleSizeLimit: {
      type: "number",
      description: "Maximum bundle size in bytes (default: unlimited)",
    },
    performanceBudget: {
      type: "string",
      description:
        "Performance budget configuration (JSON format, e.g., '{\"maxBundleSize\":1048576}')",
    },
    imageOptimization: {
      type: "boolean",
      description: "Enable image optimization (default: false)",
    },
    fontOptimization: {
      type: "boolean",
      description: "Enable font optimization (default: false)",
    },
    cssOptimization: {
      type: "boolean",
      description: "Enable CSS optimization (default: false)",
    },
    svgAsReact: {
      type: "boolean",
      description: "Convert SVG to React components (default: false)",
    },
    cssModules: {
      type: "boolean",
      description: "Enable CSS modules (default: false)",
    },
    workerSupport: {
      type: "boolean",
      description: "Enable worker support (default: false)",
    },
    plugins: {
      type: "string",
      description:
        "Comma-separated list of plugins (e.g., 'react-refresh,typescript-declarations')",
    },
    macros: {
      type: "boolean",
      description: "Enable Bun macros (default: false)",
    },
    sideEffects: {
      type: "boolean",
      description: "Mark package as side-effect free (default: false)",
    },
    devServer: {
      type: "boolean",
      description: "Enable development server (default: false)",
    },
    port: {
      type: "number",
      description: "Development server port (default: 3000)",
    },
    open: {
      type: "boolean",
      description: "Open browser on dev server start (default: false)",
    },
    html: {
      type: "boolean",
      description: "Generate HTML file (default: false)",
    },
    cssChunking: {
      type: "boolean",
      description: "Enable CSS chunking (default: false)",
    },
    publicAssets: {
      type: "string",
      description: "Public assets directory (default: 'public')",
    },
    assets: {
      type: "string",
      description: "Assets directory (default: 'assets')",
    },
    goProvider: {
      type: "string",
      description: "Go build provider: xgo or native (default: xgo)",
    },
    goTargets: {
      type: "string",
      description:
        "Go build targets (comma-separated, e.g., 'linux/amd64,windows/amd64')",
    },
    goOutputDir: {
      type: "string",
      description: "Go output directory (default: 'dist')",
    },
    goOutputName: {
      type: "string",
      description: "Go output binary name (default: package name)",
    },
    goBuildMode: {
      type: "string",
      description:
        "Go build mode: default, c-shared, or c-archive (default: default)",
    },
    goLdflags: {
      type: "string",
      description: "Go linker flags (default: '-s -w')",
    },
    goMainFile: {
      type: "string",
      description: "Main Go file to build (default: main.go)",
    },
    goVersion: {
      type: "string",
      description: "Go version for xgo (default: 1.20.3)",
    },
    goOnly: {
      type: "boolean",
      description:
        "Skip TypeScript builds and only build Go binaries (default: false)",
    },
    tsOnly: {
      type: "boolean",
      description:
        "Skip Go builds and only build TypeScript/JavaScript (default: false)",
    },
    goEnable: {
      type: "boolean",
      description: "Enable Go build (default: auto-detect)",
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Validate mutually exclusive flags
      if (args.goOnly && args.tsOnly) {
        logger.error(
          "❌ --go-only and --ts-only cannot be used together. Please use only one.",
        );
        process.exit(1);
      }

      // Transform Go build CLI args into nested go object
      const goOptions: any = {};
      if (args.goProvider) goOptions.provider = args.goProvider;
      if (args.goTargets) {
        // Support comma-separated targets string
        goOptions.targets = args.goTargets;
      }
      if (args.goOutputDir) goOptions.outputDir = args.goOutputDir;
      if (args.goOutputName) goOptions.outputName = args.goOutputName;
      if (args.goBuildMode) goOptions.buildMode = args.goBuildMode;
      if (args.goLdflags) goOptions.ldflags = args.goLdflags;
      if (args.goMainFile) goOptions.mainFile = args.goMainFile;
      if (args.goVersion) goOptions.goVersion = args.goVersion;
      if (args.goEnable !== undefined) goOptions.enable = args.goEnable;

      // Construct build options with Go config if any Go options were provided
      const buildOptionsInput = { ...args } as any;
      if (Object.keys(goOptions).length > 0) {
        buildOptionsInput.go = goOptions;
      }

      // Apply presets and validate options
      const buildOptions = applyPresets(buildOptionsInput as BuildOptions);
      validateAndExit(buildOptions);

      const results = await runBuildOnAllPackages(args.ignore, args.cwd, {
        ...buildOptions,
        allowPrivateBuild: args.allowPrivateBuild,
        filter: args.filter,
      });

      if (results.hasErrors) {
        process.exit(1);
      }

      // Replace exports if enabled (default: false, only when explicitly requested)
      const shouldReplaceExports = args.replaceExports === true;
      if (shouldReplaceExports && !buildOptions.watch) {
        if (args.verbose) {
          logger.info(
            "\n📝 Replacing exports from ./src/*.ts to ./dist/*.js after build...",
          );
        }
        await replaceExportsInPackages({
          direction: "ts-to-js",
          cwd: args.cwd,
          ignorePackages: args.replaceExportsIgnorePackages,
          verbose: args.verbose,
        });
      }

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
