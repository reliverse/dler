/**
 * # Build for default targets (Linux x64, Windows x64, macOS ARM64)
 * bun dler build binary
 *
 * # Build for all supported platforms
 * bun dler build binary --targets=all
 *
 * # Build for specific platforms
 * bun dler build binary --targets=bun-linux-x64,bun-windows-x64
 *
 * # Build with bytecode compilation for faster startup
 * bun dler build binary --bytecode
 *
 * # Build without minification and source maps
 * bun dler build binary --no-minify --no-sourcemap
 *
 * # Build with Windows icon and hidden console
 * bun dler build binary --windows-icon=icon.ico --windows-hide-console
 *
 * # List all available targets
 * bun dler build binary --targets=list
 *
 * # Build sequentially instead of parallel
 * bun dler build binary --no-parallel
 *
 * # Custom output directory
 * bun dler build binary --outdir=builds
 *
 * # Different input file
 * bun dler build binary --input=src/different-cli.ts
 *
 * # Exclude specific packages from bundling
 * bun dler build binary --external=c12,terminal-kit,problematic-package
 *
 * # Create bundled scripts instead of executables (for debugging)
 * bun dler build binary --no-compile
 *
 * @see https://bun.com/docs/bundler/executables
 */

import { join } from "@reliverse/pathkit";
import { existsSync, mkdir } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineCommand, defineArgs } from "@reliverse/rempts";

import type { BunBuildOptions } from "~/libs/sdk/sdk-impl/build/providers/bun/single-file";

import {
  listAvailableTargets,
  parseTargets,
  validateInputFile,
  cleanOutputDir,
  buildForTarget,
  getOutputFileName,
} from "~/libs/sdk/sdk-impl/build/providers/bun/single-file";

export default defineCommand({
  meta: {
    name: "bundler",
    description: "Bundle your project into standalone executables for different platforms",
  },
  args: defineArgs({
    input: {
      type: "string",
      description: "Input TypeScript file to bundle",
      default: "src/cli.ts",
    },
    targets: {
      type: "string",
      description:
        "Comma-separated list of targets to build for (use 'all' for all targets, 'list' to show available targets)",
      default: "bun-linux-x64,bun-windows-x64,bun-darwin-arm64",
    },
    outdir: {
      type: "string",
      description: "Output directory for built executables",
      default: "dist",
    },
    minify: {
      type: "boolean",
      description: "Minify the output",
      default: true,
    },
    sourcemap: {
      type: "boolean",
      description: "Generate source maps",
      default: true,
    },
    bytecode: {
      type: "boolean",
      description: "Enable bytecode compilation for faster startup",
      default: false,
    },
    clean: {
      type: "boolean",
      description: "Clean output directory before building",
      default: true,
    },
    "windows-icon": {
      type: "string",
      description: "Path to Windows .ico file for executable icon",
    },
    "windows-hide-console": {
      type: "boolean",
      description: "Hide console window on Windows",
      default: false,
    },
    "asset-naming": {
      type: "string",
      description: "Asset naming pattern",
      default: "[name]-[hash].[ext]",
    },
    parallel: {
      type: "boolean",
      description: "Build targets in parallel",
      default: true,
    },
    external: {
      type: "array",
      description: "External dependencies to exclude from bundle",
      default: ["c12", "terminal-kit"],
    },
    "no-compile": {
      type: "boolean",
      description:
        "Create a bundled script instead of standalone executable (for debugging terminal issues)",
      default: false,
    },
  }),
  async run({ args }) {
    try {
      // Handle special cases
      if (args.targets === "list") {
        listAvailableTargets();
        return;
      }

      // Validate input
      validateInputFile(args.input);

      // Parse targets
      const targets = parseTargets(args.targets);

      if (targets.length === 0) {
        relinka("error", "No valid targets specified");
        return;
      }

      // Build options
      const options: BunBuildOptions = {
        minify: args.minify,
        sourcemap: args.sourcemap,
        bytecode: args.bytecode,
        outdir: args.outdir,
        clean: args.clean,
        windowsIcon: args["windows-icon"],
        windowsHideConsole: args["windows-hide-console"],
        assetNaming: args["asset-naming"],
        external: args.external as string[],
        compile: !args["no-compile"],
      };

      // Clean output directory
      if (options.clean) {
        await cleanOutputDir(options.outdir);
      } else if (!existsSync(options.outdir)) {
        await mkdir(options.outdir, { recursive: true });
      }

      const buildType = options.compile ? "executable(s)" : "bundled script(s)";
      relinka("info", `Building ${targets.length} ${buildType} from ${args.input}`);

      if (!options.compile) {
        relinka("info", "Running in script bundle mode (--no-compile)");
      }

      if (options.external && options.external.length > 0) {
        relinka(
          "info",
          `External dependencies (excluded from bundle): ${options.external.join(", ")}`,
        );
      }

      if (options.bytecode && options.compile) {
        relinka("warn", "Bytecode compilation is experimental (Bun v1.1.30+)");
      } else if (options.bytecode && !options.compile) {
        relinka("warn", "Bytecode compilation is only available with --compile flag");
      }

      // Build targets
      if (args.parallel && targets.length > 1) {
        relinka("info", "Building targets in parallel...");
        const buildPromises = targets.map((target) => buildForTarget(target, args.input, options));

        const results = await Promise.allSettled(buildPromises);

        let successCount = 0;
        let failureCount = 0;

        for (const result of results) {
          if (result.status === "fulfilled") {
            successCount++;
          } else {
            failureCount++;
            relinka("error", `Build failed: ${result.reason}`);
          }
        }

        relinka("info", `Build completed: ${successCount} succeeded, ${failureCount} failed`);

        if (failureCount > 0) {
          if (successCount === 0) {
            relinka("error", `❌ All builds failed! No executables were generated.`);
          } else {
            relinka(
              "warn",
              `⚠️  Build completed with ${failureCount} failure(s). ${successCount} executable(s) available in: ${options.outdir}`,
            );
          }
        } else {
          relinka("success", `🎉 Build completed! All executables available in: ${options.outdir}`);
        }
      } else {
        relinka("info", "Building targets sequentially...");
        let sequentialSuccessCount = 0;
        let sequentialFailureCount = 0;

        for (const target of targets) {
          try {
            await buildForTarget(target, args.input, options);
            sequentialSuccessCount++;
          } catch (error) {
            sequentialFailureCount++;
          }
        }

        if (sequentialFailureCount > 0) {
          if (sequentialSuccessCount === 0) {
            relinka("error", `❌ All builds failed! No executables were generated.`);
          } else {
            relinka(
              "warn",
              `⚠️  Build completed with ${sequentialFailureCount} failure(s). ${sequentialSuccessCount} executable(s) available in: ${options.outdir}`,
            );
          }
        } else {
          relinka("success", `🎉 Build completed! All executables available in: ${options.outdir}`);
        }
      }

      // Show file sizes
      if (existsSync(options.outdir)) {
        const fileType = options.compile ? "executables" : "bundled scripts";
        relinka("info", `Generated ${fileType}:`);
        for (const target of targets) {
          const filePath = join(options.outdir, getOutputFileName(target, "dler", options.compile));
          if (existsSync(filePath)) {
            const stat = await Bun.file(filePath).size;
            const sizeMB = (stat / (1024 * 1024)).toFixed(2);
            relinka(
              "info",
              `  ${getOutputFileName(target, "dler", options.compile)} (${sizeMB} MB)`,
            );
          }
        }
      }
    } catch (error) {
      relinka("error", `Build failed: ${error}`);
      process.exit(1);
    }
  },
});
