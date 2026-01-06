// apps/dler/src/cmds/biome/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";
import { runBiomeCheck } from "./impl";

export default defineCommand({
  name: "biome",
  description: "Run Biome linting and formatting check on workspace",
  options: {
    cwd: option(z.string().optional(), {
      description: "Working directory to run biome from (default: current directory)",
    }),
    verbose: option(z.boolean().default(false), {
      description: "Verbose mode (default: false)",
    }),
    copyLogs: option(z.boolean().default(true), {
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

      // Skip copying in CI environment
      const isCI = process.env.CI === "true" || !process.stdout.isTTY;
      const shouldCopyLogs = flags.copyLogs !== false && !isCI;

      const result = await runBiomeCheck({
        cwd: flags.cwd,
        verbose: flags.verbose,
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
