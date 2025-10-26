#!/usr/bin/env bun

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import type { IntegrateOptions } from "./impl";
import { runIntegrate } from "./impl";

const integrateCmd = async (args: any): Promise<void> => {
  try {
    const options: IntegrateOptions = {
      x: args.x,
      target: args.target,
      verbose: args.verbose || false,
      cwd: args.cwd,
    };

    await runIntegrate(options);
  } catch (error) {
    logger.error("\n❌ Integration failed:");

    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }

    process.exit(1);
  }
};

const integrateCmdArgs = defineCmdArgs({
  x: {
    type: "string",
    description:
      "Integration(s) to install (comma-separated, e.g., 'nextjs,ultracite')",
    required: true,
  },
  target: {
    type: "string",
    description:
      "Target package in monorepo (optional, will prompt if not specified)",
  },
  verbose: {
    type: "boolean",
    description: "Verbose mode for detailed logging (default: false)",
  },
  cwd: {
    type: "string",
    description: "Working directory (default: current directory)",
  },
});

const integrateCmdCfg = defineCmdCfg({
  name: "integrate",
  description:
    "Automatically install and configure integrations like Next.js and Ultracite/Biome. Supports both monorepo and single-repo contexts.",
  examples: [
    "dler integrate --x nextjs",
    "dler integrate --x ultracite",
    "dler integrate --x nextjs,ultracite",
    "dler integrate --x nextjs --target my-app",
    "dler integrate --x ultracite --verbose",
    "dler integrate --x nextjs --cwd /path/to/project",
    "",
    "# Available integrations:",
    "# - nextjs: Next.js React framework with App Router, TypeScript, and Tailwind CSS",
    "# - ultracite: Ultracite preset for Biome (highly opinionated linter and formatter)",
    "",
    "# Monorepo usage:",
    "# The command will automatically detect if you're in a monorepo and prompt you to",
    "# select a target package, or you can specify one with --target",
    "",
    "# Single-repo usage:",
    "# The command will install integrations directly into the current directory",
  ],
});

export default defineCmd(integrateCmd, integrateCmdArgs, integrateCmdCfg);
