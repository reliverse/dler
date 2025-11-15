// apps/dler/src/cmds/tsc/cmd.ts

// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { runTscOnAllPackages } from "./impl";

export default defineCommand({
  meta: {
    name: "tsc",
    description: "Run TypeScript type checking on all workspace packages",
    examples: [
      "dler tsc",
      'dler tsc --ignore "@reliverse/*"',
      'dler tsc --ignore "@reliverse/dler-colors" --ignore "@reliverse/dler-v1"',
      'dler tsc --ignore "@reliverse/dler-colors @reliverse/dler-v1"',
      "dler tsc --cwd /path/to/monorepo",
      "dler tsc --cwd /path/to/monorepo --ignore @reliverse/*",
      "dler tsc --concurrency 8",
      "dler tsc --concurrency 2 --stopOnError",
      "dler tsc --ignore @reliverse/* --concurrency 6 --stopOnError",
      "dler tsc --verbose",
      "dler tsc --verbose --ignore @reliverse/*",
      "dler tsc --verbose --concurrency 2 --stopOnError",
      "dler tsc --copy-logs",
      "dler tsc --copy-logs --verbose",
      "dler tsc --auto-concurrency",
      "dler tsc --no-cache",
      "dler tsc --no-incremental",
      "dler tsc --build-mode",
      "dler tsc --skip-unchanged",
      "dler tsc --auto-concurrency --build-mode --verbose",
    ],
  },
  args: defineArgs({
    ignore: {
      type: "string",
      description:
        "Package(s) to ignore (supports wildcards like @reliverse/*)",
    },
    cwd: {
      type: "string",
      description: "Working directory (monorepo root)",
    },
    concurrency: {
      type: "number",
      description:
        "Number of packages to check concurrently (default: CPU cores)",
    },
    stopOnError: {
      type: "boolean",
      description:
        "Stop on first error instead of collecting all errors (default: false)",
    },
    verbose: {
      type: "boolean",
      description: "Verbose mode (default: false)",
    },
    copyLogs: {
      type: "boolean",
      description: "Copy failed package logs to clipboard (default: false)",
    },
    cache: {
      type: "boolean",
      description: "Enable caching for faster subsequent runs (default: true)",
    },
    incremental: {
      type: "boolean",
      description: "Use TypeScript incremental compilation (default: true)",
    },
    autoConcurrency: {
      type: "boolean",
      description:
        "Auto-detect optimal concurrency based on CPU cores (default: false)",
    },
    skipUnchanged: {
      type: "boolean",
      description:
        "Skip packages with no changes since last check (default: true)",
    },
    buildMode: {
      type: "boolean",
      description: "Use tsc --build for project references (default: false)",
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      const results = await runTscOnAllPackages(args.ignore, args.cwd, {
        concurrency: args.concurrency,
        stopOnError: args.stopOnError,
        verbose: args.verbose,
        copyLogs: args.copyLogs,
        cache: args.cache,
        incremental: args.incremental,
        autoConcurrency: args.autoConcurrency,
        skipUnchanged: args.skipUnchanged,
        buildMode: args.buildMode,
      });

      if (results.hasErrors) {
        process.exit(1);
      }

      logger.success("\n✅ All packages passed type checking!");
    } catch (error) {
      logger.error("\n❌ TypeScript check failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
