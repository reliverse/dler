#!/usr/bin/env bun

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { $ } from "bun";

const shellCmd = async (args: { x: string }): Promise<void> => {
  try {
    // Execute the command using Bun Shell
    const commandParts = args.x.split(/\s+/);
    const [command, ...commandArgs] = commandParts;

    // Use template literal with arguments interpolation
    await $`${command} ${commandArgs.join(" ")}`;
  } catch (error) {
    logger.error("\n❌ Command failed:");

    if (error instanceof Error) {
      // Check if it's a ShellError with exit code
      if ("exitCode" in error) {
        logger.error(`Exit code: ${(error as any).exitCode}`);
        if ((error as any).stdout) {
          logger.error(`STDOUT: ${(error as any).stdout.toString()}`);
        }
        if ((error as any).stderr) {
          logger.error(`STDERR: ${(error as any).stderr.toString()}`);
        }
      } else {
        logger.error(error.message);
      }
    } else {
      logger.error(String(error));
    }

    process.exit(1);
  }
};

const shellCmdArgs = defineCmdArgs({
  x: {
    type: "string",
    required: true,
    description: "Shell command to execute",
  },
});

const shellCmdCfg = defineCmdCfg({
  name: "shell",
  description: "Execute shell commands using Bun Shell API",
  examples: [
    'dler shell --x "echo Hello World"',
    'dler shell --x "ls -la"',
    'dler shell --x "cat package.json | grep name"',
  ],
});

export default defineCmd(shellCmd, shellCmdArgs, shellCmdCfg);
