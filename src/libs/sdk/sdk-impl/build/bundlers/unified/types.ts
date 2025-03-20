import type { Hookable } from "hookable";
import type { Jiti, JitiOptions } from "jiti";
import type { PackageJson } from "pkg-types";
import type { RollupOptions as _RollupOptions, WatcherOptions } from "rollup";

import type { CopyBuildEntry, CopyHooks } from "./copy/types.js";
import type { MkdistBuildEntry, MkdistHooks } from "./mkdist/types.js";
import type {
  RollupBuildEntry,
  RollupBuildOptions,
  RollupHooks,
} from "./rollup/types.js";
import type { UntypedBuildEntry, UntypedHooks } from "./untyped/types.js";

export type BaseBuildEntry = {
  builder?: "copy" | "mkdist" | "rollup" | "untyped";
  declaration?: "compatible" | "node16" | boolean;
  input: string;
  name?: string;
  outDir?: string;
};

export type { CopyBuildEntry } from "./copy/types.js";
export type { MkdistBuildEntry } from "./mkdist/types.js";
/** Bundler types */
export type {
  RollupBuildEntry,
  RollupBuildOptions,
  RollupOptions,
} from "./rollup/types.js";
export type {
  UntypedBuildEntry,
  UntypedOutput,
  UntypedOutputs,
} from "./untyped/types.js";

export type BuildContext = {
  buildEntries: {
    bytes?: number;
    chunk?: boolean;
    chunks?: string[];
    exports?: string[];
    modules?: { bytes: number; id: string }[];
    path: string;
  }[];
  hooks: Hookable<BuildHooks>;
  jiti: Jiti;
  options: BuildOptions;

  pkg: PackageJson;
  usedImports: Set<string>;
  warnings: Set<string>;
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
   * Used to specify which modules or libraries should be considered external dependencies
   * and not included in the final build product.
   */
  externals: (RegExp | string)[];

  /**
   * Terminate the build process when a warning appears
   */
  failOnWarn?: boolean;

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
};

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

export function defineBuildConfig(
  config: UnifiedBuildConfig | UnifiedBuildConfig[],
): UnifiedBuildConfig[] {
  return (Array.isArray(config) ? config : [config]).filter(Boolean);
}

export function definePreset(preset: BuildPreset): BuildPreset {
  return preset;
}
