// apps/dler/src/cmds/biome/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { runBiomeCheck } from "./impl";

export default defineCommand({
  description: "Run Biome linting and formatting check on workspace",
  options: {
    cwd: option(type("string | undefined"), {
      description: "Working directory to run biome from (default: current directory)",
    }),
    verbose: option(type("boolean | undefined"), {
      description: "Verbose mode (default: false)",
    }),
    copyLogs: option(type("boolean | undefined"), {
      description: "Copy diagnostics to clipboard (default: true, skipped in CI)",
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
      const verbose = flags.verbose ?? false;
      const copyLogs = flags.copyLogs ?? true;

      // Skip copying in CI environment
      const isCI = process.env.CI === "true" || !process.stdout.isTTY;
      const shouldCopyLogs = copyLogs !== false && !isCI;

      const result = await runBiomeCheck({
        cwd: flags.cwd || process.cwd(), // Type '{}' is not assignable to type 'string'.
        verbose, // Type '{}' is not assignable to type 'boolean | undefined'.
        copyLogs: shouldCopyLogs,
      });

      if (!result.success) {
        process.exit(1);
      }

      logger.success("\n✅ Biome check passed!");
    } catch (error) {
      logger.error("\n❌ Biome check failed:");

      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
