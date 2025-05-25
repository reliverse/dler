import { relinka } from "@reliverse/relinka";
import {
  runMain,
  defineCommand,
  defineArgs,
  selectPrompt,
  showUsage,
  runCmd,
} from "@reliverse/rempts";

import { promptAggCommand } from "./app/agg/run.js";
import { cmdBuild, cmdPub } from "./app/cmds.js";
import { showEndPrompt, showStartPrompt } from "./init/info.js";

const INTERACTIVE_CMDS = ["agg", "build", "pub"];

const main = defineCommand({
  meta: {
    name: "dler",
    description: `Interactively runs selected dler's command.\nHowever, NI (non-interactive) mode is more powerful, to see NI mode available commands and arguments: 'dler --help' (or 'dler <command> --help')\nAvailable interactive commands: ${INTERACTIVE_CMDS.join(", ")}`,
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  }),
  async run({ args }) {
    const isCI = process.env.CI === "true";
    const isNonInteractive = !process.stdout.isTTY;
    if (isCI || isNonInteractive) {
      relinka(
        "error",
        "Non-interactive mode was detected. Please use `dler --help` to see available non-interactive commands and options.",
      );
      showUsage(main);
      process.exit(0);
    }
    await showStartPrompt(args.dev);

    const cmdToRun = await selectPrompt({
      title: "Select a command to run",
      options: [
        { value: "agg", label: "agg" },
        { value: "build", label: "build" },
        { value: "pub", label: "pub" },
      ],
    });

    if (cmdToRun === "agg") {
      await promptAggCommand();
    }

    if (cmdToRun === "build") {
      await runCmd(await cmdBuild(), [`--dev=${args.dev}`]);
    }

    if (cmdToRun === "pub") {
      await runCmd(await cmdPub(), [`--dev=${args.dev}`]);
    }

    relinka("log", " ");
    await showEndPrompt();
  },
});

await runMain(main);
