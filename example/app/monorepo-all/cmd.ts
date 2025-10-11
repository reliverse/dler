import { defineArgs, defineCommand } from "@reliverse/rempts";
import { allCommand, type MonorepoContext } from "~/impl/monorepo/commands-mod";
import { commonEndActions, commonStartActions, getCurrentWorkingDirectory } from "~/mod";

export default defineCommand({
  meta: {
    name: "monorepo-all",
    description: "Build all packages in the monorepo",
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
  }),
  run: async ({ args }) => {
    const { ci, dev, cwd, debug } = args;

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
      cmdArgs: [], // No command args for all
    };

    await allCommand(ctx);

    await commonEndActions({ withEndPrompt: true });
  },
});
