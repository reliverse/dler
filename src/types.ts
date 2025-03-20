/**
 * Supported bundler names for building packages:
 * - bun: Bun's built-in bundler for fast builds
 * - copy: A simple file copy without bundling
 * - jsr: Similar to copy but optimized for the JSR registry
 * - mkdist: A lightweight bundler focused on TypeScript/ESM
 * - rollup: A traditional bundler with an extensive plugin ecosystem
 * - untyped: Types and markdown generation from a config object
 */
export type BundlerName =
  | "jsr"
  | "bun"
  | "copy"
  | "mkdist"
  | "rollup"
  | "untyped";

/**
 * Supported bump modes for versioning:
 * - autoPatch: 1.2.3 → 1.2.4
 * - autoMinor: 1.2.3 → 1.3.0
 * - autoMajor: 1.2.3 → 2.0.0
 */
export type BumpMode = "autoPatch" | "autoMinor" | "autoMajor";

/**
 * Supported file extensions for version bumping.
 */
export type BumpFilter = "package.json" | "reliverse.jsonc" | "reliverse.ts";

/**
 * Supported modes for filtering dependencies.
 * - patterns-and-devdeps: Excludes all `devDependencies` and dependencies matching specified patterns.
 * - patterns-only: Excludes only dependencies matching `excludedDependencyPatterns`.
 */
export type ExcludeMode = "patterns-and-devdeps" | "patterns-only";

/**
 * Supported target runtime environments for built packages.
 * - node: Optimized for Node.js.
 * - bun: Optimized for Bun.
 * - browser: Optimized for web browsers.
 */
export type Target = "node" | "bun" | "browser";

/**
 * Supported output module formats for built packages.
 * - esm: ECMAScript modules (import/export)
 * - cjs: CommonJS modules (require/exports)
 * - iife: Immediately Invoked Function Expression (for browsers)
 */
export type Format = "esm" | "cjs" | "iife";

/**
 * Supported source map options for built packages.
 * - boolean: Enable/disable source maps.
 * - "inline": Include source maps within output files.
 * - "none": Do not generate source maps.
 * - "linked": Generate separate source map files with links.
 * - "external": Generate separate source map files.
 */
export type Sourcemap = boolean | "inline" | "none" | "linked" | "external";

export type NpmOutExt = "cjs" | "js" | "mjs" | "ts" | "mts" | "cts";

export type Esbuild = "es2023" | "es2022" | "es2021" | "es2020" | "es2019";

/**
 * Defines the full configuration for building and publishing packages.
 * This includes versioning, build settings, publishing options, multi-package support, and more.
 * It customizes the build and publish pipeline for both NPM and JSR registries.
 */
export type BuildPublishConfig = {
  // ==========================================================================
  // Common configuration`
  // ==========================================================================

  /**
   * Path to the project's main entry file.
   * Used as the entry point for the NPM package.
   *
   * @default "main.ts"
   */
  entryFile: string;

  /**
   * Base directory containing the source entry files.
   * All paths are resolved relative to this directory.
   * Set to `"."` if entry files are in the project root.
   *
   * @default "src"
   */
  entrySrcDir: string;

  /**
   * When `true`, enables detailed logs during the build and publish process.
   * Useful for debugging or understanding the build flow.
   *
   * @default false
   */
  verbose: boolean;

  /**
   * When `true`, indicates that the package is a CLI.
   * Affects how the package is built and published (e.g., bin entries).
   *
   * @default false
   */
  isCLI: boolean;

  // ==========================================================================
  // Publishing options
  // ==========================================================================

  /**
   * Specifies which package registries to publish to:
   * - `npm`: Publish only to the NPM registry.
   * - `jsr`: Publish only to the JSR registry.
   * - `npm-jsr`: Publish to both NPM and JSR registries.
   *
   * @default "npm-jsr"
   */
  registry: "npm" | "jsr" | "npm-jsr";

  /**
   * When `true`, stops after building and retains distribution folders.
   * Useful for development or inspecting the build output.
   *
   * @default true
   */
  pausePublish: boolean;

  /**
   * When `true`, simulates the publishing process without actually publishing.
   * Useful for testing the build and publish pipeline without side effects.
   *
   * @default false
   */
  dryRun: boolean;

  // ==========================================================================
  // Versioning options
  // ==========================================================================

  /**
   * Specifies how the version number should be incremented automatically:
   * - `autoPatch`: Increments the patch version for backwards-compatible bug fixes (1.2.3 → 1.2.4).
   * - `autoMinor`: Increments the minor version for new backwards-compatible features (1.2.3 → 1.3.0).
   * - `autoMajor`: Increments the major version for breaking changes (1.2.3 → 2.0.0).
   *
   * Please note: `relidler` infers the version from the `package.json` file.
   *
   * @default "autoPatch"
   */
  bumpMode: BumpMode;

  /**
   * When `true`, disables version bumping.
   * Useful when retrying a failed publish with an already bumped version.
   *
   * @default false
   */
  disableBump: boolean;

  /**
   * Controls which files will have their version numbers updated during version bumping.
   *
   * Accepts:
   * - Standard file types like "package.json"
   * - Relative paths like "src/constants.ts"
   * - [Globbing patterns](https://github.com/mrmlnc/fast-glob#pattern-syntax)
   *
   * When empty, falls back to only updating "package.json".
   * Respects: .gitignore patterns, hidden files, .git & node_modules.
   *
   * @default ["package.json", "reliverse.ts"]
   */
  bumpFilter: BumpFilter[];

  // ==========================================================================
  // NPM-only config
  // ==========================================================================

  /**
   * Directory where NPM build artifacts are generated.
   * This directory will contain the package ready for NPM publishing.
   *
   * @default "dist-npm"
   */
  npmDistDir: string;

  /**
   * The bundler to use for creating NPM-compatible packages.
   *
   * @default "mkdist"
   */
  npmBuilder: BundlerName;

  /**
   * Specifies the file extension for output files in NPM packages.
   * Determines the extension of compiled files in the NPM distribution.
   * We strongly recommend using `"js"` with the `"esm"` format.
   *
   * @default "js"
   */
  npmOutFilesExt?: NpmOutExt;

  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   * Essential for providing type information to TypeScript users.
   * Set to `false` if your main project is a CLI to reduce bundle size.
   *
   * @default true
   */
  npmDeclarations: boolean;

  /**
   * Files to copy to the NPM distribution directory.
   * Useful for including additional files like configuration or documentation.
   *
   * @default ["LICENSE", "README.md"]
   */
  npmCopyRootFiles: string[];

  // ==========================================================================
  // JSR-only config
  // ==========================================================================

  /**
   * Directory where JSR build artifacts are generated.
   * This directory will contain the package ready for JSR publishing.
   *
   * @default "dist-jsr"
   */
  jsrDistDir: string;

  /**
   * The bundler to use for creating JSR-compatible packages.
   * JSR's native bundler is recommended for best compatibility.
   *
   * @default "jsr"
   */
  jsrBuilder: BundlerName;

  /**
   * When `true`, enables JSR to process complex types, which may impact performance.
   * Enable this only if you cannot simplify or explicitly define exported types.
   *
   * JSR requires exported functions, classes, variables, and type aliases to have
   * explicitly written or easily inferred types. Otherwise, it may be unable to
   * generate documentation, type declarations for npm compatibility, or efficient
   * type checking for consumers.
   *
   * If "slow types" are present, type checking performance may degrade, and some
   * features may not work as expected.
   *
   * It is `true` by default to make it easier for new `relidler` users to publish their projects.
   *
   * @see https://jsr.io/docs/about-slow-types
   * @default true
   */
  jsrSlowTypes: boolean;

  /**
   * When `true`, allows JSR publishing even with uncommitted changes.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * It is `true` by default to make it easier for new `relidler` users to publish their projects.
   *
   * @default true
   */
  jsrAllowDirty: boolean;

  /**
   * When `true`, generates a `jsconfig.json` file for JSR's dist.
   *
   * @default false
   */
  jsrGenTsconfig: boolean;

  /**
   * Files to copy to the JSR distribution directory.
   * Useful for including additional files like configuration or documentation.
   *
   * @default ["README.md", "LICENSE"]
   */
  jsrCopyRootFiles: string[];

  // ==========================================================================
  // Build setup
  // ==========================================================================

  /**
   * When `true`, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   *
   * @default true
   */
  minify: boolean;

  /**
   * When `true`, enables code splitting for improved load-time performance.
   * Useful for large applications but may not be needed for small projects.
   *
   * @default false
   */
  splitting: boolean;

  /**
   * Stub the package for JIT compilation.
   *
   * @default false
   */
  stub: boolean;

  /**
   * Watch the src dir and rebuild on change (experimental).
   *
   * @default false
   */
  watch: boolean;

  /**
   * Controls source map generation for debugging (experimental):
   * - `true/false`: Enable/disable source maps.
   * - `"inline"`: Include source maps within output files.
   * - `"none"`: Do not generate source maps.
   * - `"linked"`: Generate separate source map files with links.
   * - `"external"`: Generate separate source map files.
   *
   * @default false
   */
  sourcemap: Sourcemap;

  /**
   * The target runtime environment for the built package.
   *
   * @default "es2023"
   */
  esbuild: Esbuild;

  /**
   * The base URL for loading assets in the built package.
   * Important for packages that include assets like images or fonts.
   *
   * @default "/"
   */
  publicPath: string;

  /**
   * Defines the target runtime environment:
   * - `node`: Optimized for Node.js.
   * - `bun`: Optimized for Bun.
   * - `browser`: Optimized for web browsers.
   *
   * @default "node"
   */
  target: Target;

  /**
   * Output module format for built files:
   * - `esm`: ECMAScript modules (import/export)
   * - `cjs`: CommonJS modules (require/exports)
   * - `iife`: Immediately Invoked Function Expression (for browsers)
   *
   * @default "esm"
   */
  format: Format;

  // ==========================================================================
  // Logger options
  // ==========================================================================

  /**
   * When `true`, cleans up the log file from previous runs.
   *
   * @default false
   */
  freshLogFile: boolean;

  /**
   * The name of the log file.
   *
   * @default "relinka.log"
   */
  logFile: string;

  // ==========================================================================
  // Dependency filtering
  // ==========================================================================

  /**
   * Controls how dependencies are excluded from the final package:
   * - `patterns-and-devdeps`: Excludes all `devDependencies` and dependencies matching specified patterns.
   * - `patterns-only`: Excludes only dependencies matching `excludedDependencyPatterns`.
   *
   * @default "patterns-and-devdeps"
   */
  excludeMode: ExcludeMode;

  /**
   * A list of dependency name patterns to exclude when filtering `dependencies` and `devDependencies`.
   * Any dependency whose name matches or contains any of these patterns will be excluded from the final package.
   * Helps prevent known `devDependencies` from being mistakenly included in `dependencies`.
   *
   * @example ["eslint", "prettier", "test"]
   * @default ["eslint", "prettier", "biome"]
   */
  excludedDependencyPatterns?: string[];

  // ==========================================================================
  // Libraries Relidler Plugin
  // ==========================================================================

  /**
   * !! EXPERIMENTAL !!
   * Controls which parts of the project are built and published:
   * - `main-project-only`: Builds/publishes only the main package.
   * - `main-and-libs`: Builds/publishes both the main package and libraries.
   * - `libs-only`: Builds/publishes only the libraries.
   *
   * @default "main-project-only"
   */
  buildPublishMode: "main-project-only" | "main-and-libs" | "libs-only";

  /**
   * The directory where built libraries are stored before publishing.
   *
   * @default "dist-libs"
   */
  libsDistDir: string;

  /**
   * The directory containing library source files.
   *
   * @default "src/libs"
   */
  libsSrcDir: string;

  /**
   * !! EXPERIMENTAL !!
   * Configuration for building and publishing multiple libraries.
   * Each key represents a package name, and its value contains the configuration.
   *
   * @example
   * {
   *   "@myorg/ml1": { main: "my-lib-1/main.ts" },
   *   "@myorg/ml2": { main: "my-lib-2/ml2-main.ts" },
   *   "@myorg/ml3": { main: "src/libs/my-lib-3/index.js" }
   * }
   */
  libs?: Record<string, LibConfig>;
};

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 */
export type LibConfig = {
  /**
   * The path to the library's main entry file.
   * This file serves as the primary entry point for imports.
   * The path should be relative to the project root.
   * The full path to the library's main file is derived by joining `libsDistDir` with `main`.
   *
   * @example "my-lib-1/main.ts"
   * @example "my-lib-2/ml2-main.ts"
   * @example "src/libs/my-lib-3/index.js"
   */
  main: string;

  /**
   * The directory where the library's dist files are stored.
   *
   * @default name is derived from the library's name after slash
   */
  subDistDir?: string;

  /**
   * An optional description of the library, included in the dist's package.json.
   * Provides users with an overview of the library's purpose.
   *
   * @example "Utility functions for data manipulation"
   * @example "Core configuration module for the framework"
   */
  description?: string;

  /**
   * Dependencies to include in the dist's package.json.
   * The final output may vary based on `excludeMode` and `excludedDependencyPatterns`.
   * Defines how dependencies are handled during publishing:
   * - `string[]`: Includes only the specified dependencies.
   * - `true`: Includes all dependencies from the main package.json.
   * - `false` or `undefined`: Automatically determines dependencies based on imports.
   *
   * @example ["pathe", "fs-extra"] - Only include these specific dependencies.
   * @example true - Include all `dependencies` from the main package.json.
   */
  dependencies?: string[] | boolean;

  // ==========================================================================
  // Overrides
  // ==========================================================================

  /**
   * When `true`, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   *
   * @default true
   */
  minify?: boolean;

  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   */
  npmDeclarations?: boolean;
};
