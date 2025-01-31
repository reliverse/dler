import { build as bunBuild } from "bun";
import consola from "consola";
import { resolve } from "pathe";

import type { BuildContext } from "~/types.js";

export async function brelidler(ctx: BuildContext): Promise<void> {
  try {
    // Check if we're in watch mode
    if (ctx.options.watch) {
      consola.warn("Watch mode is not yet supported for Bun builder");
      return;
    }

    // Get input files from context
    const entries = Object.entries(ctx.options.entries || {});
    if (entries.length === 0) {
      await ctx.hooks.callHook("build:done", ctx);
      return;
    }

    // Process each entry
    for (const [name, entry] of entries) {
      const outDir = resolve(ctx.options.outDir, name);

      const result = await bunBuild({
        entrypoints: [entry.input],
        outdir: outDir,
        sourcemap: ctx.options.sourcemap ? "external" : false,
      });

      // Inject build entries into the context
      ctx.buildEntries.push({
        path: resolve(outDir, name),
        chunks: [],
      });

      if (!result.success) {
        throw new Error(`Bun build failed for entry: ${name}`);
      }
    }

    await ctx.hooks.callHook("build:done", ctx);
  } catch (error) {
    consola.error("Bun build failed:", error);
    throw error;
  }
}
