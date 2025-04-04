import { relinka } from "@reliverse/relinka";
import { promises as fsp } from "node:fs";
import { relative, resolve } from "pathe";
import { glob } from "tinyglobby";

import type {
  BuildContext,
  CopyBuildEntry,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/types.js";

import {
  rmdir,
  symlink,
  warn,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils.js";

const copy = fsp.cp || fsp.copyFile;

export async function copyBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (e) => e.builder === "copy",
  ) as CopyBuildEntry[];
  await ctx.hooks.callHook("copy:entries", ctx, entries);
  for (const entry of entries) {
    const distDir = entry.outDir || entry.input;
    if (!distDir || !entry.input) {
      warn(ctx, "Missing required outDir or input for copy entry");
      continue;
    }
    if (ctx.options.transpileStub) {
      await rmdir(distDir);
      await symlink(entry.input, distDir);
    } else {
      const patterns = Array.isArray(entry.pattern)
        ? entry.pattern
        : [entry.pattern || "**"];
      const paths = await glob(patterns, {
        absolute: false,
        cwd: resolve(ctx.options.rootDir, entry.input),
      });

      const outputList = await Promise.allSettled(
        paths.map(async (path) => {
          const src = resolve(ctx.options.rootDir, entry.input, path);
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
        chunks: outputList
          .filter(({ status }) => status === "fulfilled")
          .map((p) =>
            relative(
              ctx.options.outDir,
              (p as PromiseFulfilledResult<string>).value,
            ),
          ),
        path: distDir,
      });
    }
  }
  await ctx.hooks.callHook("copy:done", ctx);

  if (entries.length > 0 && ctx.options.transpileWatch) {
    relinka(
      "warn",
      "`untyped` builder does not support transpileWatch mode yet.",
    );
  }
}
