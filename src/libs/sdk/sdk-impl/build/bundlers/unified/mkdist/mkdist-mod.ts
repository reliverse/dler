import { relative, dirname as pathDirname } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";

import type { BuildContext, MkdistBuildEntry } from "~/libs/sdk/sdk-types";

import { rmdir, symlink, warn } from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils";

import { mkdist } from "./mkdist-impl/make";

// Step 1: Main mkdist build function that handles directory-based builds
export async function mkdistBuild(ctx: BuildContext): Promise<void> {
  relinka("info", "Step 1: Starting mkdist build process");
  relinka("verbose", "Filtering mkdist entries from build configuration");

  // Step 2: Filter and prepare mkdist entries
  const entries = ctx.options.entries.filter((e): e is MkdistBuildEntry => e.builder === "mkdist");
  await ctx.hooks.callHook("mkdist:entries", ctx, entries);
  relinka("verbose", `Found ${entries.length} mkdist entries to process`);

  // Step 3: Process each mkdist entry
  for (const entry of entries) {
    relinka("info", `Step 3: Processing mkdist entry: ${entry.name || entry.input}`);
    const distDir = entry.outDir || entry.input;

    // Step 4: Handle transpile stub mode
    if (ctx.options.transpileStub) {
      relinka("verbose", "Transpile stub mode: Creating symlink instead of building");
      await rmdir(distDir);
      await symlink(entry.input, distDir);
    } else {
      // Step 5: Resolve source directory
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

      // Step 6: Configure mkdist options
      const mkdistOptions = {
        cleanDist: false,
        distDir,
        rootDir: ctx.options.rootDir,
        srcDir,
        format: "esm" as const,
        ext: entry.ext || "js",
        exclude: ctx.options.dontBuildCopyInstead || [],
        ...entry,
      };

      relinka(
        "verbose",
        `[mkdist] Building with options: srcDir=${mkdistOptions.srcDir}, distDir=${mkdistOptions.distDir}, rootDir=${mkdistOptions.rootDir}`,
      );

      // Step 7: Execute mkdist build
      await ctx.hooks.callHook("mkdist:entry:options", ctx, entry, mkdistOptions);
      relinka("verbose", "Starting mkdist build process");
      const output = await mkdist(mkdistOptions as any);

      // Step 8: Process build output
      ctx.buildEntries.push({
        chunks: output.writtenFiles.map((p) => relative(ctx.options.outDir, p)),
        path: distDir,
        isLib: ctx.options.isLib,
      });
      relinka("verbose", `Generated ${output.writtenFiles.length} files`);

      await ctx.hooks.callHook("mkdist:entry:build", ctx, entry, output);

      // Step 9: Handle build errors
      if (output.errors) {
        if (output.errors.length > 0) {
          relinka("warn", `Found ${output.errors.length} errors in mkdist build`);
        } else {
          relinka("verbose", "mkdist completed without errors");
        }
        for (const error of output.errors) {
          warn(
            ctx,
            `mkdist build failed for \`${relative(ctx.options.rootDir, error.filename)}\`:\n${error.errors.map((e) => `  - ${e}`).join("\n")}`,
          );
        }
      }
    }
  }

  // Step 10: Finalize build
  await ctx.hooks.callHook("mkdist:done", ctx);
  relinka("info", "Step 10: mkdist build process completed");

  // Step 11: Handle watch mode warning
  if (entries.length > 0 && ctx.options.transpileWatch) {
    relinka("warn", "`mkdist` builder does not support transpileWatch mode yet.");
  }
}
