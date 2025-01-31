import type { OutputOptions, PreRenderedChunk } from "rollup";

import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { parseNodeModulePath } from "mlly";
import { resolve, isAbsolute } from "pathe";
import { resolveAlias } from "pathe/utils";

import type { BuildContext, RollupOptions } from "~/types.js";

import { arrayIncludes, getpkg, warn } from "~/utils.js";

import { cjsPlugin } from "./plugins/cjs.js";
import { esbuild } from "./plugins/esbuild.js";
import { JSONPlugin } from "./plugins/json.js";
import { rawPlugin } from "./plugins/raw.js";
import { shebangPlugin } from "./plugins/shebang.js";
import {
  DEFAULT_EXTENSIONS,
  getChunkFilename,
  resolveAliases,
} from "./utils.js";

export function getRollupOptions(ctx: BuildContext): RollupOptions {
  const _aliases = resolveAliases(ctx);
  return {
    input: Object.fromEntries(
      ctx.options.entries
        .filter((entry) => entry.builder === "rollup")
        .map((entry) => [
          entry.name,
          resolve(ctx.options.rootDir, entry.input),
        ]),
    ),

    output: [
      ctx.options.rollup.emitCJS &&
        ({
          dir: resolve(ctx.options.rootDir, ctx.options.outDir),
          entryFileNames: "[name].cjs",
          chunkFileNames: (chunk: PreRenderedChunk) =>
            getChunkFilename(ctx, chunk, "cjs"),
          format: "cjs",
          exports: "auto",
          interop: "compat",
          generatedCode: { constBindings: true },
          externalLiveBindings: false,
          freeze: false,
          sourcemap: ctx.options.sourcemap,
          ...ctx.options.rollup.output,
        } as OutputOptions),
      {
        dir: resolve(ctx.options.rootDir, ctx.options.outDir),
        entryFileNames: "[name].mjs",
        chunkFileNames: (chunk: PreRenderedChunk) =>
          getChunkFilename(ctx, chunk, "mjs"),
        format: "esm",
        exports: "auto",
        generatedCode: { constBindings: true },
        externalLiveBindings: false,
        freeze: false,
        sourcemap: ctx.options.sourcemap,
        ...ctx.options.rollup.output,
      } as OutputOptions,
    ].filter(Boolean),

    external(originalId) {
      // Resolve aliases
      const resolvedId = resolveAlias(originalId, _aliases);

      // Try to guess package name of id
      const pkgName =
        parseNodeModulePath(resolvedId)?.name ||
        parseNodeModulePath(originalId)?.name ||
        getpkg(originalId);

      // Check for explicit external rules
      if (
        arrayIncludes(ctx.options.externals, pkgName) ||
        arrayIncludes(ctx.options.externals, originalId) ||
        arrayIncludes(ctx.options.externals, resolvedId)
      ) {
        return true;
      }

      // Source is always bundled
      for (const id of [originalId, resolvedId]) {
        if (
          id.startsWith(".") ||
          isAbsolute(id) ||
          /src[/\\]/.test(id) ||
          // @ts-expect-error TODO: fix ts
          id.startsWith(ctx.pkg.name)
        ) {
          return false;
        }
      }

      // Check for other explicit inline rules
      if (
        ctx.options.rollup.inlineDependencies === true ||
        (Array.isArray(ctx.options.rollup.inlineDependencies) &&
          (arrayIncludes(ctx.options.rollup.inlineDependencies, pkgName) ||
            arrayIncludes(ctx.options.rollup.inlineDependencies, originalId) ||
            arrayIncludes(ctx.options.rollup.inlineDependencies, resolvedId)))
      ) {
        return false;
      }

      // Inline by default, but also show a warning, since it is an implicit behavior
      warn(ctx, `Implicitly bundling "${originalId}"`);
      return false;
    },

    onwarn(warning, rollupWarn) {
      if (!warning.code || !["CIRCULAR_DEPENDENCY"].includes(warning.code)) {
        rollupWarn(warning);
      }
    },

    plugins: [
      ctx.options.rollup.replace &&
        // @ts-expect-error TODO: fix ts
        replace({
          ...ctx.options.rollup.replace,
          values: {
            ...ctx.options.replace,
            ...ctx.options.rollup.replace.values,
          },
        }),

      ctx.options.rollup.alias &&
        // @ts-expect-error TODO: fix ts
        alias({
          ...ctx.options.rollup.alias,
          entries: _aliases,
        }),

      ctx.options.rollup.resolve &&
        nodeResolve({
          extensions: DEFAULT_EXTENSIONS,
          exportConditions: ["production"],
          ...ctx.options.rollup.resolve,
        }),

      ctx.options.rollup.json &&
        JSONPlugin({
          ...ctx.options.rollup.json,
        }),

      shebangPlugin(),

      ctx.options.rollup.esbuild &&
        esbuild({
          sourcemap: ctx.options.sourcemap,
          ...ctx.options.rollup.esbuild,
        }),

      ctx.options.rollup.commonjs &&
        // @ts-expect-error TODO: fix ts
        commonjs({
          extensions: DEFAULT_EXTENSIONS,
          // @ts-expect-error TODO: fix ts
          ...ctx.options.rollup.commonjs,
        }),

      ctx.options.rollup.preserveDynamicImports && {
        renderDynamicImport(): { left: string; right: string } {
          return { left: "import(", right: ")" };
        },
      },

      ctx.options.rollup.cjsBridge && cjsPlugin({}),

      rawPlugin(),
    ].filter(Boolean),
  } as RollupOptions;
}
