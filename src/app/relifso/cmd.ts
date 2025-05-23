import { relinka } from "@reliverse/relinka";
import { defineCommand, runCmd, selectPrompt } from "@reliverse/rempts";

import { cmdRelifsoInit } from "~/app/cmds.js";

export default defineCommand({
  meta: {
    name: "relifso",
    description:
      "Runs the Relifso helper interactive menu (displays list of available commands)",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
    cwd: {
      type: "string",
      description: "The working directory to run the CLI in",
      required: false,
    },
  },
  run: async ({ args }) => {
    const isDev = args.dev;
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

    const cmd = await selectPrompt({
      title: "Select a command",
      options: [
        {
          value: "init",
          label: "Initialize files",
        },
      ],
    });

    if (cmd === "init") {
      await runCmd(await cmdRelifsoInit(), []);
    }
  },
});
