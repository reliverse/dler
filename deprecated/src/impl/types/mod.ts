import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupCommonJSOptions } from "@rollup/plugin-commonjs";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type { FilterPattern } from "@rollup/pluginutils";
import type { Options as AutoprefixerOptions } from "autoprefixer";
import type { Options as CssnanoOptions } from "cssnano";
import type { CommonOptions, Loader as EsbuildLoader } from "esbuild";
import type { Hookable } from "hookable";
import type { Jiti, JitiOptions } from "jiti";
import type { PackageJson, TSConfig } from "pkg-types";
import type {
  RollupOptions as _RollupOptions,
  OutputOptions,
  Plugin,
  RollupBuild,
  WatcherOptions,
} from "rollup";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";
import type { GlobOptions } from "tinyglobby";
import type { Schema } from "untyped";

import type { ReliverseMemory } from "~/impl/utils/schemaMemory";
import type { ReliverseConfig } from "../schema/mod";

export type ArgTypeShared = string | number | boolean | string[] | undefined;

export interface CommonCliArgs {
  isCI: boolean;
  isDev: boolean;
  cwdStr: string;
}

export type IterableError = Iterable<{
  schema: unknown;
  path: string;
  value: unknown;
  message: string;
}>;

export interface DetectedProject {
  name: string;
  path: string;
  config: ReliverseConfig;
  gitStatus?: {
    uncommittedChanges: number;
    unpushedCommits: number;
  };
  needsDepsInstall?: boolean;
  hasGit?: boolean;
}

export type BiomeConfigResult = {
  lineWidth?: number;
  indentStyle?: "space" | "tab";
  indentWidth?: 2 | 4 | 8;
  quoteMark?: "single" | "double";
  semicolons?: boolean;
  trailingCommas?: boolean;
} | null;

export interface BaseConfig {
  version: string;
  generatedAt: string;
}

export type BiomeConfig = BaseConfig & {
  $schema: string;
  organizeImports: {
    enabled: boolean;
  };
  formatter: {
    enabled: boolean;
    lineWidth?: number;
    indentStyle?: "space" | "tab";
    indentWidth?: 2 | 4 | 8;
  };
  linter: {
    enabled: boolean;
    rules?: {
      recommended?: boolean;
    };
  };
  javascript?: {
    formatter: {
      trailingCommas?: "all" | "es5" | "none";
      quoteStyle?: "single" | "double";
      semicolons?: "always" | "never";
    };
  };
};

export type DeploymentService =
  | "vercel"
  | "deno"
  | "netlify"
  | "railway"
  | "none";

export interface VSCodeSettings {
  "editor.formatOnSave"?: boolean;
  "editor.defaultFormatter"?: string;
  "editor.codeActionsOnSave"?: Record<string, string>;
  "eslint.ignoreUntitled"?: boolean;
  "eslint.rules.customizations"?: { rule: string; severity: string }[];
  "markdownlint.config"?: Record<string, boolean>;
  "typescript.enablePromptUseWorkspaceTsdk"?: boolean;
}

/**
 * Defines what is returned when selecting or creating a project.
 */
export interface ProjectSelectionResult {
  projectPath: string;
  wasNewlyCreated: boolean;
}

export interface AppParams {
  projectName: string;
  cwd: string;
  isDev: boolean;
  memory: ReliverseMemory;
  config: ReliverseConfig;
  mrse: ReliverseConfig[];
  skipPrompts: boolean;
}

export type ParamsOmitSkipPN = Omit<AppParams, "skipPrompts" | "projectName">;
export type ParamsOmitReli = Omit<AppParams, "mrse">;

/**
 * Minimal object describing essential project info after initialization
 */
export interface ProjectConfigReturn {
  frontendUsername: string;
  projectName: string;
  primaryDomain: string;
}

export interface GitModParams {
  cwd: string;
  isDev: boolean;
  projectPath: string;
  projectName: string;
}

export type Behavior = "prompt" | "autoYes" | "autoNo";

export type DatabasePostgresProvider = "neon" | "railway" | "vercel";

export type DatabaseProvider = "postgres" | "sqlite" | "mysql";

export interface ColumnType {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  primaryKey?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface TableSchema {
  name: string;
  columns: ColumnType[];
}

export interface SubOption {
  label: string;
  value: string;
  providers?: DatabasePostgresProvider[];
}

export interface IntegrationOption {
  label: string;
  value: string;
  subOptions?: SubOption[];
}

export type IntegrationCategory =
  | "database"
  | "payments"
  | "auth"
  | "email"
  | "styling"
  | "testing"
  | "i18n";

export type IntegrationOptions = Record<string, IntegrationOption[]>;

export type MonorepoType =
  | "turborepo"
  | "moonrepo"
  | "bun-workspaces"
  | "pnpm-workspaces";

export interface IntegrationConfig {
  name: string;
  dependencies: string[];
  devDependencies?: string[];
  files: { path: string; content: string }[];
  scripts?: Record<string, string>;
  envVars?: Record<string, string>;
  postInstall?: (cwd: string) => Promise<void>;
}

export interface RemovalConfig {
  name: string;
  dependencies: string[];
  devDependencies: string[];
  files: string[];
  directories: string[];
  scripts: string[];
  envVars: string[];
}

export interface NavigationEntry {
  items?: Record<string, NavigationEntry>;
  label?: string;
  link?: string;
}

export interface ShadcnConfig {
  style: string;
  rsc: boolean;
  tsx: boolean;
  tailwind: {
    config: string;
    css: string;
    baseColor: string;
    cssVariables: boolean;
    prefix: string;
  };
  aliases: {
    components: string;
    utils: string;
    ui: string;
    lib: string;
    hooks: string;
  };
  iconLibrary: string;
}

export interface Theme {
  name: string;
  colors: Record<string, string>;
}

export type CamelCase<T extends string> = T extends `${infer U}${infer V}`
  ? `${Uppercase<U>}${V}`
  : T;

export type HyphenatedStringToCamelCase<S extends string> =
  S extends `${infer T}-${infer U}`
    ? `${T}${HyphenatedStringToCamelCase<CamelCase<U>>}`
    : CamelCase<S>;

export type IconName =
  | "billing"
  | "dollarSign"
  | "laptop"
  | "settings"
  | "store"
  | "terminal"
  | "user";

export interface NavItem {
  description?: string;
  disabled?: boolean;
  external?: boolean;
  href: string;
  icon?: IconName;
  label?: string;
  title: string;
}

export type NavItemWithChildren = {
  items: NavItemWithChildren[];
} & NavItem;

export interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  attributes: Record<string, any>;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
}

export interface ModernReplacement {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Supported distribution directories.
 */
export type DistDirs = "dist-libs" | "dist-jsr" | "dist-npm";
export type DistDirsAll = DistDirs | "all";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type CopyBuildEntry = BaseBuildEntry & {
  builder: "copy";
  pattern?: string | string[];
};

export interface CopyHooks {
  "copy:done": (ctx: BuildContext) => Promise<void> | void;
  "copy:entries": (
    ctx: BuildContext,
    entries: CopyBuildEntry[],
  ) => Promise<void> | void;
}

export type MkdistBuildEntry = _BaseAndMkdist & {
  builder: "mkdist";
};
export interface MkdistHooks {
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
}

type _BaseAndMkdist = BaseBuildEntry & MkdistOptions;

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
  loaders?: Record<string, false | EsbuildLoader>;
};

export interface RollupBuildOptions {
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
}

export interface RollupHooks {
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
}

export type RollupOptions = _RollupOptions & {
  plugins: Plugin[];
};

export type UntypedBuildEntry = BaseBuildEntry & {
  builder: "untyped";
  defaults?: Record<string, any>;
};

export interface UntypedHooks {
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
}

export interface UntypedOutput {
  contents: string;
  fileName: string;
}

export interface UntypedOutputs {
  declaration?: UntypedOutput;
  defaults: UntypedOutput;
  markdown: UntypedOutput;
  schema: UntypedOutput;
}

export interface BaseBuildEntry {
  builder?: "copy" | "mkdist" | "rollup" | "untyped";
  declaration?: "compatible" | "node16" | boolean;
  input: string;
  name?: string;
  outDir?: string;
  isLib: boolean;
}

export interface BuildContext {
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
}

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

export interface BuildOptions {
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
   * `compatible` means "src/index.ts" will generate "dist/index.d.mts", "dist/index.d.cts" and "dist/index.d.ts".
   * `node16` means "src/index.ts" will generate "dist/index.d.mts" and "dist/index.d.cts".
   * `true` is equivalent to `compatible`.
   * `false` will disable declaration generation.
   * `undefined` will auto detect based on "package.json". If "package.json" has "types" field, it will be `"compatible"`, otherwise `false`.
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
  transpileFailOnWarn?: boolean;

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
}

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

export interface PerfTimer {
  pausedAt: null | number;
  pausedDuration: number;
  startTime: number;
}

/** Options common to both NPM and JSR build targets */
/* export type BaseLibBuildOptions = {
  libName: string;
  mainDir: string; // Source directory (e.g., "src") - Used mainly for pre-build replacements
  libMainFile: string; // Relative path of the main entry file within its source dir
  isDev: boolean;
  libsList: Record<string, LibConfig>;
  filterDepsPatterns: {
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type DirectoryType =
  | "src"
  | "dist-npm"
  | "dist-jsr"
  | "dist-libs/npm"
  | "dist-libs/jsr";

export interface RulesCheckOptions {
  directory: DirectoryType;
  strict: boolean;
  moduleResolution: "bundler" | "nodenext";
  onProgress?: (current: number, total: number, file: string) => void;
  json?: boolean;
  builtins?: boolean;
  dev?: boolean;
  peer?: boolean;
  optional?: boolean;
  fix?: boolean;
  depth?: number;
}

export interface CheckIssue {
  type:
    | "file-extension"
    | "path-extension"
    | "missing-dependency"
    | "builtin-module"
    | "dler-config-health"
    | "self-include"
    | "tsconfig-health"
    | "no-index-files";
  message: string;
  file: string;
  line?: number;
  column?: number;
}

export interface CheckResult {
  success: boolean;
  issues: CheckIssue[];
  stats: {
    filesChecked: number;
    importsChecked: number;
    timeElapsed: number;
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export interface InputFile {
  path: string;
  extension: string;
  srcPath?: string;
  getContents: () => Promise<string> | string;
}

export interface OutputFile {
  /**
   * relative to distDir
   */
  path: string;
  srcPath?: string;
  extension?: string;
  contents?: string;
  declaration?: boolean;
  errors?: Error[];
  raw?: boolean;
  skip?: boolean;
}

export type LoaderResult = OutputFile[] | undefined;

export type LoadFile = (
  input: InputFile,
) => LoaderResult | Promise<LoaderResult>;

interface LoaderOptions {
  ext?: "js" | "mjs" | "cjs" | "ts" | "mts" | "cts";
  format?: "cjs" | "esm";
  declaration?: boolean;
  esbuild?: CommonOptions;
}

export interface LoaderContext {
  loadFile: LoadFile;
  options: LoaderOptions;
}

export type Loader = (
  input: InputFile,
  context: LoaderContext,
) => LoaderResult | Promise<LoaderResult>;

// should be the same as the loaders in loaders-mod.ts
type LoaderName = "js";

export type CreateLoaderOptions = {
  loaders?: (Loader | LoaderName)[];
} & LoaderOptions;

export type MkdistOptions = {
  rootDir?: string;
  srcDir?: string;
  pattern?: string | string[];
  globOptions?: GlobOptions;
  distDir?: string;
  cleanDist?: boolean;
  loaders?: (LoaderName | Loader)[];
  addRelativeDeclarationExtensions?: boolean;
  typescript?: {
    compilerOptions?: TSConfig["compilerOptions"];
  };
} & LoaderOptions;
