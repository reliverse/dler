import { mkdist, type MkdistOptions } from "mkdist";
import { relative } from "pathe";

import type {
  BuildContext,
  MkdistBuildEntry,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

import {
  rmdir,
  symlink,
  warn,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils.js";
import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";

export async function mkdistBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (e) => e.builder === "mkdist",
  ) as MkdistBuildEntry[];
  await ctx.hooks.callHook("mkdist:entries", ctx, entries);
  for (const entry of entries) {
    const distDir = entry.outDir!;
    if (ctx.options.transpileStub) {
      await rmdir(distDir);
      await symlink(entry.input, distDir);
    } else {
      const mkdistOptions: MkdistOptions = {
        cleanDist: false,
        distDir,
        rootDir: ctx.options.rootDir,
        srcDir: entry.input,
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
        chunks: output.writtenFiles.map((p) => relative(ctx.options.outDir, p)),
        path: distDir,
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

  if (entries.length > 0 && ctx.options.transpileWatch) {
    relinka(
      "warn",
      "`mkdist` builder does not support transpileWatch mode yet.",
    );
  }
}
