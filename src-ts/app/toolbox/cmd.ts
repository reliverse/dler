import { defineCommand } from "@reliverse/rempts";
import { getOrCreateReliverseConfig } from "~/app/config/core-cfg";
import { showDevToolsMenu } from "~/app/toolbox/toolbox-impl";
import { getOrCreateReliverseMemory } from "~/app/utils/reliverseMemory";
import { getCurrentWorkingDirectory } from "~/app/utils/terminalHelpers";

export default defineCommand({
  meta: {
    name: "studio",
    description: "Provides information on how to open rseo",
    hidden: true,
  },
  args: {
    dev: {
      type: "boolean",
      default: false,
    },
  },
  run: async ({ args }) => {
    const isDev = args.dev;
    const cwd = getCurrentWorkingDirectory();
    const { config } = await getOrCreateReliverseConfig({
      projectPath: cwd,
      isDev,
      overrides: {},
    });
    const memory = await getOrCreateReliverseMemory();
    await showDevToolsMenu({
      projectName: "",
      cwd,
      isDev,
      config,
      memory,
      skipPrompts: false,
    });
    process.exit(0);
  },
});
