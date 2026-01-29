// apps/dler/src/cmds/clean/cmd.ts

import { replaceExportsInPackages } from "@reliverse/helpers";
import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { runCleanOnAllPackages } from "./impl";

// Valid clean presets
const _CleanPreset = type(
  "'build' | 'db' | 'cms' | 'frontend' | 'docs' | 'email' | 'build-tools' | 'deps' | 'all'"
);

export default defineCommand({
  description:
    "Clean build artifacts and generated files from workspace packages. Supports presets for different types of files. Works in both monorepo and single-repo modes.",
  options: {
    filter: option(type("string | undefined"), {
      description:
        "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
    }),
    ignore: option(type("string | undefined"), {
      description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
    }),
    presets: option(type("string | undefined"), {
      description:
        "Comma-separated presets to clean: build,db,cms,frontend,docs,email,build-tools,deps,all",
    }),
    custom: option(type("string | undefined"), {
      description: "Comma-separated custom patterns to clean (e.g., 'dist/,*.log,node_modules/')",
    }),
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    subdirs: option(type("boolean | undefined"), {
      description: "Search recursively in subdirectories (single-repo mode only)",
    }),
    dryRun: option(type("boolean | undefined"), {
      description: "Preview what would be deleted without actually deleting",
    }),
    force: option(type("boolean | undefined"), {
      description: "Required flag to proceed with deletion (no prompts, args-only)",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose mode with detailed logging",
    }),
    deleteLockFiles: option(type("boolean | undefined"), {
      description: "Include lock files (bun.lock, package-lock.json, etc.) when using deps preset",
    }),
    replaceExports: option(type("boolean | undefined"), {
      description: "Replace exports from ./src/*.ts to ./dist/*.js before cleaning (default: true)",
    }),
    replaceExportsIgnorePackages: option(type("string | undefined"), {
      description:
        "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Apply defaults
      const subdirs = flags.subdirs ?? false;
      const dryRun = flags.dryRun ?? false;
      const force = flags.force ?? false;
      const verbose = flags.verbose ?? false;
      const deleteLockFiles = flags.deleteLockFiles ?? false;
      const replaceExports = flags.replaceExports ?? true;

      // Replace exports if enabled (default: true, unless explicitly false)
      const shouldReplaceExports = replaceExports !== false;
      if (shouldReplaceExports) {
        if (verbose) {
          logger.info("📝 Replacing exports from ./dist/*.js to ./src/*.ts before cleaning...");
        }
        await replaceExportsInPackages({
          direction: "js-to-ts",
          cwd: flags.cwd || process.cwd(),
          ignorePackages: flags.replaceExportsIgnorePackages || [],
          verbose,
        });
      }

      const results = await runCleanOnAllPackages(flags.ignore || "", flags.cwd || process.cwd(), {
        presets: flags.presets || "",
        custom: flags.custom || "",
        filter: flags.filter || "",
        ignore: flags.ignore || "",
        cwd: flags.cwd || process.cwd(),
        replaceExportsIgnorePackages: flags.replaceExportsIgnorePackages || "",
        subdirs,
        dryRun,
        force,
        verbose,
        deleteLockFiles,
        replaceExports,
      });

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
