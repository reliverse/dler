// apps/dler/src/cmds/clean/cmd.ts

import { replaceExportsInPackages } from "@reliverse/dler-helpers";
import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { runCleanOnAllPackages } from "./impl";

export default defineCommand({
  meta: {
    name: "clean",
    description:
      "Clean build artifacts and generated files from workspace packages. Supports presets for different types of files. Works in both monorepo and single-repo modes.",
    examples: [
      "dler clean --presets build",
      "dler clean --custom 'dist/,*.log'",
      "dler clean --presets build --custom '*.tmp'",
      "dler clean --presets all --force",
      "dler clean --presets db,frontend --dry-run",
      "dler clean --presets deps --deleteLockFiles",
      "dler clean --subdirs --presets build-tools",
      'dler clean --filter "@reliverse/dler-prompt,@reliverse/dler-build"',
      'dler clean --filter "@reliverse/dler-*"',
      "dler clean --filter cli,packages/build",
      "dler clean --ignore '@reliverse/*'",
      "dler clean --presets frontend --verbose",
      "dler clean --presets all --dry-run --verbose",
      "",
      "# Preset Examples:",
      "dler clean --presets build           # Clean dist/, dev-dist/, target/",
      "dler clean --presets db              # Clean _generated/",
      "dler clean --presets cms             # Clean .basehub/",
      "dler clean --presets frontend        # Clean .next/, .expo/, routeTree.gen.ts",
      "dler clean --presets docs            # Clean .source/",
      "dler clean --presets email           # Clean .react-email/",
      "dler clean --presets build-tools     # Clean .turbo/, .vercel/, .wrangler/",
      "dler clean --presets deps            # Clean node_modules/",
      "dler clean --presets all             # Clean everything",
      "",
      "# Custom Pattern Examples:",
      "dler clean --custom 'dist/,*.log'    # Clean dist/ and log files",
      "dler clean --custom '*.tmp,*.cache'  # Clean temporary and cache files",
      "dler clean --custom 'build/,coverage/' # Clean build and coverage directories",
      "dler clean --presets build --custom '*.log' # Combine presets and custom patterns",
      "",
      "# Filter Examples:",
      'dler clean --filter "@reliverse/dler-*" --presets build   # Clean build artifacts in matching packages',
      "dler clean --filter cli,packages/build --presets all     # Clean all artifacts in specific packages",
      'dler clean --filter "@reliverse/dler-prompt" --custom "*.log"  # Clean log files in specific package',
      "",
      "# Monorepo Examples:",
      "dler clean                           # Clean dist/ in all packages",
      "dler clean --presets frontend        # Clean frontend artifacts in all packages",
      "dler clean --ignore '@reliverse/*'   # Skip packages matching pattern",
      "dler clean --presets all --force     # Clean everything without confirmation",
      "",
      "# Single-repo Examples:",
      "dler clean --subdirs                 # Search recursively in subdirectories",
      "dler clean --subdirs --presets all   # Clean everything recursively",
      "",
      "# Safety Examples:",
      "dler clean --dry-run                 # Preview what would be deleted",
      "dler clean --presets deps --dry-run  # Preview dependency cleanup",
      "dler clean --verbose                 # Show detailed progress",
      "",
      "# Advanced Examples:",
      "dler clean --presets deps --deleteLockFiles  # Include lock files",
      "dler clean --presets all --force --verbose   # Clean everything with details",
      "dler clean --cwd /path/to/project --presets build",
    ],
  },
  args: defineArgs({
    filter: {
      type: "string",
      description:
        "Package(s) to include (supports wildcards and comma-separated values like '@reliverse/dler-prompt,@reliverse/dler-build'). Takes precedence over --ignore when both are provided.",
    },
    ignore: {
      type: "string",
      description:
        "Package(s) to ignore (supports wildcards like @reliverse/*)",
    },
    presets: {
      type: "string",
      description:
        "Comma-separated presets to clean: build,db,cms,frontend,docs,email,build-tools,deps,all",
    },
    custom: {
      type: "string",
      description:
        "Comma-separated custom patterns to clean (e.g., 'dist/,*.log,node_modules/')",
    },
    cwd: {
      type: "string",
      description: "Working directory (monorepo root)",
    },
    subdirs: {
      type: "boolean",
      description:
        "Search recursively in subdirectories (single-repo mode only)",
    },
    dryRun: {
      type: "boolean",
      description: "Preview what would be deleted without actually deleting",
    },
    force: {
      type: "boolean",
      description:
        "Required flag to proceed with deletion (no prompts, args-only)",
    },
    verbose: {
      type: "boolean",
      description: "Verbose mode with detailed logging",
    },
    deleteLockFiles: {
      type: "boolean",
      description:
        "Include lock files (bun.lock, package-lock.json, etc.) when using deps preset",
    },
    replaceExports: {
      type: "boolean",
      description:
        "Replace exports from ./src/*.ts to ./dist/*.js before cleaning (default: true)",
    },
    replaceExportsIgnorePackages: {
      type: "string",
      description:
        "Packages to ignore when replacing exports (supports glob patterns like @reliverse/*)",
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Replace exports if enabled (default: true, unless explicitly false)
      const shouldReplaceExports = args.replaceExports !== false;
      if (shouldReplaceExports) {
        if (args.verbose) {
          logger.info(
            "📝 Replacing exports from ./dist/*.js to ./src/*.ts before cleaning...",
          );
        }
        await replaceExportsInPackages({
          direction: "js-to-ts",
          cwd: args.cwd,
          ignorePackages: args.replaceExportsIgnorePackages,
          verbose: args.verbose,
        });
      }

      const results = await runCleanOnAllPackages(args.ignore, args.cwd, args);

      if (results.hasErrors) {
        process.exit(1);
      }

      if (args.dryRun) {
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
