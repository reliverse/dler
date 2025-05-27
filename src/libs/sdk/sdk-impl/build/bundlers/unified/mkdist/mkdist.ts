import { relative, dirname as pathDirname } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { mkdist, type MkdistOptions } from "mkdist";

import type { BuildContext, MkdistBuildEntry } from "~/libs/sdk/sdk-types";

import {
  rmdir,
  symlink,
  warn,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils";

export async function mkdistBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter(
    (e) => e.builder === "mkdist",
  ) as MkdistBuildEntry[];
  await ctx.hooks.callHook("mkdist:entries", ctx, entries);
  for (const entry of entries) {
    const distDir = entry.outDir || entry.input;
    if (ctx.options.transpileStub) {
      await rmdir(distDir);
      await symlink(entry.input, distDir);
    } else {
      // Resolve source directory from input
      let srcDir: string;
      if (typeof entry.input === "string" && !entry.input.endsWith("/")) {
        srcDir = ctx.options.isLib ? pathDirname(entry.input) : entry.input;
        relinka(
          "verbose",
          `[mkdist] Using directory from file path: ${srcDir} (from: ${entry.input})`,
        );
      } else {
        srcDir = entry.input;
        relinka("verbose", `[mkdist] Using directory directly: ${srcDir}`);
      }

      const mkdistOptions: MkdistOptions = {
        cleanDist: false,
        distDir,
        rootDir: ctx.options.rootDir,
        srcDir,
        format: "esm",
        ext: entry.ext || "js",
        ...entry,
      };

      relinka(
        "verbose",
        `[mkdist] Building with options: srcDir=${mkdistOptions.srcDir}, distDir=${mkdistOptions.distDir}, rootDir=${mkdistOptions.rootDir}`,
      );

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
        isLib: ctx.options.isLib,
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
