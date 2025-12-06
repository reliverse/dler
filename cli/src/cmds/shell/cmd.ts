import { logger } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { $ } from "bun";

export default defineCommand({
  meta: {
    name: "shell",
    description: "Execute shell commands using Bun Shell API",
    examples: [
      'dler shell --x "echo Hello World"',
      'dler shell --x "ls -la"',
      'dler shell --x "cat package.json | grep name"',
    ],
  },
  args: defineArgs({
    x: {
      type: "string",
      required: true,
      description: "Shell command to execute",
    },
  }),
  run: async ({ args }) => {
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
        interface ShellError extends Error {
          exitCode?: number;
          stdout?: { toString(): string };
          stderr?: { toString(): string };
        }
        const shellError = error as ShellError;
        if ("exitCode" in error) {
          logger.error(`Exit code: ${shellError.exitCode ?? "unknown"}`);
          if (shellError.stdout) {
            logger.error(`STDOUT: ${shellError.stdout.toString()}`);
          }
          if (shellError.stderr) {
            logger.error(`STDERR: ${shellError.stderr.toString()}`);
          }
        } else {
          logger.error(error.message);
        }
      } else {
        logger.error(String(error));
      }

      process.exit(1);
    }
  },
});
