// apps/dler/src/cmds/biome/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { runBiomeCheck } from "./impl";

export default defineCommand({
  meta: {
    name: "biome",
    description: "Run Biome linting and formatting check on workspace",
    examples: [
      "dler biome",
      "dler biome --cwd /path/to/project",
      "dler biome --verbose",
      "dler biome --copy-logs",
      "dler biome --verbose --copy-logs",
    ],
  },
  args: defineArgs({
    cwd: {
      type: "string",
      description:
        "Working directory to run biome from (default: current directory)",
    },
    verbose: {
      type: "boolean",
      description: "Verbose mode (default: false)",
    },
    copyLogs: {
      type: "boolean",
      description:
        "Copy diagnostics to clipboard (default: true, skipped in CI)",
      default: true,
    },
  }),
  run: async ({ args }) => {
    try {
      // Check if running in Bun
      if (typeof process.versions.bun === "undefined") {
        logger.error("❌ This command requires Bun runtime. Sorry.");
        process.exit(1);
      }

      // Skip copying in CI environment
      const isCI = process.env.CI === "true" || !process.stdout.isTTY;
      const shouldCopyLogs = args.copyLogs !== false && !isCI;

      const result = await runBiomeCheck({
        cwd: args.cwd,
        verbose: args.verbose,
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
