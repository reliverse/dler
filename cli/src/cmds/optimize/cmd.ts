// cli/src/cmds/optimize/cmd.ts

import { logger } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { optimizePackage } from "./impl";
import type { OptimizeOptions } from "./types";

export default defineCommand({
  meta: {
    name: "optimize",
    description:
      "Automatically identify and optimize the most recently modified package",
    examples: [
      "dler optimize",
      "dler optimize --target @reliverse/relinka",
      "dler optimize --dry-run",
      "dler optimize --tolerance 0.15 --verbose",
    ],
  },
  args: defineArgs({
    target: {
      type: "string",
      description:
        "Specify a target package to optimize (default: most recently modified)",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be optimized without making changes",
    },
    tolerance: {
      type: "number",
      description: "Regression tolerance percentage (default: 0.1 = 10%)",
    },
    verbose: {
      type: "boolean",
      description: "Show detailed output",
    },
    cwd: {
      type: "string",
      description: "Working directory",
    },
  }),
  run: async ({ args }) => {
    const options: OptimizeOptions = {
      target: args.target,
      dryRun: args["dry-run"],
      tolerance: args.tolerance,
      verbose: args.verbose,
      cwd: args.cwd,
    };

    const result = await optimizePackage(options);

    if (!result.success) {
      logger.error(`\n❌ Optimization failed: ${result.message}`);
      process.exit(1);
    } else {
      logger.success(`\n✅ ${result.message}`);
      if (result.improvements.length > 0) {
        logger.info(`\n📈 Improvements applied:`);
        for (const improvement of result.improvements) {
          logger.info(`  • ${improvement}`);
        }
      }
    }
  },
});

