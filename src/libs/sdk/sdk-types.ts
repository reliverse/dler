import type { FilterPattern } from "@rollup/pluginutils";
import type { CommonOptions, Loader } from "esbuild";
import type { Hookable } from "hookable";
import type { Jiti, JitiOptions } from "jiti";
import type { PackageJson } from "pkg-types";
import type { WatcherOptions } from "rollup";
import type { Schema } from "untyped";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Defines the configuration for building and publishing packages. This includes: versioning,
 * build settings, publishing options, libraries-dler-plugin built-in plugin, and more.
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
   * @default ["package.json", ".config/rse.ts"]
   */
  bumpFilter: string[];

  /**
   * Specifies how the version number should be incremented:
   * - `patch`: Increments the patch version for backwards-compatible bug fixes (1.2.3 → 1.2.4)
   * - `minor`: Increments the minor version for new backwards-compatible features (1.2.3 → 1.3.0)
   * - `major`: Increments the major version for breaking changes (1.2.3 → 2.0.0)
   * - `auto`: Automatically determine the appropriate bump type
   * - `manual`: Set a specific version (requires bumpSet to be set)
   *
   * Please note: `dler` infers the version from the `package.json` file.
   *
   * @default "patch"
   */
  bumpMode: BumpMode;

  /**
   * Custom version to set when bumpMode is "manual".
   * Must be a valid semver version (e.g., "1.2.3").
   *
   * @default ""
   */
  bumpSet: string;

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
   * @default "mod.ts"
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
   * Directory where built files will be placed within the distribution directory.
   * For example, if set to "bin", CLI scripts will be placed in "dist-npm/bin" or "dist-jsr/bin".
   *
   * @default "bin"
   */
  coreBuildOutDir: string;

  /**
   * Configuration for CLI functionality:
   * - enabled: When `true`, indicates that the package has CLI capabilities
   * - scripts: Map of CLI script names to their entry file paths
   *   The key will be used as the command name in package.json's bin field
   *   The value should be the path to the executable script (e.g. "cli.ts")
   *
   * **The source scripts should be in your "coreEntrySrcDir" directory (by default "src")**
   *
   * @example
   * {
   *   enabled: true,
   *   scripts: {
   *     "mycli": "cli.ts",
   *     "othercmd": "other-cmd.ts"
   *   }
   * }
   *
   * @default { enabled: false, scripts: {} }
   */
  coreIsCLI: {
    enabled: boolean;
    scripts: Record<string, string>;
  };

  /**
   * Optional description that overrides the description from package.json.
   * When provided, this description will be used in the dist's package.json.
   * If not provided, the description from the original package.json will be used.
   *
   * @default `package.json`'s "description"
   */
  coreDescription: string;

  // ==========================================================================
  // JSR-only config
  // ==========================================================================

  /**
   * When `true`, allows JSR publishing even with uncommitted changes.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * It is `true` by default to make it easier for new `dler` users to publish their projects.
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
   * It is `true` by default to make it easier for new `dler` users to publish their projects.
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
   * @default ["README.md", "LICENSE"]
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
  // Libraries Dler Plugin
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
   *   "@myorg/ml1": { main: "my-lib-1/mod.ts" },
   *   "@myorg/ml2": { main: "my-lib-2/ml2-mod.ts" },
   *   "@myorg/ml3": { main: "src/libs/my-lib-3/index.js" }
   * }
   */
  libsList: Record<string, LibConfig>;

  // ==========================================================================
  // Logger setup
  // ==========================================================================

  /**
   * The name of the log file. dler uses `@reliverse/relinka` for logging.
   *
   * @default "logs/relinka.log"
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
   * Configuration for dependency removal patterns.
   * Controls which dependencies are excluded from the final package.
   *
   * Structure:
   * - `global`: Patterns that are always applied to all builds
   * - `dist-npm`: NPM-specific patterns (merged with global)
   * - `dist-jsr`: JSR-specific patterns (merged with global)
   * - `dist-libs`: Library-specific patterns (merged with global)
   *   Each library can have separate NPM and JSR patterns
   *
   * @example
   * {
   *   global: ["@types", "eslint"],
   *   "dist-npm": ["npm-specific"],
   *   "dist-jsr": ["jsr-specific"],
   *   "dist-libs": {
   *     "@myorg/lib1": {
   *       npm: ["lib1-npm-specific"],
   *       jsr: ["lib1-jsr-specific"]
   *     },
   *     "@myorg/lib2": {
   *       npm: ["lib2-npm-specific"],
   *       jsr: ["lib2-jsr-specific"]
   *     }
   *   }
   * }
   */
  removeDepsPatterns: {
    global: string[];
    "dist-npm": string[];
    "dist-jsr": string[];
    "dist-libs": Record<
      string,
      {
        npm: string[];
        jsr: string[];
      }
    >;
  };

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
   *
   * @default `package.json`'s "description"
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
   * @example "my-lib-1/mod.ts"
   * @example "my-lib-2/ml2-mod.ts"
   * @example "src/libs/my-lib-3/index.js"
   */
  libMainFile: string;

  /**
   * Dependencies to include in the dist's package.json.
   * The final output may vary based on `removeDepsPatterns`.
   * Defines how dependencies are handled during publishing:
   * - `string[]`: Includes only the specified dependencies.
   * - `true`: Includes all dependencies from the main package.json.
   * - `false` or `undefined`: Automatically determines dependencies based on imports.
   *
   * @example ["@reliverse/pathkit", "@reliverse/relifso"] - Only will include these specific dependencies.
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

  /**
   * When true, pauses publishing for this specific library (overridden by commonPubPause).
   * If true, this library will be built but not published, even if other libs are published.
   *
   * @default false
   */
  libPubPause?: boolean;

  /**
   * The registry to publish the library to.
   *
   * @default "npm"
   */
  libPubRegistry?: "jsr" | "npm" | "npm-jsr";
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type CopyBuildEntry = BaseBuildEntry & {
  builder: "copy";
  pattern?: string | string[];
};

export type CopyHooks = {
  "copy:done": (ctx: BuildContext) => Promise<void> | void;
  "copy:entries": (
    ctx: BuildContext,
    entries: CopyBuildEntry[],
  ) => Promise<void> | void;
};

import type { MkdistOptions } from "mkdist";

export type MkdistBuildEntry = _BaseAndMkdist & {
  builder: "mkdist";
};
export type MkdistHooks = {
  "mkdist:done": (ctx: BuildContext) => Promise<void> | void;
  "mkdist:entries": (
    ctx: BuildContext,
    entries: MkdistBuildEntry[],
  ) => Promise<void> | void;
  "mkdist:entry:build": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    output: { writtenFiles: string[] },
  ) => Promise<void> | void;
  "mkdist:entry:options": (
    ctx: BuildContext,
    entry: MkdistBuildEntry,
    options: MkdistOptions,
  ) => Promise<void> | void;
};

type _BaseAndMkdist = BaseBuildEntry & MkdistOptions;

import type { BumpMode } from "@reliverse/bleump";
import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupCommonJSOptions } from "@rollup/plugin-commonjs";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type {
  RollupOptions as _RollupOptions,
  OutputOptions,
  Plugin,
  RollupBuild,
} from "rollup";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";

export type RollupBuildEntry = BaseBuildEntry & {
  builder: "rollup";
};

export type EsbuildOptions = CommonOptions & {
  exclude?: FilterPattern;
  include?: FilterPattern;

  /**
   * Map extension to transpileEsbuild loader
   * Note that each entry (the extension) needs to start with a dot
   */
  loaders?: Record<string, false | Loader>;
};

export type RollupBuildOptions = {
  /**
   * Alias plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-alias](https://npmjs.com/package/@rollup/plugin-alias)
   */
  alias: false | RollupAliasOptions;

  /**
   * If enabled, dler generates CommonJS polyfills for ESM builds.
   */
  cjsBridge?: boolean;

  /**
   * CommonJS plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-commonjs](https://npmjs.com/package/@rollup/plugin-commonjs)
   */
  commonjs: false | RollupCommonJSOptions;

  /**
   * DTS plugin options
   * Set to `false` to disable the plugin.
   * Read more: [rollup-plugin-dts](https://npmjs.com/package/rollup-plugin-dts)
   */
  dts: RollupDtsOptions;

  /**
   * If enabled, dler generates a CommonJS build in addition to the ESM build.
   */
  emitCJS?: boolean;

  /**
   * ESBuild plugin options
   * Set to `false` to disable the plugin.
   * Read more: [transpileEsbuild](https://npmjs.com/package/transpileEsbuild)
   */
  esbuild: EsbuildOptions | false;

  /**
   * Whether to inline dependencies not explicitly set in "dependencies" or "peerDependencies" or as marked externals to the bundle.
   *
   * If set to true, all such dependencies will be inlined.
   * If an array of string or regular expressions is passed, these will be used to determine whether to inline such a dependency.
   */
  inlineDependencies?: (RegExp | string)[] | boolean;

  /**
   * JSON plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-json](https://npmjs.com/package/@rollup/plugin-json)
   */
  json: false | RollupJsonOptions;

  /**
   * Rollup [Output Options](https://rollupjs.org/configuration-options)
   */
  output?: OutputOptions;

  /**
   * Preserve dynamic imports as-is
   */
  preserveDynamicImports?: boolean;

  /**
   * Replace plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-replace](https://npmjs.com/package/@rollup/plugin-replace)
   */
  replace: false | RollupReplaceOptions;

  /**
   * Resolve plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-node-resolve](https://npmjs.com/package/@rollup/plugin-node-resolve)
   */
  resolve: false | RollupNodeResolveOptions;

  /**
   * Enable experimental active watcher
   *
   * @experimental
   */
  watch?: boolean;
};

export type RollupHooks = {
  "rollup:build": (
    ctx: BuildContext,
    build: RollupBuild,
  ) => Promise<void> | void;
  "rollup:done": (ctx: BuildContext) => Promise<void> | void;
  "rollup:dts:build": (
    ctx: BuildContext,
    build: RollupBuild,
  ) => Promise<void> | void;
  "rollup:dts:options": (
    ctx: BuildContext,
    options: RollupOptions,
  ) => Promise<void> | void;
  "rollup:options": (
    ctx: BuildContext,
    options: RollupOptions,
  ) => Promise<void> | void;
};

export type RollupOptions = _RollupOptions & {
  plugins: Plugin[];
};

export type UntypedBuildEntry = BaseBuildEntry & {
  builder: "untyped";
  defaults?: Record<string, any>;
};

export type UntypedHooks = {
  "untyped:done": (ctx: BuildContext) => Promise<void> | void;
  "untyped:entries": (
    ctx: BuildContext,
    entries: UntypedBuildEntry[],
  ) => Promise<void> | void;
  "untyped:entry:options": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    options: any,
  ) => Promise<void> | void;
  "untyped:entry:outputs": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    outputs: UntypedOutputs,
  ) => Promise<void> | void;
  "untyped:entry:schema": (
    ctx: BuildContext,
    entry: UntypedBuildEntry,
    schema: Schema,
  ) => Promise<void> | void;
};

export type UntypedOutput = {
  contents: string;
  fileName: string;
};

export type UntypedOutputs = {
  declaration?: UntypedOutput;
  defaults: UntypedOutput;
  markdown: UntypedOutput;
  schema: UntypedOutput;
};

export type BaseBuildEntry = {
  builder?: "copy" | "mkdist" | "rollup" | "untyped";
  declaration?: "compatible" | "node16" | boolean;
  input: string;
  name?: string;
  outDir?: string;
  isLib: boolean;
};

export type BuildContext = {
  buildEntries: {
    bytes?: number;
    chunk?: boolean;
    chunks?: string[];
    exports?: string[];
    modules?: { bytes: number; id: string }[];
    path: string;
    isLib: boolean;
  }[];
  hooks: Hookable<BuildHooks>;
  jiti: Jiti;
  options: BuildOptions;

  pkg: PackageJson;
  usedImports: Set<string>;
  warnings: Set<string>;
  isLib: boolean;
};

export type BuildEntry =
  | BaseBuildEntry
  | CopyBuildEntry
  | MkdistBuildEntry
  | RollupBuildEntry
  | UntypedBuildEntry;

export type BuildHooks = CopyHooks &
  MkdistHooks &
  RollupHooks &
  UntypedHooks & {
    "build:before": (ctx: BuildContext) => Promise<void> | void;
    "build:done": (ctx: BuildContext) => Promise<void> | void;
    "build:prepare": (ctx: BuildContext) => Promise<void> | void;
  };

export type BuildOptions = {
  /**
   * Create aliases for module imports to reference modules in code using more concise paths.
   * Allow you to specify an alias for the module path.
   */
  alias: Record<string, string>;

  /**
   * Clean the output directory before building.
   */
  clean: boolean;

  /**
   * Whether to generate declaration files.
   * * `compatible` means "src/index.ts" will generate "dist/index.d.mts", "dist/index.d.cts" and "dist/index.d.ts".
   * * `node16` means "src/index.ts" will generate "dist/index.d.mts" and "dist/index.d.cts".
   * * `true` is equivalent to `compatible`.
   * * `false` will disable declaration generation.
   * * `undefined` will auto detect based on "package.json". If "package.json" has "types" field, it will be `"compatible"`, otherwise `false`.
   */
  declaration?: "compatible" | "node16" | boolean;

  dependencies: string[];

  devDependencies: string[];

  /**
   * Build entries.
   */
  entries: BuildEntry[];

  /**
   * Used to specify which modules or libraries should be considered
   * external dependencies and not included in the final build product.
   */
  externals: (RegExp | string)[];

  /**
   * Terminate the build process when a warning appears
   */
  failOnWarn?: boolean;

  /**
   * Whether the current build is for a library.
   */
  isLib: boolean;

  /**
   * The name of the project.
   */
  name: string;

  /**
   * Output directory.
   */
  outDir: string;

  /**
   * Run different types of builds (untyped, mkdist, Rollup, copy) simultaneously.
   */
  parallel: boolean;

  peerDependencies: string[];

  /**
   * Replace the text in the source code with rules.
   */
  replace: Record<string, string>;

  /**
   * [Rollup](https://rollupjs.org/configuration-options) Build Options
   */
  rollup: RollupBuildOptions;

  /**
   * The root directory of the project.
   */
  rootDir: string;

  /**
   * Hide output logs during the build process.
   * When true, suppresses non-essential console output.
   */
  showOutLog?: boolean;

  /**
   * @experimental
   * Generate source mapping file.
   */
  transpileSourcemap: boolean;

  /**
   * Whether to build with JIT transpileStubs.
   * Read more: [transpileStubbing](https://antfu.me/posts/publish-esm-and-cjs#transpileStubbing)
   */
  transpileStub: boolean;

  /**
   * Stub options, where [jiti](https://github.com/unjs/jiti)
   * is an object of type `Omit<JitiOptions, "transform" | "onError">`.
   */
  transpileStubOptions: { jiti: Omit<JitiOptions, "onError" | "transform"> };

  /**
   * Whether to build and actively transpileWatch the file changes.
   *
   * @experimental This feature is experimental and incomplete.
   */
  transpileWatch: boolean;

  /**
   * Watch mode options.
   */
  transpileWatchOptions: undefined | WatcherOptions;
};

export type BuildPreset = (() => UnifiedBuildConfig) | UnifiedBuildConfig;

/**
 * In addition to basic `entries`, `presets`, and `hooks`,
 * there are also all the properties of `BuildOptions` except for BuildOptions's `entries`.
 */
export type UnifiedBuildConfig = DeepPartial<Omit<BuildOptions, "entries">> & {
  /**
   * Specify the entry file or entry module during the construction process.
   */
  entries?: (BuildEntry | string)[];

  /**
   * Used to define hook functions during the construction process to perform custom operations during specific construction stages.
   * This configuration allows you to insert custom logic during the build process to meet specific requirements or perform additional operations.
   */
  hooks?: Partial<BuildHooks>;

  /**
   * Used to specify the preset build configuration.
   */
  preset?: BuildPreset | string;

  /**
   * Used to create a stub for the build configuration.
   * A stub is a simplified version of a mock object that is used to simulate the behavior of a real object.
   * It is used to test the behavior of the object under test.
   * @see https://turing.com/kb/stub-vs-mock#what-exactly-is-a-stub?
   */
  stub?: boolean;
};

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type PerfTimer = {
  pausedAt: null | number;
  pausedDuration: number;
  startTime: number;
};

/** Options common to both NPM and JSR build targets */
/* export type BaseLibBuildOptions = {
  libName: string;
  mainDir: string; // Source directory (e.g., "src") - Used mainly for pre-build replacements
  libMainFile: string; // Relative path of the main entry file within its source dir
  isDev: boolean;
  libsList: Record<string, LibConfig>;
  removeDepsPatterns: {
    global: string[];
    "dist-npm": string[];
    "dist-jsr": string[];
    "dist-libs": Record<string, { npm: string[]; jsr: string[] }>;
  };
  timer: PerfTimer;
}; */

/** Options specific to the transpilation/bundling process */
/* export type TranspileOptions = {
  transpileTarget: transpileTarget;
  transpileFormat: transpileFormat;
  transpileSplitting: boolean;
  libTranspileMinify: boolean;
  transpileSourcemap: Sourcemap;
  transpilePublicPath: string;
  transpileEsbuild: Esbuild;
  transpileStub: boolean;
  transpileWatch: boolean; // Potentially used by bundlers
  unifiedBundlerOutExt: NpmOutExt; // Output extension for bun/unified builders
}; */
