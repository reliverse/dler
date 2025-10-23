// apps/dler/src/cmds/build/cmd.ts

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { runBuildOnAllPackages } from "./impl";
import { applyPresets } from "./presets";
import type { BuildOptions } from "./types";
import { validateAndExit } from "./validation";

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

    const results = await runBuildOnAllPackages(args.ignore, args.cwd, buildOptions);

    if (results.hasErrors) {
      process.exit(1);
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
    required: false,
  },
  cwd: {
    type: "string",
    description: "Working directory (monorepo root)",
    required: false,
  },
  concurrency: {
    type: "number",
    description: "Number of packages to build concurrently (default: 5)",
    required: false,
  },
  stopOnError: {
    type: "boolean",
    description:
      "Stop on first error instead of collecting all errors (default: false)",
    required: false,
  },
  verbose: {
    type: "boolean",
    description: "Verbose mode (default: false)",
    required: false,
  },
  watch: {
    type: "boolean",
    description: "Watch mode for hot rebuild (default: false)",
    required: false,
  },
  target: {
    type: "string",
    description: "Build target: browser, bun, or node (default: bun)",
    required: false,
  },
  format: {
    type: "string",
    description: "Output format: esm, cjs, or iife (default: esm)",
    required: false,
  },
  minify: {
    type: "boolean",
    description: "Enable all minification options (default: false)",
    required: false,
  },
  minifyWhitespace: {
    type: "boolean",
    description: "Minify whitespace (default: false)",
    required: false,
  },
  minifySyntax: {
    type: "boolean",
    description: "Minify syntax and inline constants (default: false)",
    required: false,
  },
  minifyIdentifiers: {
    type: "boolean",
    description: "Minify variable and function identifiers (default: false)",
    required: false,
  },
  sourcemap: {
    type: "string",
    description: "Sourcemap option: none, linked, inline, or external (default: none)",
    required: false,
  },
  splitting: {
    type: "boolean",
    description: "Enable code splitting (default: true)",
    required: false,
  },
  external: {
    type: "string",
    description: "External packages to exclude from bundle (supports wildcards)",
    required: false,
  },
  bytecode: {
    type: "boolean",
    description: "Generate bytecode for faster cold starts (requires format: cjs, target: bun)",
    required: false,
  },
  drop: {
    type: "string",
    description: "Drop function calls (e.g., 'console.log', 'debugger')",
    required: false,
  },
  packages: {
    type: "string",
    description: "How to handle dependencies: bundle or external (default: bundle)",
    required: false,
  },
  publicPath: {
    type: "string",
    description: "Prefix for import paths in bundled code",
    required: false,
  },
  root: {
    type: "string",
    description: "Project root for resolving relative paths",
    required: false,
  },
  define: {
    type: "string",
    description: "Define global constants (JSON format, e.g., '{\"__VERSION__\":\"1.0.0\"}')",
    required: false,
  },
  naming: {
    type: "string",
    description: "Customize output file naming (JSON format)",
    required: false,
  },
  env: {
    type: "string",
    description: "Environment variable handling: inline, disable, or prefix like PUBLIC_*",
    required: false,
  },
  banner: {
    type: "string",
    description: "Add banner to bundled code (e.g., 'use client')",
    required: false,
  },
  footer: {
    type: "string",
    description: "Add footer to bundled code",
    required: false,
  },
  conditions: {
    type: "string",
    description: "Package.json exports conditions for import resolution",
    required: false,
  },
  loader: {
    type: "string",
    description: "Custom loaders for file extensions (JSON format)",
    required: false,
  },
  ignoreDCEAnnotations: {
    type: "boolean",
    description: "Ignore dead code elimination annotations",
    required: false,
  },
  emitDCEAnnotations: {
    type: "boolean",
    description: "Force emit dead code elimination annotations",
    required: false,
  },
  throw: {
    type: "boolean",
    description: "Throw on build errors instead of returning success: false",
    required: false,
  },
  production: {
    type: "boolean",
    description: "Enable production mode (minify=true, sourcemap=none, env=inline)",
    required: false,
  },
  dev: {
    type: "boolean",
    description: "Enable development mode (minify=false, sourcemap=inline, watch=true)",
    required: false,
  },
  compile: {
    type: "boolean",
    description: "Generate standalone Bun executable",
    required: false,
  },
  cache: {
    type: "boolean",
    description: "Enable build caching (default: true)",
    required: false,
  },
  noCache: {
    type: "boolean",
    description: "Disable build caching",
    required: false,
  },
  entryNaming: {
    type: "string",
    description: "Entry point naming pattern (e.g., '[dir]/[name].[ext]')",
    required: false,
  },
  chunkNaming: {
    type: "string",
    description: "Chunk naming pattern (e.g., '[name]-[hash].[ext]')",
    required: false,
  },
  assetNaming: {
    type: "string",
    description: "Asset naming pattern (e.g., '[name]-[hash].[ext]')",
    required: false,
  },
  // Frontend-specific options
  html: {
    type: "boolean",
    description: "Enable HTML entry point processing (auto-detected for frontend apps)",
    required: false,
  },
  cssChunking: {
    type: "boolean",
    description: "Chunk CSS to reduce duplication (default: true for frontend apps)",
    required: false,
  },
  devServer: {
    type: "boolean",
    description: "Start dev server with HMR (requires --watch)",
    required: false,
  },
  port: {
    type: "number",
    description: "Dev server port (default: 3000)",
    required: false,
  },
  open: {
    type: "boolean",
    description: "Open browser on dev server start",
    required: false,
  },
  publicAssets: {
    type: "string",
    description: "Public assets directory (default: public)",
    required: false,
  },
  jsxRuntime: {
    type: "string",
    description: "JSX runtime: automatic or classic (default: automatic)",
    required: false,
  },
  jsxImportSource: {
    type: "string",
    description: "JSX import source (e.g., 'react' for classic runtime)",
    required: false,
  },
  keepNames: {
    type: "boolean",
    description: "Preserve original function and class names when minifying",
    required: false,
  },
  debug: {
    type: "boolean",
    description: "Enable debug mode with verbose internal logging",
    required: false,
  },
  experimental: {
    type: "string",
    description: "Enable experimental features (comma-separated list)",
    required: false,
  },
  // New Bun bundler features
  noBundle: {
    type: "boolean",
    description: "Transpile only — do not bundle",
    required: false,
  },
  reactFastRefresh: {
    type: "boolean",
    description: "Enable React Fast Refresh transform (for development testing)",
    required: false,
  },
  noClearScreen: {
    type: "boolean",
    description: "Don't clear the terminal when rebuilding with --watch",
    required: false,
  },
  // Windows executable options
  windowsHideConsole: {
    type: "boolean",
    description: "Prevent a console window from opening when running a compiled Windows executable",
    required: false,
  },
  windowsIcon: {
    type: "string",
    description: "Set an icon for the Windows executable",
    required: false,
  },
  windowsTitle: {
    type: "string",
    description: "Set the Windows executable product name",
    required: false,
  },
  windowsPublisher: {
    type: "string",
    description: "Set the Windows executable company name",
    required: false,
  },
  windowsVersion: {
    type: "string",
    description: "Set the Windows executable version (e.g. 1.2.3.4)",
    required: false,
  },
  windowsDescription: {
    type: "string",
    description: "Set the Windows executable description",
    required: false,
  },
  windowsCopyright: {
    type: "string",
    description: "Set the Windows executable copyright notice",
    required: false,
  },
  // Experimental features
  app: {
    type: "boolean",
    description: "(EXPERIMENTAL) Build a web app for production using Bun Bake",
    required: false,
  },
  serverComponents: {
    type: "boolean",
    description: "(EXPERIMENTAL) Enable React Server Components",
    required: false,
  },
  debugDumpServerFiles: {
    type: "boolean",
    description: "When --app is set, dump all server files to disk even for static builds",
    required: false,
  },
  debugNoMinify: {
    type: "boolean",
    description: "When --app is set, disable all minification",
    required: false,
  },
  // Enhanced features
  macros: {
    type: "boolean",
    description: "Enable Bun macros support for compile-time code generation",
    required: false,
  },
  sideEffects: {
    type: "string",
    description: "Configure sideEffects for tree-shaking (boolean or JSON array)",
    required: false,
  },
  bundleAnalyzer: {
    type: "boolean",
    description: "Generate bundle analysis report",
    required: false,
  },
  typeCheck: {
    type: "boolean",
    description: "Run TypeScript type checking during build",
    required: false,
  },
  generateTypes: {
    type: "boolean",
    description: "Generate TypeScript declaration files (.d.ts)",
    required: false,
  },
  bundleSizeLimit: {
    type: "number",
    description: "Set maximum bundle size limit in bytes",
    required: false,
  },
  performanceBudget: {
    type: "string",
    description: "Set performance budget (JSON format)",
    required: false,
  },
  // Asset optimization
  imageOptimization: {
    type: "boolean",
    description: "Enable image optimization (WebP conversion, compression)",
    required: false,
  },
  fontOptimization: {
    type: "boolean",
    description: "Enable font optimization (subsetting, compression)",
    required: false,
  },
  cssOptimization: {
    type: "boolean",
    description: "Enable CSS optimization (purge, minify, autoprefixer)",
    required: false,
  },
  // Modern loaders
  svgAsReact: {
    type: "boolean",
    description: "Transform SVG files into React components",
    required: false,
  },
  cssModules: {
    type: "boolean",
    description: "Enable CSS Modules support",
    required: false,
  },
  workerSupport: {
    type: "boolean",
    description: "Enable Web Worker support",
    required: false,
  },
  // Plugin system
  plugins: {
    type: "string",
    description: "Load custom plugins (comma-separated list)",
    required: false,
  },
  // Performance monitoring
  performanceMonitoring: {
    type: "boolean",
    description: "Enable performance monitoring and reporting",
    required: false,
  },
  bundleAnalysis: {
    type: "boolean",
    description: "Generate detailed bundle analysis",
    required: false,
  },
});

const buildCmdCfg = defineCmdCfg({
  name: "build",
  description: "Build all workspace packages using Bun's bundler with reliverse.ts configuration. Auto-detects frontend apps and libraries. Supports presets: --production, --dev, --library, --react, --node, --monorepo.",
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
    "# Preset Examples:",
    "dler build --production  # Optimized for production",
    "dler build --dev         # Development mode with watch",
    "dler build --library     # Library build (external deps)",
    "dler build --react       # React app with JSX support",
    "dler build --node        # Node.js server build",
    "dler build --monorepo    # Monorepo optimized build",
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
    "# Create reliverse.ts in your monorepo root:",
    "# export default {",
    "#   build: {",
    "#     global: { target: 'bun', format: 'esm' },",
    "#     packages: { 'my-package': { minify: true, generateTypes: true } },",
    "#     patterns: [{ pattern: 'apps/*', config: { target: 'browser', html: true, bundleAnalyzer: true } }]",
    "#   }",
    "# }",
    "",
    "# Note: Configuration is only supported via reliverse.ts",
    "# package.json build fields are not supported",
  ],
});

export default defineCmd(buildCmd, buildCmdArgs, buildCmdCfg);
