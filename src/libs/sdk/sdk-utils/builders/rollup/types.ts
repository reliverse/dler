import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupCommonJSOptions } from "@rollup/plugin-commonjs";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type {
  RollupOptions as _RollupOptions,
  RollupBuild,
  OutputOptions,
  Plugin,
} from "rollup";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";

import type { BaseBuildEntry } from "~/libs/sdk/sdk-utils/types.js";
import type { BuildContext } from "~/libs/sdk/sdk-utils/types.js";

import type { EsbuildOptions } from "./plugins/esbuild.js";

export type RollupBuildEntry = {
  builder: "rollup";
} & BaseBuildEntry;

export type RollupBuildOptions = {
  /**
   * If enabled, relidler generates a CommonJS build in addition to the ESM build.
   */
  emitCJS?: boolean;

  /**
   * Enable experimental active watcher
   *
   * @experimental
   */
  watch?: boolean;

  /**
   * If enabled, relidler generates CommonJS polyfills for ESM builds.
   */
  cjsBridge?: boolean;

  /**
   * Preserve dynamic imports as-is
   */
  preserveDynamicImports?: boolean;

  /**
   * Whether to inline dependencies not explicitly set in "dependencies" or "peerDependencies" or as marked externals to the bundle.
   *
   * If set to true, all such dependencies will be inlined.
   * If an array of string or regular expressions is passed, these will be used to determine whether to inline such a dependency.
   */
  inlineDependencies?: boolean | (string | RegExp)[];

  /**
   * Rollup [Output Options](https://rollupjs.org/configuration-options)
   */
  output?: OutputOptions;

  /**
   * Replace plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-replace](https://npmjs.com/package/@rollup/plugin-replace)
   */
  replace: RollupReplaceOptions | false;

  /**
   * Alias plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-alias](https://npmjs.com/package/@rollup/plugin-alias)
   */
  alias: RollupAliasOptions | false;

  /**
   * Resolve plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-node-resolve](https://npmjs.com/package/@rollup/plugin-node-resolve)
   */
  resolve: RollupNodeResolveOptions | false;

  /**
   * JSON plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-json](https://npmjs.com/package/@rollup/plugin-json)
   */
  json: RollupJsonOptions | false;

  /**
   * ESBuild plugin options
   * Set to `false` to disable the plugin.
   * Read more: [esbuild](https://npmjs.com/package/esbuild)
   */
  esbuild: EsbuildOptions | false;

  /**
   * CommonJS plugin options
   * Set to `false` to disable the plugin.
   * Read more: [@rollup/plugin-commonjs](https://npmjs.com/package/@rollup/plugin-commonjs)
   */
  commonjs: RollupCommonJSOptions | false;

  /**
   * DTS plugin options
   * Set to `false` to disable the plugin.
   * Read more: [rollup-plugin-dts](https://npmjs.com/package/rollup-plugin-dts)
   */
  dts: RollupDtsOptions;
};

export type RollupOptions = {
  plugins: Plugin[];
} & _RollupOptions;

export type RollupHooks = {
  "rollup:options": (
    ctx: BuildContext,
    options: RollupOptions,
  ) => void | Promise<void>;
  "rollup:build": (
    ctx: BuildContext,
    build: RollupBuild,
  ) => void | Promise<void>;
  "rollup:dts:options": (
    ctx: BuildContext,
    options: RollupOptions,
  ) => void | Promise<void>;
  "rollup:dts:build": (
    ctx: BuildContext,
    build: RollupBuild,
  ) => void | Promise<void>;
  "rollup:done": (ctx: BuildContext) => void | Promise<void>;
};
