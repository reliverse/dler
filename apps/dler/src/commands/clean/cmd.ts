// apps/dler/src/cmds/clean/cmd.ts

import { replaceExportsInPackages } from "@reliverse/helpers";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";
import { runCleanOnAllPackages } from "./impl";

export default defineCommand({
  name: "clean",
  description:
    "Clean build artifacts and generated files from workspace packages. Supports presets for different types of files. Works in both monorepo and single-repo modes.",
  options: {
    filter: option(
      z.string().optional(),
      {
        description:
          "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
      },
    ),
    ignore: option(
      z.string().optional(),
      {
        description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
      },
    ),
    presets: option(
      z.string().optional(),
      {
        description:
          "Comma-separated presets to clean: build,db,cms,frontend,docs,email,build-tools,deps,all",
      },
    ),
    custom: option(
      z.string().optional(),
      {
        description: "Comma-separated custom patterns to clean (e.g., 'dist/,*.log,node_modules/')",
      },
    ),
    cwd: option(
      z.string().optional(),
      {
        description: "Working directory (monorepo root)",
      },
    ),
    subdirs: option(
      z.boolean().default(false),
      {
        description: "Search recursively in subdirectories (single-repo mode only)",
      },
    ),
    dryRun: option(
      z.boolean().default(false),
      {
        description: "Preview what would be deleted without actually deleting",
      },
    ),
    force: option(
      z.boolean().default(false),
      {
        description: "Required flag to proceed with deletion (no prompts, args-only)",
      },
    ),
    verbose: option(
      z.boolean().default(false),
      {
        description: "Verbose mode with detailed logging",
      },
    ),
    deleteLockFiles: option(
      z.boolean().default(false),
      {
        description: "Include lock files (bun.lock, package-lock.json, etc.) when using deps preset",
      },
    ),
    replaceExports: option(
      z.boolean().default(true),
      {
        description: "Replace exports from ./src/*.ts to ./dist/*.js before cleaning (default: true)",
      },
    ),
    replaceExportsIgnorePackages: option(
      z.string().optional(),
      {
        description:
          "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
      },
    ),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Replace exports if enabled (default: true, unless explicitly false)
      const shouldReplaceExports = flags.replaceExports !== false;
      if (shouldReplaceExports) {
        if (flags.verbose) {
          logger.info("📝 Replacing exports from ./dist/*.js to ./src/*.ts before cleaning...");
        }
        await replaceExportsInPackages({
          direction: "js-to-ts",
          cwd: flags.cwd,
          ignorePackages: flags.replaceExportsIgnorePackages,
          verbose: flags.verbose,
        });
      }

      const results = await runCleanOnAllPackages(flags.ignore, flags.cwd, flags);

      if (results.hasErrors) {
        process.exit(1);
      }

      if (flags.dryRun) {
        logger.success("\n✅ Clean preview completed!");
      } else {
        logger.success("\n✅ Clean completed successfully!");
      }

      process.exit(0);
    } catch (error) {
      logger.error("\n❌ Clean failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
