import { resolve } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import type { OutputOptions } from "rollup";
import { rollup } from "rollup";
import dts from "rollup-plugin-dts";

import type { BuildContext } from "~/impl/types/mod";

import { getRollupOptions } from "./config";
import { fixCJSExportTypePlugin } from "./plugins/cjs";
import { removeShebangPlugin } from "./plugins/shebang";
import { rollupStub } from "./stub";
import { getChunkFilename } from "./utils";
import { rollupWatch } from "./watch";

export async function rollupBuild(ctx: BuildContext): Promise<void> {
  // Stub mode
  if (ctx.options.transpileStub) {
    await rollupStub(ctx);
    await ctx.hooks.callHook("rollup:done", ctx);
    return;
  }

  // Resolve options
  const rollupOptions = getRollupOptions(ctx);
  await ctx.hooks.callHook("rollup:options", ctx, rollupOptions);

  // Skip build if no input entries defined
  if (Object.keys(rollupOptions.input as any).length === 0) {
    await ctx.hooks.callHook("rollup:done", ctx);
    return;
  }

  // Do rollup build
  const buildResult = await rollup(rollupOptions);
  await ctx.hooks.callHook("rollup:build", ctx, buildResult);

  // Collect info about output entries
  const allOutputOptions = rollupOptions.output as OutputOptions[];
  for (const outputOptions of allOutputOptions) {
    const { output } = await buildResult.write(outputOptions);
    const chunkFileNames = new Set<string>();
    const outputChunks = output.filter((e) => e.type === "chunk");
    for (const entry of outputChunks) {
      chunkFileNames.add(entry.fileName);
      for (const id of entry.imports) {
        ctx.usedImports.add(id);
      }
      if (entry.isEntry) {
        ctx.buildEntries.push({
          bytes: Buffer.byteLength(entry.code, "utf8"),
          chunks: entry.imports.filter((i) =>
            outputChunks.find((c) => c.fileName === i),
          ),
          exports: entry.exports,
          modules: Object.entries(entry.modules).map(([id, mod]) => ({
            bytes: mod.renderedLength,
            id,
          })),
          path: entry.fileName,
          isLib: ctx.options.isLib,
        });
      }
    }
    for (const chunkFileName of chunkFileNames) {
      ctx.usedImports.delete(chunkFileName);
    }
  }

  // Watch
  if (ctx.options.transpileWatch) {
    rollupWatch(rollupOptions);
    // TODO: Clone rollup options to continue types transpileWatching
    if (ctx.options.declaration && ctx.options.transpileWatch) {
      relinka(
        "warn",
        "`rollup` DTS builder does not support transpileWatch mode yet.",
      );
    }
    return;
  }

  // Types
  if (ctx.options.declaration) {
    const plugins = [
      dts(ctx.options.rollup.dts),
      removeShebangPlugin(),
      ctx.options.rollup.emitCJS && fixCJSExportTypePlugin(ctx),
    ].filter(
      (plugin): plugin is NonNullable<Exclude<typeof plugin, false>> =>
        /**
         * Issue: #396
         * rollup-plugin-dts conflicts with rollup-plugin-commonjs:
         * https://github.com/Swatinem/rollup-plugin-dts#what-to-expect
         */
        !!plugin && (!("name" in plugin) || plugin.name !== "commonjs"),
    );

    rollupOptions.plugins = plugins;

    await ctx.hooks.callHook("rollup:dts:options", ctx, rollupOptions);
    const typesBuild = await rollup(rollupOptions);
    await ctx.hooks.callHook("rollup:dts:build", ctx, typesBuild);
    // #region cjs
    if (ctx.options.rollup.emitCJS) {
      await typesBuild.write({
        chunkFileNames: (chunk) => getChunkFilename(ctx, chunk, "d.cts"),
        dir: resolve(ctx.options.rootDir, ctx.options.outDir),
        entryFileNames: "[name].d.cts",
      });
    }
    // #endregion
    // #region mjs
    await typesBuild.write({
      chunkFileNames: (chunk) => getChunkFilename(ctx, chunk, "d.mts"),
      dir: resolve(ctx.options.rootDir, ctx.options.outDir),
      entryFileNames: "[name].d.mts",
    });
    // #endregion
    // #region .d.ts for node10 compatibility (TypeScript version < 4.7)
    if (
      ctx.options.declaration === true ||
      ctx.options.declaration === "compatible"
    ) {
      await typesBuild.write({
        chunkFileNames: (chunk) => getChunkFilename(ctx, chunk, "d.ts"),
        dir: resolve(ctx.options.rootDir, ctx.options.outDir),
        entryFileNames: "[name].d.ts",
      });
    }
    // #endregion
  }

  await ctx.hooks.callHook("rollup:done", ctx);
}
