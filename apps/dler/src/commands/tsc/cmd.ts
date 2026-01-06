// apps/dler/src/cmds/tsc/cmd.ts

// Note on `bun publish` and `bun tsc`: we don't display npm/tsc raw output, because both are not reliable for concurrent display, so we display them on our own.

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { runTscOnAllPackages } from "./impl";

export default defineCommand({
  name: "tsc",
  description: "Run TypeScript type checking on all workspace packages",
  options: {
    filter: option(type("string | undefined"), {
      description:
        "Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided.",
    }),
    ignore: option(type("string | undefined"), {
      description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
    }),
    cwd: option(type("string | undefined"), {
      description: "Working directory (monorepo root)",
    }),
    concurrency: option(type("number | undefined"), {
      description: "Number of packages to check concurrently (default: CPU cores)",
    }),
    stopOnError: option(type("boolean | undefined"), {
      description: "Stop on first error instead of collecting all errors (default: false)",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose mode (default: false)",
    }),
    copyLogs: option(type("boolean | undefined"), {
      description: "Copy failed package logs to clipboard (default: true, skipped in CI)",
    }),
    cache: option(type("boolean | undefined"), {
      description: "Enable caching for faster subsequent runs (default: true)",
    }),
    incremental: option(type("boolean | undefined"), {
      description: "Use TypeScript incremental compilation (default: true)",
    }),
    autoConcurrency: option(type("boolean | undefined"), {
      description: "Auto-detect optimal concurrency based on CPU cores (default: false)",
    }),
    skipUnchanged: option(type("boolean | undefined"), {
      description: "Skip packages with no changes since last check (default: true)",
    }),
    buildMode: option(type("boolean | undefined"), {
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
        copyLogs: shouldCopyLogs,
        ...(flags.filter && { filter: flags.filter }),
        ...(flags.concurrency && { concurrency: flags.concurrency }),
        ...(flags.stopOnError && { stopOnError: flags.stopOnError }),
        ...(flags.verbose && { verbose: flags.verbose }),
        ...(flags.cache && { cache: flags.cache }),
        ...(flags.incremental && { incremental: flags.incremental }),
        ...(flags.autoConcurrency && { autoConcurrency: flags.autoConcurrency }),
        ...(flags.skipUnchanged && { skipUnchanged: flags.skipUnchanged }),
        ...(flags.buildMode && { buildMode: flags.buildMode }),
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
