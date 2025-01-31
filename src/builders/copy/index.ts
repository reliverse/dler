import consola from "consola";
import { promises as fsp } from "node:fs";
import { relative, resolve } from "pathe";
import { glob } from "tinyglobby";

import type { CopyBuildEntry, BuildContext } from "~/types.js";

import { symlink, rmdir, warn } from "~/utils.js";

const copy = fsp.cp || fsp.copyFile;

export async function copyBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (e) => e.builder === "copy",
  ) as CopyBuildEntry[];
  await ctx.hooks.callHook("copy:entries", ctx, entries);
  for (const entry of entries) {
    const distDir = entry.outDir;
    if (ctx.options.stub) {
      // @ts-expect-error TODO: fix ts
      await rmdir(distDir);
      // @ts-expect-error TODO: fix ts
      await symlink(entry.input, distDir);
    } else {
      const patterns = Array.isArray(entry.pattern)
        ? entry.pattern
        : [entry.pattern || "**"];
      const paths = await glob(patterns, {
        cwd: resolve(ctx.options.rootDir, entry.input),
        absolute: false,
      });

      const outputList = await Promise.allSettled(
        paths.map(async (path) => {
          const src = resolve(ctx.options.rootDir, entry.input, path);
          // @ts-expect-error TODO: fix ts
          const dist = resolve(ctx.options.rootDir, distDir, path);
          await copy(src, dist);
          return dist;
        }),
      );

      for (const output of outputList) {
        if (output.status === "rejected") {
          warn(ctx, output.reason);
        }
      }

      ctx.buildEntries.push({
        // @ts-expect-error TODO: fix ts
        path: distDir,
        chunks: outputList
          .filter(({ status }) => status === "fulfilled")
          .map((p) =>
            relative(
              ctx.options.outDir,
              (p as PromiseFulfilledResult<string>).value,
            ),
          ),
      });
    }
  }
  await ctx.hooks.callHook("copy:done", ctx);

  if (entries.length > 0 && ctx.options.watch) {
    consola.warn("`untyped` builder does not support watch mode yet.");
  }
}
