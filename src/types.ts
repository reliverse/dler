/**
 * Supported bundler names for building packages.
 * - jsr: JSR's built-in bundler for JSR registry
 * - bun: Bun's built-in bundler for fast builds
 * - copy: Simple file copy without bundling
 * - mkdist: Lightweight bundler focused on TypeScript/ESM
 * - rollup: Traditional bundler with extensive plugin ecosystem
 * - untyped: Bundler that strips type information
 */
type BundlerName = "jsr" | "bun" | "copy" | "mkdist" | "rollup" | "untyped";

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when you want to publish multiple packages from a single repository.
 */
type LibConfig = {
  /**
   * The path to the main entry file for the library.
   * This file serves as the primary entry point for importing the library.
   * The path should be relative to the project root.
   * @example "src/libs/config/index.ts"
   * @example "src/packages/utils/main.ts"
   */
  main: string;

  /**
   * Optional description for the library that will be included in its package.json.
   * Helps users understand the purpose of this specific library.
   * @example "Utility functions for data manipulation"
   * @example "Core configuration module for the framework"
   */
  description?: string;

  /**
   * Dependencies to include in the library's package.json.
   * Controls how dependencies are handled during publishing:
   * - string[]: Only include specific dependencies listed in the array
   * - true: Include all dependencies from the main package.json
   * - false/undefined: Automatically determine dependencies based on imports
   * @example ["lodash", "zod"] - Only include these specific dependencies
   * @example true - Include all dependencies from main package.json
   */
  dependencies?: string[] | boolean;
};

/**
 * BuildPublishConfig defines the complete configuration for building and publishing packages.
 * This includes version management, build settings, publishing options, and multi-package support.
 * Used to customize the entire build and publish pipeline for both NPM and JSR registries.
 */
export type BuildPublishConfig = {
  /**
   * Specifies how the version number should be automatically incremented:
   * - autoPatch: Increment patch version for backwards-compatible bug fixes (1.2.3 → 1.2.4)
   * - autoMinor: Increment minor version for new backwards-compatible features (1.2.3 → 1.3.0)
   * - autoMajor: Increment major version for breaking changes (1.2.3 → 2.0.0)
   * @default "autoPatch"
   */
  bump: "autoPatch" | "autoMinor" | "autoMajor";

  /**
   * When true, outputs detailed logs during build and publish process.
   * Helpful for debugging build issues or understanding the build flow.
   * @default false
   */
  verbose: boolean;

  /**
   * When true, simulates the publishing process without actually publishing.
   * Useful for testing the build and publish pipeline without side effects.
   * @default false
   */
  dryRun: boolean;

  /**
   * When true, stops after building and keeps distribution folders.
   * Useful during development or when you want to inspect build output.
   * @default false
   */
  pausePublish: boolean;

  /**
   * When true, allows JSR publishing even with uncommitted changes.
   * Use with caution as it may lead to inconsistent published versions.
   * @default false
   */
  jsrAllowDirty: boolean;

  /**
   * When true, allows JSR to process complex types that may impact performance.
   * Enable only if you need to publish packages with complex type definitions.
   * @default false
   */
  jsrSlowTypes: boolean;

  /**
   * Specifies which package registries to publish to:
   * - npm: Publish only to NPM registry
   * - jsr: Publish only to JSR registry
   * - npm-jsr: Publish to both NPM and JSR registries
   * @default "npm-jsr"
   */
  registry: "npm" | "jsr" | "npm-jsr";

  /**
   * Directory where NPM build artifacts will be generated.
   * This directory will contain the package ready for NPM publishing.
   * @default "dist-npm"
   */
  npmDistDir: string;

  /**
   * Directory where JSR build artifacts will be generated.
   * This directory will contain the package ready for JSR publishing.
   * @default "dist-jsr"
   */
  jsrDistDir: string;

  /**
   * Path to the main entry file for the project.
   * This file will be used as the entry point for the NPM package.
   * @default "main.ts"
   */
  entryFile: string;

  /**
   * Base directory containing source entry files.
   * All source file paths will be resolved relative to this directory.
   * Set to "." if your entry files are in the project root.
   * @default "src"
   */
  entrySrcDir: string;

  /**
   * Bundler to use for creating NPM-compatible packages.
   * Different bundlers may be better suited for specific use cases.
   * @default "mkdist"
   */
  npmBuilder: BundlerName;

  /**
   * Bundler to use for creating JSR-compatible packages.
   * JSR's native bundler is recommended for best compatibility.
   * @default "jsr"
   */
  jsrBuilder: BundlerName;

  /**
   * Target runtime environment for the built package.
   * @default "es2023"
   */
  esbuild: "es2023" | "es2022" | "es2021" | "es2020" | "es2019";

  /**
   * When true, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   * @default true
   */
  shouldMinify: boolean;

  /**
   * When true, enables code splitting for better load-time performance.
   * Useful for large applications but may not be needed for small libraries.
   * @default false
   */
  splitting: boolean;

  /**
   * Controls generation of source maps for debugging:
   * - true/false: Enable/disable source maps
   * - "inline": Include source maps in the output files
   * - "none": Don't generate source maps
   * - "linked": Generate separate source map files with links
   * - "external": Generate separate source map files
   * @default false
   */
  sourcemap: boolean | "inline" | "none" | "linked" | "external";

  /**
   * Specifies the target runtime environment:
   * - node: Optimized for Node.js runtime
   * - bun: Optimized for Bun runtime
   * - browser: Optimized for web browsers
   * @default "node"
   */
  target: "node" | "bun" | "browser";

  /**
   * Base URL for loading assets in the built package.
   * Important for packages that include assets like images or fonts.
   * @default "/"
   */
  publicPath: string;

  /**
   * When true, skips version bumping process.
   * Useful when retrying a failed publish with an already bumped version.
   * @default false
   */
  disableBump: boolean;

  /**
   * When true, indicates this is a CLI package.
   * Affects how the package is built and published (e.g., bin entries).
   * @default false
   */
  isCLI: boolean;

  /**
   * When true, generates TypeScript declaration files (.d.ts) for NPM packages.
   * Important for providing type information to TypeScript users.
   * Set to false if your main project is a CLI to get a smaller bundle size.
   * @default true
   */
  npmDeclarations: boolean;

  /**
   * Specifies the file extension to use for output files in NPM packages.
   * This affects the extension of compiled files in the NPM distribution.
   * We highly recommend using "js" with "esm" format.
   * @default "js"
   */
  npmOutFilesExt?: "js" | "mjs" | "ts" | "mts" | "cts" | "cjs";

  /**
   * Output module format for the built files:
   * - esm: ECMAScript modules (import/export)
   * - cjs: CommonJS modules (require/exports)
   * - iife: Immediately Invoked Function Expression (for browsers)
   * @default "esm"
   */
  format: "esm" | "cjs" | "iife";

  /**
   * List of dependency name patterns to exclude when filtering dependencies.
   * Any dependency whose name includes these patterns will be excluded from the final package.
   * This is useful for development dependencies that should not be included in the published package.
   * @example ["eslint", "prettier", "test"]
   * @default ["eslint", "prettier", "biome"]
   */
  excludedDependencyPatterns?: string[];

  /**
   * !! EXPERIMENTAL !!
   * Controls which parts of the project to build and publish:
   * - main-project-only: Only build/publish the main package
   * - main-and-libs: Build/publish both main package and libraries
   * - libs-only: Only build/publish the libraries
   * @default "main-project-only"
   */
  buildPublishMode: "main-project-only" | "main-and-libs" | "libs-only";

  /**
   * !! EXPERIMENTAL !!
   * Configuration for building and publishing multiple libraries.
   * Each key is the package name, and the value is its configuration.
   * @example
   * {
   *   "@myorg/utils": { main: "src/libs/utils/index.ts" },
   *   "@myorg/core": { main: "src/libs/core/index.ts" }
   * }
   */
  libs?: Record<string, LibConfig>;
};
