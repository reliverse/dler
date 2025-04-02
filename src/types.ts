/**
 * Defines the configuration for building and publishing packages. This includes: versioning,
 * build settings, publishing options, libraries-relidler-plugin built-in plugin, and more.
 * It customizes the build and publish pipeline for both NPM and JSR registries.
 */
export type BuildPublishConfig = {
  // ==========================================================================
  // Bump configuration
  // ==========================================================================
  /**
   * When `true`, disables version bumping.
   * Useful when retrying a failed publish with an already bumped version.
   *
   * @default false
   */
  bumpDisable: boolean;

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

  // ==========================================================================
  // Common configuration
  // ==========================================================================

  /**
   * When `true`, stops after building and retains distribution folders.
   * Useful for development or inspecting the build output.
   *
   * @default true
   */
  commonPubPause: boolean;

  /**
   * Specifies which package registries to publish to:
   * - `npm`: Publish only to the NPM commonPubRegistry.
   * - `jsr`: Publish only to the JSR commonPubRegistry.
   * - `npm-jsr`: Publish to both NPM and JSR registries.
   *
   * @default "npm"
   */
  commonPubRegistry: "jsr" | "npm" | "npm-jsr";

  /**
   * When `true`, enables detailed logs during the build and publish process.
   * Useful for debugging or understanding the build flow.
   *
   * @default false
   */
  commonVerbose: boolean;

  // ==========================================================================
  // Core configuration
  // ==========================================================================

  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   * Essential for providing type intranspileFormation to TypeScript users.
   * Tip: set to `false` if your main project is a CLI to reduce bundle size.
   *
   * @default true
   */
  coreDeclarations: boolean;

  /**
   * Path to the project's main entry file.
   * Used as the entry point for the NPM package.
   *
   * @default "main.ts"
   */
  coreEntryFile: string;

  /**
   * Base directory containing the source entry files.
   * All paths are resolved relative to this directory.
   * Set to `"."` if entry files are in the project root.
   *
   * @default "src"
   */
  coreEntrySrcDir: string;

  /**
   * When `true`, indicates that the package is a CLI.
   * Affects how the package is built and published (e.g., bin entries).
   *
   * @default false
   */
  coreIsCLI: boolean;

  // ==========================================================================
  // JSR-only config
  // ==========================================================================

  /**
   * When `true`, allows JSR publishing even with uncommitted changes.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * It is `true` by default to make it easier for new `relidler` users to publish their projects.
   *
   * @default true
   */
  distJsrAllowDirty: boolean;

  /**
   * The bundler to use for creating JSR-compatible packages.
   * JSR's native bundler is recommended for best compatibility.
   *
   * @default "jsr"
   */
  distJsrBuilder: BundlerName;

  /**
   * Files to copy to the JSR distribution directory.
   * Useful for including additional files like configuration or documentation.
   *
   * @default ["README.md", "LICENSE"]
   */
  distJsrCopyRootFiles: string[];

  /**
   * Directory where JSR build artifacts are generated.
   * This directory will contain the package ready for JSR publishing.
   *
   * @default "dist-jsr"
   */
  distJsrDirName: string;

  /**
   * When `true`, simulates the publishing process without actually publishing.
   * Useful for testing the build and publish pipeline without side effects.
   *
   * @default false
   */
  distJsrDryRun: boolean;

  /**
   * When `true`, fails the build if warnings are detected.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * @default false
   */
  distJsrFailOnWarn: boolean;

  /**
   * When `true`, generates a `jsconfig.json` file for JSR's dist.
   *
   * @default false
   */
  distJsrGenTsconfig: boolean;

  /**
   * The file extension for output files in JSR packages.
   *
   * @default "ts"
   */
  distJsrOutFilesExt: NpmOutExt;

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
  distJsrSlowTypes: boolean;

  // ==========================================================================
  // NPM-only config
  // ==========================================================================

  /**
   * The bundler to use for creating NPM-compatible packages.
   *
   * @default "mkdist"
   */
  distNpmBuilder: BundlerName;

  /**
   * Files to copy to the NPM distribution directory.
   * Useful for including additional files like configuration or documentation.
   *
   * @default ["LICENSE", "README.md"]
   */
  distNpmCopyRootFiles: string[];

  /**
   * Directory where NPM build artifacts are generated.
   * This directory will contain the package ready for NPM publishing.
   *
   * @default "dist-npm"
   */
  distNpmDirName: string;

  /**
   * Specifies the file extension for output files in NPM packages.
   * Determines the extension of compiled files in the NPM distribution.
   * We strongly recommend using `"js"` with the `"esm"` transpileFormat.
   *
   * @default "js"
   */
  distNpmOutFilesExt: NpmOutExt;

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
  libsActMode: "libs-only" | "main-and-libs" | "main-project-only";

  /**
   * The directory where built libraries are stored before publishing.
   *
   * @default "dist-libs"
   */
  libsDirDist: string;

  /**
   * The directory containing library source files.
   *
   * @default "src/libs"
   */
  libsDirSrc: string;

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
  libsList: Record<string, LibConfig>;

  // ==========================================================================
  // Logger setup
  // ==========================================================================

  /**
   * The name of the log file. Relidler uses `@reliverse/relinka` for logging.
   *
   * @default "relinka.log"
   */
  logsFileName: string;

  /**
   * When `true`, cleans up the log file from previous runs.
   *
   * @default false
   */
  logsFreshFile: boolean;

  // ==========================================================================
  // Dependency filtering
  // ==========================================================================

  /**
   * Controls how dependencies are excluded from the final package:
   * - `patterns-and-devdeps`: Excludes all `devDependencies` and dependencies matching specified patterns.
   * - `patterns-only`: Excludes only dependencies matching `rmDepsPatterns`.
   *
   * @default "patterns-and-devdeps"
   */
  rmDepsMode: ExcludeMode;

  /**
   * A list of dependency name patterns to exclude when filtering `dependencies` and `devDependencies`.
   * Any dependency whose name matches or contains any of these patterns will be excluded from the final package.
   * Helps prevent known `devDependencies` from being mistakenly included in `dependencies`.
   *
   * @example ["eslint", "prettier", "test"]
   * @default ["eslint", "prettier", "biome"]
   */
  rmDepsPatterns: string[];

  // ==========================================================================
  // Build setup
  // ==========================================================================

  /**
   * The transpileTarget runtime environment for the built package.
   *
   * @default "es2023"
   */
  transpileEsbuild: Esbuild;

  /**
   * Output module transpileFormat for built files:
   * - `esm`: ECMAScript modules (import/export)
   * - `cjs`: CommonJS modules (require/exports)
   * - `iife`: Immediately Invoked Function Expression (for browsers)
   *
   * @default "esm"
   */
  transpileFormat: transpileFormat;

  /**
   * When `true`, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   *
   * @default true
   */
  transpileMinify: boolean;

  /**
   * The base URL for loading assets in the built package.
   * Important for packages that include assets like images or fonts.
   *
   * @default "/"
   */
  transpilePublicPath: string;

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
  transpileSourcemap: Sourcemap;

  /**
   * When `true`, enables code transpileSplitting for improved load-time performance.
   * Useful for large applications but may not be needed for small projects.
   *
   * @default false
   */
  transpileSplitting: boolean;

  /**
   * Stub the package for JIT compilation.
   *
   * @default false
   */
  transpileStub: boolean;

  /**
   * Defines the transpileTarget runtime environment:
   * - `node`: Optimized for Node.js.
   * - `bun`: Optimized for Bun.
   * - `browser`: Optimized for web browsers.
   *
   * @default "node"
   */
  transpileTarget: transpileTarget;

  /**
   * Watch the src dir and rebuild on change (experimental).
   *
   * @default false
   */
  transpileWatch: boolean;
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Supported file extensions for version bumping.
 */
export type BumpFilter = "package.json" | "reliverse.jsonc" | "reliverse.ts";

/**
 * Supported bump modes for versioning:
 * - autoPatch: 1.2.3 → 1.2.4
 * - autoMinor: 1.2.3 → 1.3.0
 * - autoMajor: 1.2.3 → 2.0.0
 */
export type BumpMode = "autoMajor" | "autoMinor" | "autoPatch";

/**
 * Supported bundler names for building packages:
 * - bun: Bun's built-in bundler for fast builds
 * - copy: A simple file copy without bundling
 * - jsr: Similar to copy but optimized for the JSR commonPubRegistry
 * - mkdist: A lightweight bundler focused on TypeScript/ESM
 * - rollup: A traditional bundler with an extensive plugin ecosystem
 * - untyped: Types and markdown generation from a config object
 */
export type BundlerName =
  | "bun"
  | "copy"
  | "jsr"
  | "mkdist"
  | "rollup"
  | "untyped";

export type Esbuild = "es2019" | "es2020" | "es2021" | "es2022" | "es2023";

/**
 * Supported modes for filtering dependencies.
 * - patterns-and-devdeps: Excludes all `devDependencies` and dependencies matching specified patterns.
 * - patterns-only: Excludes only dependencies matching `rmDepsPatterns`.
 */
export type ExcludeMode = "patterns-and-devdeps" | "patterns-only";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 */
export type LibConfig = {
  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   */
  libDeclarations: boolean;

  /**
   * An optional description of the library, included in the dist's package.json.
   * Provides users with an overview of the library's purpose.
   *
   * @example "Utility functions for data manipulation"
   * @example "Core configuration module for the framework"
   */
  libDescription: string;

  /**
   * The directory where the library's dist files are stored.
   *
   * @default name is derived from the library's name after slash
   */
  libDirName: string;

  /**
   * The path to the library's main entry file.
   * This file serves as the primary entry point for imports.
   * The path should be relative to the project root.
   * The full path to the library's main file is derived by joining `libsDirDist` with `main`.
   *
   * @example "my-lib-1/main.ts"
   * @example "my-lib-2/ml2-main.ts"
   * @example "src/libs/my-lib-3/index.js"
   */
  libMainFile: string;

  /**
   * Dependencies to include in the dist's package.json.
   * The final output may vary based on `rmDepsMode` and `rmDepsPatterns`.
   * Defines how dependencies are handled during publishing:
   * - `string[]`: Includes only the specified dependencies.
   * - `true`: Includes all dependencies from the main package.json.
   * - `false` or `undefined`: Automatically determines dependencies based on imports.
   *
   * @example ["pathe", "fs-extra"] - Only include these specific dependencies.
   * @example true - Include all `dependencies` from the main package.json.
   */
  libPkgKeepDeps: boolean | string[];

  /**
   * When `true`, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   *
   * @default true
   */
  libTranspileMinify: boolean;
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type NpmOutExt = "cjs" | "cts" | "js" | "mjs" | "mts" | "ts";

/**
 * Supported source map options for built packages.
 * - boolean: Enable/disable source maps.
 * - "inline": Include source maps within output files.
 * - "none": Do not generate source maps.
 * - "linked": Generate separate source map files with links.
 * - "external": Generate separate source map files.
 */
export type Sourcemap = "external" | "inline" | "linked" | "none" | boolean;

/**
 * Supported output module transpileFormats for built packages.
 * - esm: ECMAScript modules (import/export)
 * - cjs: CommonJS modules (require/exports)
 * - iife: Immediately Invoked Function Expression (for browsers)
 */
export type transpileFormat = "cjs" | "esm" | "iife";

/**
 * Supported transpileTarget runtime environments for built packages.
 * - node: Optimized for Node.js.
 * - bun: Optimized for Bun.
 * - browser: Optimized for web browsers.
 */
export type transpileTarget = "browser" | "bun" | "node";
