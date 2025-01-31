import consola from "consola";
import { mkdist, type MkdistOptions } from "mkdist";
import { relative } from "pathe";

import type { MkdistBuildEntry, BuildContext } from "~/types.js";

import { symlink, rmdir, warn } from "~/utils.js";

export async function mkdistBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (e) => e.builder === "mkdist",
  ) as MkdistBuildEntry[];
  await ctx.hooks.callHook("mkdist:entries", ctx, entries);
  for (const entry of entries) {
    const distDir = entry.outDir;
    if (ctx.options.stub) {
      // @ts-expect-error TODO: fix ts
      await rmdir(distDir);
      // @ts-expect-error TODO: fix ts
      await symlink(entry.input, distDir);
    } else {
      // @ts-expect-error TODO: fix ts
      const mkdistOptions: MkdistOptions = {
        rootDir: ctx.options.rootDir,
        srcDir: entry.input,
        distDir,
        cleanDist: false,
        ...entry,
      };
      await ctx.hooks.callHook(
        "mkdist:entry:options",
        ctx,
        entry,
        mkdistOptions,
      );
      const output = await mkdist(mkdistOptions);
      ctx.buildEntries.push({
        // @ts-expect-error TODO: fix ts
        path: distDir,
        chunks: output.writtenFiles.map((p) => relative(ctx.options.outDir, p)),
      });
      await ctx.hooks.callHook("mkdist:entry:build", ctx, entry, output);
      if (output.errors) {
        for (const error of output.errors) {
          warn(
            ctx,
            `mkdist build failed for \`${relative(ctx.options.rootDir, error.filename)}\`:\n${error.errors.map((e) => `  - ${e}`).join("\n")}`,
          );
        }
      }
    }
  }
  await ctx.hooks.callHook("mkdist:done", ctx);

  if (entries.length > 0 && ctx.options.watch) {
    consola.warn("`mkdist` builder does not support watch mode yet.");
  }
}
