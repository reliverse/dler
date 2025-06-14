import { relative, dirname as pathDirname } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";

import type { BuildContext, MkdistBuildEntry, MkdistOptions } from "~/libs/sdk/sdk-impl/sdk-types";

import { rmdir, symlink, warn } from "~/libs/sdk/sdk-impl/build/bundlers/unified/utils";

// import { mkdist } from "mkdist";
import { mkdist } from "./mkdist-impl/make";
import { useSpinner } from "./mkdist-impl/utils/spinner";

export async function mkdistBuild(ctx: BuildContext): Promise<void> {
  const entries = ctx.options.entries.filter((e) => e.builder === "mkdist") as MkdistBuildEntry[];

  if (entries.length === 0) {
    return;
  }

  await useSpinner.promise(
    async (mainSpinner) => {
      await ctx.hooks.callHook("mkdist:entries", ctx, entries);

      let processedEntries = 0;
      let totalWrittenFiles = 0;
      let totalErrors = 0;

      for (const entry of entries) {
        processedEntries++;
        mainSpinner.setProgress({
          current: processedEntries,
          total: entries.length,
        });
        mainSpinner.setText(
          `Processing entry ${processedEntries}/${entries.length}: ${entry.input}`,
        );

        const distDir = entry.outDir || entry.input;

        if (ctx.options.transpileStub) {
          await rmdir(distDir);
          await symlink(entry.input, distDir);
          continue;
        }

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
          "info",
          `[mkdist] Building with options: srcDir=${mkdistOptions.srcDir}, distDir=${mkdistOptions.distDir}, rootDir=${mkdistOptions.rootDir}`,
        );

        await ctx.hooks.callHook("mkdist:entry:options", ctx, entry, mkdistOptions);

        try {
          const { result: output, duration } = await mkdist(mkdistOptions);

          relinka("verbose", `[mkdist] Entry ${processedEntries} completed in ${duration}ms`);

          totalWrittenFiles += output.writtenFiles.length;

          ctx.buildEntries.push({
            chunks: output.writtenFiles.map((p: string) => relative(ctx.options.outDir, p)),
            path: distDir,
            isLib: ctx.options.isLib,
          });

          await ctx.hooks.callHook("mkdist:entry:build", ctx, entry, output);

          if (output.errors && output.errors.length > 0) {
            totalErrors += output.errors.length;
            for (const error of output.errors) {
              warn(
                ctx,
                `mkdist build failed for \`${relative(ctx.options.rootDir, error.filename)}\`:\n${error.errors.map((e: TypeError) => `  - ${e}`).join("\n")}`,
              );
            }
          }
        } catch (error) {
          totalErrors++;
          warn(
            ctx,
            `mkdist build failed for entry ${entry.input}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      await ctx.hooks.callHook("mkdist:done", ctx);

      if (entries.length > 0 && ctx.options.transpileWatch) {
        relinka("warn", "`mkdist` builder does not support transpileWatch mode yet.");
      }

      // Update final status with summary
      if (totalErrors > 0) {
        mainSpinner.warn(
          `Processed ${entries.length} entries with ${totalErrors} errors. ${totalWrittenFiles} files written.`,
        );
      } else {
        mainSpinner.setText(
          `Successfully processed ${entries.length} entries. ${totalWrittenFiles} files written.`,
        );
      }
    },
    {
      text:
        entries.length === 1
          ? "Processing mkdist entry..."
          : `Processing ${entries.length} mkdist entries...`,
      color: "blue",
      successText:
        entries.length === 1
          ? "mkdist entry completed!"
          : `All ${entries.length} mkdist entries completed!`,
      failText: "mkdist build failed!",
      prefixText: "[mkdist]",
    },
  );
}
