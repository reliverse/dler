// apps/dler/src/cmds/tsc/cmd.ts

// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";
import { runTscOnAllPackages } from "./impl";

export default defineCommand({
  name: "tsc",
  description: "Run TypeScript type checking on all workspace packages",
  options: {
    filter: option(z.string().optional(), {
      description:
        "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
    }),
    ignore: option(z.string().optional(), {
      description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
    }),
    cwd: option(z.string().optional(), {
      description: "Working directory (monorepo root)",
    }),
    concurrency: option(z.coerce.number().optional(), {
      description: "Number of packages to check concurrently (default: CPU cores)",
    }),
    stopOnError: option(z.boolean().default(false), {
      description: "Stop on first error instead of collecting all errors (default: false)",
    }),
    verbose: option(z.boolean().default(false), {
      description: "Verbose mode (default: false)",
    }),
    copyLogs: option(z.boolean().default(true), {
      description: "Copy failed package logs to clipboard (default: true, skipped in CI)",
    }),
    cache: option(z.boolean().default(true), {
      description: "Enable caching for faster subsequent runs (default: true)",
    }),
    incremental: option(z.boolean().default(true), {
      description: "Use TypeScript incremental compilation (default: true)",
    }),
    autoConcurrency: option(z.boolean().default(false), {
      description: "Auto-detect optimal concurrency based on CPU cores (default: false)",
    }),
    skipUnchanged: option(z.boolean().default(true), {
      description: "Skip packages with no changes since last check (default: true)",
    }),
    buildMode: option(z.boolean().default(false), {
      description: "Use tsc --build for project references (default: false)",
    }),
  },
  handler: async ({ flags }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Skip copying in CI environment
      const isCI = process.env.CI === "true" || !process.stdout.isTTY;
      const shouldCopyLogs = flags.copyLogs !== false && !isCI;

      const results = await runTscOnAllPackages(flags.ignore, flags.cwd, {
        filter: flags.filter,
        concurrency: flags.concurrency,
        stopOnError: flags.stopOnError,
        verbose: flags.verbose,
        copyLogs: shouldCopyLogs,
        cache: flags.cache,
        incremental: flags.incremental,
        autoConcurrency: flags.autoConcurrency,
        skipUnchanged: flags.skipUnchanged,
        buildMode: flags.buildMode,
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
