// apps/dler/src/cmds/build/cmd.ts

import type { BuildOptions } from "@reliverse/dler-build";
import { applyPresets, runBuildOnAllPackages, validateAndExit } from "@reliverse/dler-build";
import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { replaceExportsInPackages } from "@reliverse/dler-helpers";

const buildCmd = async (args: any): Promise<void> => {
  try {    
    // Check if running in Bun
    if (typeof process.versions.bun === "undefined") {
      logger.error("❌ This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    // Apply presets and validate options
    const buildOptions = applyPresets(args as any as BuildOptions);
    validateAndExit(buildOptions);

    const results = await runBuildOnAllPackages(args.ignore, args.cwd, {
      ...buildOptions,
      allowPrivateBuild: args.allowPrivateBuild,
    });

    if (results.hasErrors) {
      process.exit(1);
    }

    // Replace exports if enabled (default: false, only when explicitly requested)
    const shouldReplaceExports = args.replaceExports === true;
    if (shouldReplaceExports && !buildOptions.watch) {
      if (args.verbose) {
        logger.info("\n📝 Replacing exports from ./src/*.ts to ./dist/*.js after build...");
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
};

const buildCmdArgs = defineCmdArgs({
  ignore: {
    type: "string",
    description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
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
    description: "Bundler to use: bun (fast, bundles deps) or mkdist (preserves structure, default for libraries)",
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
    description: "Sourcemap option: none, linked, inline, or external (default: none)",
  },
  splitting: {
    type: "boolean",
    description: "Enable code splitting (default: true)",
  },
  external: {
    type: "string",
    description: "External packages to exclude from bundle (supports wildcards)",
  },
  bytecode: {
    type: "boolean",
    description: "Generate bytecode for faster cold starts (requires format: cjs, target: bun)",
  },
  drop: {
    type: "string",
    description: "Drop function calls (e.g., 'console.log', 'debugger')",
  },
  packages: {
    type: "string",
    description: "How to handle dependencies: bundle or external (default: bundle)",
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
    description: "Define global constants (JSON format, e.g., '{\"__VERSION__\":\"1.0.0\"}')",
  },
  naming: {
    type: "string",
    description: "Customize output file naming (JSON format)",
  },
  env: {
    type: "string",
    description: "Environment variable handling: inline, disable, or prefix like PUBLIC_*",
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
    description: "Enable production mode (minify=true, sourcemap=none, env=inline)",
  },
  dev: {
    type: "boolean",
    description: "Enable development mode (minify=false, sourcemap=inline, watch=true)",
  },
  compile: {
    type: "boolean",
    description: "Generate standalone Bun executable",
  },
  cache: {
    type: "boolean",
    description: "Enable build caching (default: true)",
  },
  noCache: {
    type: "boolean",
    description: "Disable build caching",
  },
  entryNaming: {
    type: "string",
    description: "Entry point naming pattern (e.g., '[dir]/[name].[ext]')",
  },
  chunkNaming: {
    type: "string",
    description: "Chunk naming pattern (e.g., '[name]-[hash].[ext]')",
  },
  assetNaming: {
    type: "string",
    description: "Asset naming pattern (e.g., '[name]-[hash].[ext]')",
  },
  // Frontend-specific options
  html: {
    type: "boolean",
    description: "Enable HTML entry point processing (auto-detected for frontend apps)",
  },
  cssChunking: {
    type: "boolean",
    description: "Chunk CSS to reduce duplication (default: true for frontend apps)",
  },
  devServer: {
    type: "boolean",
    description: "Start dev server with HMR (requires --watch)",
  },
  port: {
    type: "number",
    description: "Dev server port (default: 3000)",
  },
  open: {
    type: "boolean",
    description: "Open browser on dev server start",
  },
  publicAssets: {
    type: "string",
    description: "Public assets directory (default: public)",
  },
  jsxRuntime: {
    type: "string",
    description: "JSX runtime: automatic or classic (default: automatic)",
  },
  jsxImportSource: {
    type: "string",
    description: "JSX import source (e.g., 'react' for classic runtime)",
  },
  keepNames: {
    type: "boolean",
    description: "Preserve original function and class names when minifying",
  },
  debug: {
    type: "boolean",
    description: "Enable debug mode with verbose internal logging",
  },
  experimental: {
    type: "string",
    description: "Enable experimental features (comma-separated list)",
  },
  // New Bun bundler features
  noBundle: {
    type: "boolean",
    description: "Transpile only — do not bundle",
  },
  reactFastRefresh: {
    type: "boolean",
    description: "Enable React Fast Refresh transform (for development testing)",
  },
  noClearScreen: {
    type: "boolean",
    description: "Don't clear the terminal when rebuilding with --watch",
  },
  // Windows executable options
  windowsHideConsole: {
    type: "boolean",
    description: "Prevent a console window from opening when running a compiled Windows executable",
  },
  windowsIcon: {
    type: "string",
    description: "Set an icon for the Windows executable",
  },
  windowsTitle: {
    type: "string",
    description: "Set the Windows executable product name",
  },
  windowsPublisher: {
    type: "string",
    description: "Set the Windows executable company name",
  },
  windowsVersion: {
    type: "string",
    description: "Set the Windows executable version (e.g. 1.2.3.4)",
  },
  windowsDescription: {
    type: "string",
    description: "Set the Windows executable description",
  },
  windowsCopyright: {
    type: "string",
    description: "Set the Windows executable copyright notice",
  },
  // Experimental features
  app: {
    type: "boolean",
    description: "(EXPERIMENTAL) Build a web app for production using Bun Bake",
  },
  serverComponents: {
    type: "boolean",
    description: "(EXPERIMENTAL) Enable React Server Components",
  },
  debugDumpServerFiles: {
    type: "boolean",
    description: "When --app is set, dump all server files to disk even for static builds",
  },
  debugNoMinify: {
    type: "boolean",
    description: "When --app is set, disable all minification",
  },
  // Enhanced features
  macros: {
    type: "boolean",
    description: "Enable Bun macros support for compile-time code generation",
  },
  sideEffects: {
    type: "string",
    description: "Configure sideEffects for tree-shaking (boolean or JSON array)",
  },
  bundleAnalyzer: {
    type: "boolean",
    description: "Generate bundle analysis report",
  },
  typeCheck: {
    type: "boolean",
    description: "Run TypeScript type checking during build",
  },
  generateTypes: {
    type: "boolean",
    description: "Generate TypeScript declaration files (.d.ts)",
  },
  bundleSizeLimit: {
    type: "number",
    description: "Set maximum bundle size limit in bytes",
  },
  performanceBudget: {
    type: "string",
    description: "Set performance budget (JSON format)",
  },
  // Asset optimization
  imageOptimization: {
    type: "boolean",
    description: "Enable image optimization (WebP conversion, compression)",
  },
  fontOptimization: {
    type: "boolean",
    description: "Enable font optimization (subsetting, compression)",
  },
  cssOptimization: {
    type: "boolean",
    description: "Enable CSS optimization (purge, minify, autoprefixer)",
  },
  // Modern loaders
  svgAsReact: {
    type: "boolean",
    description: "Transform SVG files into React components",
  },
  cssModules: {
    type: "boolean",
    description: "Enable CSS Modules support",
  },
  workerSupport: {
    type: "boolean",
    description: "Enable Web Worker support",
  },
  // Plugin system
  plugins: {
    type: "string",
    description: "Load custom plugins (comma-separated list)",
  },
  // Performance monitoring
  performanceMonitoring: {
    type: "boolean",
    description: "Enable performance monitoring and reporting",
  },
  bundleAnalysis: {
    type: "boolean",
    description: "Generate detailed bundle analysis",
  },
  maxConfigDepth: {
    type: "number",
    description: "Maximum directory levels to search up for dler.ts config (default: 3)",
  },
  // Package kind and bin definitions
  kind: {
    type: "string",
    description: "Package kind: library, cli, browser-app, or native-app",
  },
  bin: {
    type: "string",
    description: "Binary definitions for CLI packages (e.g., 'dler=dist/cli.js,login=dist/foo/bar/login.js')",
  },
  // TSConfig validation
  strictTsconfig: {
    type: "boolean",
    description: "Make TSConfig validation errors fatal (default: false)",
  },
  validateTsconfig: {
    type: "boolean",
    description: "Validate tsconfig.json files for common issues (default: true)",
  },
  dtsProvider: {
    type: "string",
    description: "Provider for generating .d.ts files: dts-bundle-generator (default), api-extractor, typescript, or mkdist",
  },
  replaceExports: {
    type: "boolean",
    description: "Replace exports from ./src/*.ts to ./dist/*.js after build completes (default: false)",
  },
  replaceExportsIgnorePackages: {
    type: "string",
    description: "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
  },
  allowPrivateBuild: {
    type: "string",
    description: "Allow building private packages (supports wildcards like @reliverse/* to build all packages starting with @reliverse/)",
  },
});

const buildCmdCfg = defineCmdCfg({
  name: "build",
  description: "Build all workspace packages using configurable bundler (mkdist for libraries, bun for apps) with dler.ts configuration. Auto-detects frontend apps and libraries. Supports presets: --production, --dev, --library, --react, --node, --monorepo.",
  examples: [
    "dler build",
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
    "dler build --env PUBLIC_* --define '{\"__VERSION__\":\"1.0.0\"}'",
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
  ],
});

export default defineCmd(buildCmd, buildCmdArgs, buildCmdCfg);
