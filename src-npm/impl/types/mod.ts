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
  AcceptedPlugin as PostcssPlugin,
  ProcessOptions as PostcssProcessOptions,
} from "postcss";
import type { Options as PostcssNestedOptions } from "postcss-nested";
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

export type { TemplateUpdateInfo } from "~/impl/add/add-local/core/templates.js";
export type { ShowMenuResult } from "~/impl/add/add-local/core/types.js";
export type {
  RuleRepo,
  UnghRepoResponse,
} from "~/impl/add/add-rule/add-rule-types.js";
export type {
  AIAgentOptions,
  AiSdkAgent,
  CircularTrigger,
} from "~/impl/ai/ai-impl/ai-types.js";
export type { LintSuggestion } from "~/impl/ai/ai-impl/relinter/relinter.js";
export type { MainMenuChoice } from "~/impl/init/use-template/cp-modules/cli-main-modules/cli-menu-items/getMainMenuOptions.js";
export type {
  KeyType,
  KnownService,
} from "~/impl/init/use-template/cp-modules/compose-env-file/cef-keys.js";
export type { ConfigurationOptions } from "~/impl/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-config.js";
export type { VercelTeam } from "~/impl/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-team.js";
export type {
  DeploymentLog,
  DeploymentLogType,
  DeploymentOptions,
  EnvVar,
  VercelDeploymentConfig,
  VercelFramework,
} from "~/impl/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-types.js";
export type { GenCfg, GenCfgJsonc } from "~/impl/mrse/mrse-impl.js";
export type { UploadFile } from "~/impl/upload/providers/providers-mod.js";
export type { UploadedUCFile } from "~/impl/upload/providers/uploadcare.js";
export type { UploadedFile } from "~/impl/upload/providers/uploadthing.js";
export type {
  DetectionSource,
  DetectOptions,
  PackageManager,
  PkgManagerInfo,
} from "~/impl/utils/dependencies/getUserPkgManager.js";
export type { DownloadResult } from "~/impl/utils/downloading/downloadRepo.js";
export type { ScriptStatus } from "~/impl/utils/handlers/promptPackageJsonScripts.js";
export type { InstanceGithub } from "~/impl/utils/instanceGithub.js";
export type { InstanceVercel } from "~/impl/utils/instanceVercel.js";
export type {
  CategoryFromSchema,
  CloneOrTemplateRepo,
  RepoFromSchema,
  RepoOption,
} from "~/impl/utils/projectRepository.js";
export type { ReplaceConfig } from "~/impl/utils/replacements/reps-impl.js";
export type { Hardcoded, UrlPatterns } from "~/impl/utils/replacements/reps-keys.js";
export { handleReplacements } from "~/impl/utils/replacements/reps-mod.js";
export type {
  EncryptedDataMemory,
  ReliverseMemory,
  UserDataMemory,
} from "~/impl/utils/schemaMemory.js";
export type { RepoInfo, ReposConfig } from "~/impl/utils/schemaTemplate.js";

import type { Static } from "@sinclair/typebox";

import type { rseSchema } from "~/impl/config/cfg-schema";

export type RseConfig = Static<typeof rseSchema>;

export type ProjectCategory = Exclude<RseConfig["projectCategory"], undefined>;

export type ProjectSubcategory = Exclude<RseConfig["projectSubcategory"], undefined>;

export type ProjectFramework = Exclude<RseConfig["projectFramework"], undefined>;

export type ProjectArchitecture = Exclude<RseConfig["projectArchitecture"], undefined>;

export type RelinterConfirm = Exclude<RseConfig["relinterConfirm"], undefined>;

export type IterableError = Iterable<{
  schema: unknown;
  path: string;
  value: unknown;
  message: string;
}>;

export interface DetectedProject {
  name: string;
  path: string;
  config: RseConfig;
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
  trailingComma?: boolean;
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
      trailingComma?: "all" | "es5" | "none";
      quoteStyle?: "single" | "double";
      semicolons?: "always" | "never";
    };
  };
};

export type DeploymentService = "vercel" | "deno" | "netlify" | "railway" | "none";

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
  config: RseConfig;
  mrse: RseConfig[];
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

export type MonorepoType = "turborepo" | "moonrepo" | "bun-workspaces" | "pnpm-workspaces";

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

export type HyphenatedStringToCamelCase<S extends string> = S extends `${infer T}-${infer U}`
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
  "copy:entries": (ctx: BuildContext, entries: CopyBuildEntry[]) => Promise<void> | void;
}

export type MkdistBuildEntry = _BaseAndMkdist & {
  builder: "mkdist";
};
export interface MkdistHooks {
  "mkdist:done": (ctx: BuildContext) => Promise<void> | void;
  "mkdist:entries": (ctx: BuildContext, entries: MkdistBuildEntry[]) => Promise<void> | void;
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
  "rollup:build": (ctx: BuildContext, build: RollupBuild) => Promise<void> | void;
  "rollup:done": (ctx: BuildContext) => Promise<void> | void;
  "rollup:dts:build": (ctx: BuildContext, build: RollupBuild) => Promise<void> | void;
  "rollup:dts:options": (ctx: BuildContext, options: RollupOptions) => Promise<void> | void;
  "rollup:options": (ctx: BuildContext, options: RollupOptions) => Promise<void> | void;
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
  "untyped:entries": (ctx: BuildContext, entries: UntypedBuildEntry[]) => Promise<void> | void;
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

export type DirectoryType = "src" | "dist-npm" | "dist-jsr" | "dist-libs/npm" | "dist-libs/jsr";

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

export type LoadFile = (input: InputFile) => LoaderResult | Promise<LoaderResult>;

interface LoaderOptions {
  ext?: "js" | "mjs" | "cjs" | "ts" | "mts" | "cts";
  format?: "cjs" | "esm";
  declaration?: boolean;
  esbuild?: CommonOptions;
  postcss?:
    | false
    | {
        nested?: false | PostcssNestedOptions;
        autoprefixer?: false | AutoprefixerOptions;
        cssnano?: false | CssnanoOptions;
        plugins?: PostcssPlugin[];
        processOptions?: Omit<PostcssProcessOptions, "from">;
      };
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
type LoaderName = "js" | "vue" | "sass" | "postcss";

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

// ==========================================================================
// Relinka Logger Types (integrated from @reliverse/relinka)
// ==========================================================================

/** Configuration for directory-related settings. */
export interface RelinkaDirsConfig {
  maxLogFiles?: number;
}

/** Log level types used by the logger. */
export type LogLevel =
  | "error"
  | "fatal"
  | "info"
  | "success"
  | "verbose"
  | "warn"
  | "log"
  | "internal"
  | "null"
  | "step"
  | "box"
  | "message";

/** Configuration for a single log level. */
export interface LogLevelConfig {
  /**
   * Symbol to display for this log level.
   * @see https://symbl.cc
   */
  symbol: string;

  /**
   * Fallback symbol to use if Unicode is not supported.
   */
  fallbackSymbol: string;

  /**
   * Color to use for this log level.
   */
  color: string;

  /**
   * Number of spaces after the symbol/fallback
   */
  spacing?: number;
}

/** Configuration for all log levels. */
export type LogLevelsConfig = Partial<Record<LogLevel, LogLevelConfig>>;

/**
 * Configuration options for the Relinka logger.
 * All properties are optional to allow for partial configuration.
 * Defaults will be applied during initialization.
 */
export interface RelinkaConfig {
  /**
   * Enables verbose (aka debug) mode for detailed logging.
   *
   * `true` here works only for end-users of CLIs/libs when theirs developers
   * has been awaited for user's config via `@reliverse/relinka`'s `await relinkaConfig;`
   */
  verbose?: boolean;

  /**
   * Configuration for directory-related settings.
   * - `maxLogFiles`: The maximum number of log files to keep before cleanup.
   */
  dirs?: RelinkaDirsConfig;

  /**
   * Disables color output in the console.
   */
  disableColors?: boolean;

  /**
   * Configuration for log file output.
   */
  logFile?: {
    /**
     * Path to the log file.
     */
    outputPath?: string;
    /**
     * How to handle date in the filename.
     * - `disable`: No date prefix/suffix
     * - `append-before`: Add date before the filename (e.g., "2024-01-15-log.txt")
     * - `append-after`: Add date after the filename (e.g., "log-2024-01-15.txt")
     */
    nameWithDate?: "disable" | "append-before" | "append-after";
    /**
     * If true, clears the log file when relinkaConfig is executed with supportFreshLogFile: true.
     * This is useful for starting with a clean log file on each run.
     */
    freshLogFile?: boolean;
  };

  /**
   * If true, logs will be saved to a file.
   */
  saveLogsToFile?: boolean;

  /**
   * Configuration for timestamp in log messages.
   */
  timestamp?: {
    /**
     * If true, timestamps will be added to log messages.
     */
    enabled: boolean;
    /**
     * The format for timestamps. Default is YYYY-MM-DD HH:mm:ss.SSS
     */
    format?: string;
  };

  /**
   * Allows to customize the log levels.
   */
  levels?: LogLevelsConfig;

  /**
   * Controls how often the log cleanup runs (in milliseconds)
   * Default: 10000 (10 seconds)
   */
  cleanupInterval?: number;

  /**
   * Maximum size of the log write buffer before flushing to disk (in bytes)
   * Default: 4096 (4KB)
   */
  bufferSize?: number;

  /**
   * Maximum time to hold logs in buffer before flushing to disk (in milliseconds)
   * Default: 5000 (5 seconds)
   */
  maxBufferAge?: number;
}

/**
 * Defines the configuration for building and publishing packages. This includes: versioning,
 * build settings, publishing options, libraries-dler-plugin built-in plugin, and more.
 * It customizes the build and publish pipeline for both NPM and JSR registries.
 */
export interface DlerConfig {
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

  /**
   * When `true`, displays detailed build and publish logs.
   * When `false`, only shows spinner with status messages during build and publish.
   *
   * @default true
   */
  displayBuildPubLogs: boolean;

  // ==========================================================================
  // Core configuration
  // ==========================================================================

  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   * Essential for providing type intranspileFormation to TypeScript users.
   *
   * To reduce bundle size you can set this to `false` if your main project
   * is planned to be used only as a global CLI tool (e.g. `bunx dler`).
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
   * @default ".logs/relinka.log"
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
   * Configuration for dependency removal/injection patterns.
   * Controls which dependencies are excluded from (or injected into) the final package.
   *
   * Pattern types:
   * - Regular patterns: Exclude deps that match the pattern
   * - Negation patterns (starting with !): Don't exclude deps that match the pattern
   * - Add patterns (starting with +): Inject deps into specific dists even if original package.json doesn't have them
   *
   * Structure (dist-specific patterns are merged with global):
   * - `global`: Patterns that are always applied to all builds
   * - `dist-npm`: NPM-specific patterns
   * - `dist-jsr`: JSR-specific patterns
   * - `dist-libs`: Library-specific patterns
   *   Each library can have separate NPM and JSR patterns
   *
   * @example
   * {
   *   global: ["@types", "eslint"],
   *   "dist-npm": ["npm-specific"],
   *   "dist-jsr": ["+bun"], // Explicitly include 'bun' in JSR builds
   *   "dist-libs": {
   *     "@myorg/lib1": {
   *       npm: ["lib1-npm-specific"],
   *       jsr: ["+bun"] // Explicitly include 'bun' in this lib's JSR build
   *     }
   *   }
   * }
   */
  filterDepsPatterns: {
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
  // Code quality tools
  // ==========================================================================

  /**
   * List of tools to run before the build process starts.
   * Available options: "tsc", "eslint", "biome", "knip", "dler-check"
   * Each tool will only run if it's installed in the system.
   *
   * @default []
   */
  runBeforeBuild: ("tsc" | "eslint" | "biome" | "knip" | "dler-check")[];

  /**
   * List of tools to run after the build process completes.
   * Available options: "dler-check"
   * Each tool will only run if it's installed in the system.
   *
   * @default []
   */
  runAfterBuild: "dler-check"[];

  // ==========================================================================
  // Build hooks
  // ==========================================================================

  /**
   * Array of functions to be executed before the build process starts.
   * These hooks will be called in sequence before any build steps.
   *
   * If you are a dler plugin developer, tell your users to
   * call your plugin's `beforeBuild`-related function here.
   *
   * @example
   * hooksBeforeBuild: [
   *   async () => {
   *     // Custom pre-build logic
   *     await someAsyncOperation();
   *
   *     // dler-plugin-my-plugin-name
   *     await myPluginName_beforeBuild();
   *   }
   * ]
   *
   * @default []
   */
  hooksBeforeBuild: (() => Promise<void>)[];

  /**
   * Array of functions to be executed after the build process completes.
   * These hooks will be called in sequence after all build steps.
   *
   * If you are a dler plugin developer, tell your users to
   * call your plugin's `afterBuild`-related function here.
   *
   * @example
   * hooksAfterBuild: [
   *   async () => {
   *     // Custom post-build logic
   *     await someAsyncOperation();
   *
   *     // dler-plugin-my-plugin-name
   *     await myPluginName_afterBuild();
   *   }
   * ]
   *
   * @default []
   */
  hooksAfterBuild: (() => Promise<void>)[];

  /**
   * When `true`, cleans up the temporary directories after the build process completes.
   *
   * @default true
   */
  postBuildSettings: {
    deleteDistTmpAfterBuild: boolean;
  };

  // ==========================================================================
  // Build setup
  // ==========================================================================

  /**
   * When `true`, fails the build if warnings are detected.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * @default false
   */
  transpileFailOnWarn: boolean;

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

  /**
   * Specifies what resources to send to npm and jsr registries.
   * coreBuildOutDir (e.g. "bin") dir is automatically included.
   * The following is also included if publishArtifacts is {}:
   * - global: ["package.json", "README.md", "LICENSE"]
   * - dist-jsr,dist-libs/jsr: ["jsr.json"]
   *
   * Structure:
   * - `global`: Files to include in all distributions
   * - `dist-jsr`: Files specific to JSR distribution
   * - `dist-npm`: Files specific to NPM distribution
   * - `dist-libs`: Library-specific files for each distribution type
   *
   * Useful for including additional files like configuration or documentation.
   * Pro tip: set jsr.jsonc to generate jsr.jsonc instead of jsr.json config.
   *
   * @default
   * {
   *   global: ["bin", "package.json", "README.md", "LICENSE"],
   *   "dist-jsr": ["jsr.json"],
   *   "dist-npm": [],
   *   "dist-libs": {
   *     "@myorg/lib1": {
   *       jsr: ["jsr.json"],
   *       npm: []
   *     }
   *   }
   * }
   */
  publishArtifacts?: {
    global: string[];
    "dist-jsr": string[];
    "dist-npm": string[];
    "dist-libs": Record<
      string,
      {
        jsr: string[];
        npm: string[];
      }
    >;
  };

  // Files with these extensions will be built
  // Any other files will be copied as-is to dist
  /**
   * File extensions that should be copied to temporary build directories during pre-build.
   * These files will be processed by the bundlers.
   * All other files will be copied as-is to final dist directories during post-build.
   * @default ["ts", "js"]
   */
  buildPreExtensions: string[];

  // If you need to exclude some ts/js files from being built,
  // you can store them in the dirs with buildTemplatesDir name
  /**
   * Directory name for templates that should be excluded from pre-build processing.
   * Files in this directory will be copied as-is during post-build.
   * @default "templates"
   */
  buildTemplatesDir: string;

  // ==========================================================================
  // Relinka Logger Configuration
  // ==========================================================================

  /**
   * Integrated relinka logger configuration.
   * @see https://github.com/reliverse/relinka
   *
   * @default See DEFAULT_RELINKA_CONFIG in defaults
   */
  relinka: RelinkaConfig;
}

export type BumpMode = "patch" | "minor" | "major" | "auto" | "manual";

/**
 * Supported bundler names for building packages:
 * - bun: Bun's built-in bundler for fast builds
 * - copy: A simple file copy without bundling
 * - jsr: Similar to copy but optimized for the JSR commonPubRegistry
 * - mkdist: A lightweight bundler focused on TypeScript/ESM
 * - rollup: A traditional bundler with an extensive plugin ecosystem
 * - untyped: Types and markdown generation from a config object
 */
export type BundlerName = "bun" | "copy" | "jsr" | "mkdist" | "rollup" | "untyped";

export type NpmOutExt = "cjs" | "cts" | "js" | "mjs" | "mts" | "ts";

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 */
export interface LibConfig {
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
   * The final output may vary based on `filterDepsPatterns`.
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

  /**
   * Optional version override for the library.
   * If not provided, falls back to the version from the main package.json.
   *
   * @default `package.json`'s "version"
   */
  version?: string;
}

export type Esbuild = "es2019" | "es2020" | "es2021" | "es2022" | "es2023";

/**
 * Supported output module transpileFormats for built packages.
 * - esm: ECMAScript modules (import/export)
 * - cjs: CommonJS modules (require/exports)
 * - iife: Immediately Invoked Function Expression (for browsers)
 */
export type transpileFormat = "cjs" | "esm" | "iife";

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
 * Supported transpileTarget runtime environments for built packages.
 * - node: Optimized for Node.js.
 * - bun: Optimized for Bun.
 * - browser: Optimized for web browsers.
 */
export type transpileTarget = "browser" | "bun" | "node";

///////////////////

// ==========================================================================
// Relinka Logger Types (integrated from @reliverse/relinka)
// ==========================================================================

/** Configuration for directory-related settings. */
export interface RelinkaDirsConfig {
  maxLogFiles?: number;
}

/** Configuration for a single log level. */
export interface LogLevelConfig {
  /**
   * Symbol to display for this log level.
   * @see https://symbl.cc
   */
  symbol: string;

  /**
   * Fallback symbol to use if Unicode is not supported.
   */
  fallbackSymbol: string;

  /**
   * Color to use for this log level.
   */
  color: string;

  /**
   * Number of spaces after the symbol/fallback
   */
  spacing?: number;
}

/**
 * Configuration options for the Relinka logger.
 * All properties are optional to allow for partial configuration.
 * Defaults will be applied during initialization.
 */
export interface RelinkaConfig {
  /**
   * Enables verbose (aka debug) mode for detailed logging.
   *
   * `true` here works only for end-users of CLIs/libs when theirs developers
   * has been awaited for user's config via `@reliverse/relinka`'s `await relinkaConfig;`
   */
  verbose?: boolean;

  /**
   * Configuration for directory-related settings.
   * - `maxLogFiles`: The maximum number of log files to keep before cleanup.
   */
  dirs?: RelinkaDirsConfig;

  /**
   * Disables color output in the console.
   */
  disableColors?: boolean;

  /**
   * Configuration for log file output.
   */
  logFile?: {
    /**
     * Path to the log file.
     */
    outputPath?: string;
    /**
     * How to handle date in the filename.
     * - `disable`: No date prefix/suffix
     * - `append-before`: Add date before the filename (e.g., "2024-01-15-log.txt")
     * - `append-after`: Add date after the filename (e.g., "log-2024-01-15.txt")
     */
    nameWithDate?: "disable" | "append-before" | "append-after";
    /**
     * If true, clears the log file when relinkaConfig is executed with supportFreshLogFile: true.
     * This is useful for starting with a clean log file on each run.
     */
    freshLogFile?: boolean;
  };

  /**
   * If true, logs will be saved to a file.
   */
  saveLogsToFile?: boolean;

  /**
   * Configuration for timestamp in log messages.
   */
  timestamp?: {
    /**
     * If true, timestamps will be added to log messages.
     */
    enabled: boolean;
    /**
     * The format for timestamps. Default is YYYY-MM-DD HH:mm:ss.SSS
     */
    format?: string;
  };

  /**
   * Allows to customize the log levels.
   */
  levels?: LogLevelsConfig;

  /**
   * Controls how often the log cleanup runs (in milliseconds)
   * Default: 10000 (10 seconds)
   */
  cleanupInterval?: number;

  /**
   * Maximum size of the log write buffer before flushing to disk (in bytes)
   * Default: 4096 (4KB)
   */
  bufferSize?: number;

  /**
   * Maximum time to hold logs in buffer before flushing to disk (in milliseconds)
   * Default: 5000 (5 seconds)
   */
  maxBufferAge?: number;
}

/**
 * Defines the configuration for building and publishing packages. This includes: versioning,
 * build settings, publishing options, libraries-dler-plugin built-in plugin, and more.
 * It customizes the build and publish pipeline for both NPM and JSR registries.
 */
export interface DlerConfig {
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

  /**
   * When `true`, displays detailed build and publish logs.
   * When `false`, only shows spinner with status messages during build and publish.
   *
   * @default true
   */
  displayBuildPubLogs: boolean;

  // ==========================================================================
  // Core configuration
  // ==========================================================================

  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   * Essential for providing type intranspileFormation to TypeScript users.
   *
   * To reduce bundle size you can set this to `false` if your main project
   * is planned to be used only as a global CLI tool (e.g. `bunx dler`).
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
   * @default ".logs/relinka.log"
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
   * Configuration for dependency removal/injection patterns.
   * Controls which dependencies are excluded from (or injected into) the final package.
   *
   * Pattern types:
   * - Regular patterns: Exclude deps that match the pattern
   * - Negation patterns (starting with !): Don't exclude deps that match the pattern
   * - Add patterns (starting with +): Inject deps into specific dists even if original package.json doesn't have them
   *
   * Structure (dist-specific patterns are merged with global):
   * - `global`: Patterns that are always applied to all builds
   * - `dist-npm`: NPM-specific patterns
   * - `dist-jsr`: JSR-specific patterns
   * - `dist-libs`: Library-specific patterns
   *   Each library can have separate NPM and JSR patterns
   *
   * @example
   * {
   *   global: ["@types", "eslint"],
   *   "dist-npm": ["npm-specific"],
   *   "dist-jsr": ["+bun"], // Explicitly include 'bun' in JSR builds
   *   "dist-libs": {
   *     "@myorg/lib1": {
   *       npm: ["lib1-npm-specific"],
   *       jsr: ["+bun"] // Explicitly include 'bun' in this lib's JSR build
   *     }
   *   }
   * }
   */
  filterDepsPatterns: {
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
  // Code quality tools
  // ==========================================================================

  /**
   * List of tools to run before the build process starts.
   * Available options: "tsc", "eslint", "biome", "knip", "dler-check"
   * Each tool will only run if it's installed in the system.
   *
   * @default []
   */
  runBeforeBuild: ("tsc" | "eslint" | "biome" | "knip" | "dler-check")[];

  /**
   * List of tools to run after the build process completes.
   * Available options: "dler-check"
   * Each tool will only run if it's installed in the system.
   *
   * @default []
   */
  runAfterBuild: "dler-check"[];

  // ==========================================================================
  // Build hooks
  // ==========================================================================

  /**
   * Array of functions to be executed before the build process starts.
   * These hooks will be called in sequence before any build steps.
   *
   * If you are a dler plugin developer, tell your users to
   * call your plugin's `beforeBuild`-related function here.
   *
   * @example
   * hooksBeforeBuild: [
   *   async () => {
   *     // Custom pre-build logic
   *     await someAsyncOperation();
   *
   *     // dler-plugin-my-plugin-name
   *     await myPluginName_beforeBuild();
   *   }
   * ]
   *
   * @default []
   */
  hooksBeforeBuild: (() => Promise<void>)[];

  /**
   * Array of functions to be executed after the build process completes.
   * These hooks will be called in sequence after all build steps.
   *
   * If you are a dler plugin developer, tell your users to
   * call your plugin's `afterBuild`-related function here.
   *
   * @example
   * hooksAfterBuild: [
   *   async () => {
   *     // Custom post-build logic
   *     await someAsyncOperation();
   *
   *     // dler-plugin-my-plugin-name
   *     await myPluginName_afterBuild();
   *   }
   * ]
   *
   * @default []
   */
  hooksAfterBuild: (() => Promise<void>)[];

  /**
   * When `true`, cleans up the temporary directories after the build process completes.
   *
   * @default true
   */
  postBuildSettings: {
    deleteDistTmpAfterBuild: boolean;
  };

  // ==========================================================================
  // Build setup
  // ==========================================================================

  /**
   * When `true`, fails the build if warnings are detected.
   * Use with caution, as it may lead to inconsistent published versions.
   *
   * @default false
   */
  transpileFailOnWarn: boolean;

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

  /**
   * Specifies what resources to send to npm and jsr registries.
   * coreBuildOutDir (e.g. "bin") dir is automatically included.
   * The following is also included if publishArtifacts is {}:
   * - global: ["package.json", "README.md", "LICENSE"]
   * - dist-jsr,dist-libs/jsr: ["jsr.json"]
   *
   * Structure:
   * - `global`: Files to include in all distributions
   * - `dist-jsr`: Files specific to JSR distribution
   * - `dist-npm`: Files specific to NPM distribution
   * - `dist-libs`: Library-specific files for each distribution type
   *
   * Useful for including additional files like configuration or documentation.
   * Pro tip: set jsr.jsonc to generate jsr.jsonc instead of jsr.json config.
   *
   * @default
   * {
   *   global: ["bin", "package.json", "README.md", "LICENSE"],
   *   "dist-jsr": ["jsr.json"],
   *   "dist-npm": [],
   *   "dist-libs": {
   *     "@myorg/lib1": {
   *       jsr: ["jsr.json"],
   *       npm: []
   *     }
   *   }
   * }
   */
  publishArtifacts?: {
    global: string[];
    "dist-jsr": string[];
    "dist-npm": string[];
    "dist-libs": Record<
      string,
      {
        jsr: string[];
        npm: string[];
      }
    >;
  };

  // Files with these extensions will be built
  // Any other files will be copied as-is to dist
  /**
   * File extensions that should be copied to temporary build directories during pre-build.
   * These files will be processed by the bundlers.
   * All other files will be copied as-is to final dist directories during post-build.
   * @default ["ts", "js"]
   */
  buildPreExtensions: string[];

  // If you need to exclude some ts/js files from being built,
  // you can store them in the dirs with buildTemplatesDir name
  /**
   * Directory name for templates that should be excluded from pre-build processing.
   * Files in this directory will be copied as-is during post-build.
   * @default "templates"
   */
  buildTemplatesDir: string;

  // ==========================================================================
  // Relinka Logger Configuration
  // ==========================================================================

  /**
   * Integrated relinka logger configuration.
   * @see https://github.com/reliverse/relinka
   *
   * @default See DEFAULT_RELINKA_CONFIG in defaults
   */
  relinka: RelinkaConfig;
}

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 */
export interface LibConfig {
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
   * The final output may vary based on `filterDepsPatterns`.
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

  /**
   * Optional version override for the library.
   * If not provided, falls back to the version from the main package.json.
   *
   * @default `package.json`'s "version"
   */
  version?: string;
}

/**
 * Default configuration for the build and publish logic.
 */
export const DEFAULT_CONFIG_DLER: DlerConfig = {
  bumpDisable: false,
  bumpFilter: ["package.json", "reliverse.ts"],
  bumpMode: "patch",
  bumpSet: "",
  commonPubPause: true,
  commonPubRegistry: "npm",
  commonVerbose: false,
  displayBuildPubLogs: true,
  coreDeclarations: true,
  coreDescription: "",
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  coreBuildOutDir: "bin",
  coreIsCLI: { enabled: false, scripts: {} },
  distJsrAllowDirty: true,
  distJsrBuilder: "jsr",
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrFailOnWarn: false,
  distJsrGenTsconfig: false,
  distJsrOutFilesExt: "ts",
  distJsrSlowTypes: true,
  distNpmBuilder: "mkdist",
  distNpmDirName: "dist-npm",
  distNpmOutFilesExt: "js",
  libsActMode: "main-project-only",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {},
  logsFileName: ".logs/relinka.log",
  logsFreshFile: true,

  // Dependency filtering
  filterDepsPatterns: {
    global: ["@types", "biome", "eslint", "knip", "prettier", "typescript", "@reliverse/dler"],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {},
  },

  // Code quality tools
  runBeforeBuild: [], // tsc, eslint, biome, knip, dler-check
  runAfterBuild: [], // dler-check

  // Build hooks
  hooksBeforeBuild: [
    // async () => {
    //   await someAsyncOperation();
    // }
  ],
  hooksAfterBuild: [
    // async () => {
    //   await someAsyncOperation();
    // }
  ],

  postBuildSettings: {
    deleteDistTmpAfterBuild: true,
  },

  // Build setup
  transpileFailOnWarn: false,
  transpileEsbuild: "es2023",
  transpileFormat: "esm",
  transpileMinify: true,
  transpilePublicPath: "/",
  transpileSourcemap: "none",
  transpileSplitting: false,
  transpileStub: false,
  transpileTarget: "node",
  transpileWatch: false,

  // Publish artifacts configuration
  publishArtifacts: {
    global: ["package.json", "README.md", "LICENSE"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {},
  },

  // Files with these extensions will be built
  // Any other files will be copied as-is to dist
  buildPreExtensions: ["ts", "js"],
  // If you need to exclude some ts/js files from being built,
  // you can store them in the dirs with buildTemplatesDir name
  buildTemplatesDir: "templates",

  // Integrated relinka logger configuration
  relinka: {
    verbose: false,
    dirs: {
      maxLogFiles: 5,
    },
    disableColors: false,
    logFile: {
      outputPath: "logs.log",
      nameWithDate: "disable",
      freshLogFile: true,
    },
    saveLogsToFile: true,
    timestamp: {
      enabled: false,
      format: "HH:mm:ss",
    },
    cleanupInterval: 10000, // 10 seconds
    bufferSize: 4096, // 4KB
    maxBufferAge: 5000, // 5 seconds
    levels: {
      success: {
        symbol: "✓",
        fallbackSymbol: "[OK]",
        color: "greenBright",
        spacing: 3,
      },
      info: {
        symbol: "i",
        fallbackSymbol: "[i]",
        color: "cyanBright",
        spacing: 3,
      },
      error: {
        symbol: "✖",
        fallbackSymbol: "[ERR]",
        color: "redBright",
        spacing: 3,
      },
      warn: {
        symbol: "⚠",
        fallbackSymbol: "[WARN]",
        color: "yellowBright",
        spacing: 3,
      },
      fatal: {
        symbol: "‼",
        fallbackSymbol: "[FATAL]",
        color: "redBright",
        spacing: 3,
      },
      verbose: {
        symbol: "✧",
        fallbackSymbol: "[VERBOSE]",
        color: "gray",
        spacing: 3,
      },
      internal: {
        symbol: "⚙",
        fallbackSymbol: "[INTERNAL]",
        color: "magentaBright",
        spacing: 3,
      },
      log: { symbol: "│", fallbackSymbol: "|", color: "dim", spacing: 3 },
      message: {
        symbol: "🞠",
        fallbackSymbol: "[MSG]",
        color: "cyan",
        spacing: 3,
      },
    },
  },
};

// TODO: implement migrator from build.config.ts to relivereliverse.ts
// export function defineBuildConfig(
//   config: UnifiedBuildConfig | UnifiedBuildConfig[],
// ): UnifiedBuildConfig[] {
//   return (Array.isArray(config) ? config : [config]).filter(Boolean);
// }

export const defineConfig = (userConfig: Partial<DlerConfig> = {}) => {
  return { ...DEFAULT_CONFIG_DLER, ...userConfig };
};
