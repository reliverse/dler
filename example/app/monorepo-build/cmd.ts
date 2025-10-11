import { defineArgs, defineCommand } from "@reliverse/rempts";
import { buildCommand, type MonorepoContext } from "~/impl/monorepo/commands-mod";
import { commonEndActions, commonStartActions, getCurrentWorkingDirectory } from "~/mod";

export default defineCommand({
  meta: {
    name: "monorepo-build",
    description: "Build dependencies and run a command in a monorepo",
  },
  args: defineArgs({
    ci: {
      type: "boolean",
      description: "Run in CI mode",
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    dev: {
      type: "boolean",
      description: "Run in dev mode",
    },
    cwd: {
      type: "string",
      description: "Current working directory",
      default: getCurrentWorkingDirectory(),
    },
    debug: {
      type: "boolean",
      description: "Enable debug logging",
      default: process.env.DEBUG === "dler",
    },
    command: {
      type: "string",
      description: "Command to run after building dependencies",
      required: true,
    },
    args: {
      type: "array",
      description: "Arguments to pass to the command",
      default: [],
    },
  }),
  run: async ({ args }) => {
    const { ci, dev, cwd, debug, command, args: cmdArgs } = args;

    await commonStartActions({
      isCI: Boolean(ci),
      isDev: Boolean(dev),
      cwdStr: String(cwd),
      showRuntimeInfo: false,
      clearConsole: false,
      withStartPrompt: true,
    });

    const ctx: MonorepoContext = {
      isDebug: Boolean(debug),
      cmdArgs: [command, ...(cmdArgs as string[])],
    };

    await buildCommand(ctx);

    await commonEndActions({ withEndPrompt: true });
  },
});
