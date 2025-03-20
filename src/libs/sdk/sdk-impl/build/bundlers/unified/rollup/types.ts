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

import type {
  BaseBuildEntry,
  BuildContext,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

import type { EsbuildOptions } from "./plugins/esbuild.js";

export type RollupBuildEntry = BaseBuildEntry & {
  builder: "rollup";
};

export type RollupBuildOptions = {
  /**
   * Alias plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-alias](https://npmjs.com/package/@rollup/plugin-alias)
   */
  alias: false | RollupAliasOptions;

  /**
   * If enabled, relidler generates CommonJS polyfills for ESM builds.
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
   * If enabled, relidler generates a CommonJS build in addition to the ESM build.
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
