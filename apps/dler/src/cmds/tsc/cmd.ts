// apps/dler/src/cmds/tsc/cmd.ts

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { runTscOnAllPackages } from "./impl";

const tscCmd = async (args: {
  ignore?: string | string[];
  cwd?: string;
  concurrency?: number;
  stopOnError?: boolean;
  verbose?: boolean;
}): Promise<void> => {
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
};

const tscCmdArgs = defineCmdArgs({
  ignore: {
    type: "string",
    description: "Package(s) to ignore (supports wildcards like @reliverse/*)",
    required: false,
  },
  cwd: {
    type: "string",
    description: "Working directory (monorepo root)",
    required: false,
  },
  concurrency: {
    type: "number",
    description: "Number of packages to check concurrently (default: 5)",
    required: false,
  },
  stopOnError: {
    type: "boolean",
    description:
      "Stop on first error instead of collecting all errors (default: false)",
    required: false,
  },
  verbose: {
    type: "boolean",
    description: "Verbose mode (default: false)",
    required: false,
  },
});

const tscCmdCfg = defineCmdCfg({
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
  ],
});

export default defineCmd(tscCmd, tscCmdArgs, tscCmdCfg);
