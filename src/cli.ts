import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import {
  runMain,
  defineCommand,
  defineArgs,
  selectPrompt,
  showUsage,
  runCmd as remptsRunCmd,
  type Command,
} from "@reliverse/rempts";

import { promptAggCommand } from "./app/agg/run";
import { getBuildCmd, getPubCmd, getInitCmd, getRenameCmd } from "./app/cmds";
import { showEndPrompt, showStartPrompt } from "./libs/sdk/sdk-impl/config/info";
import { ensureDlerConfig } from "./libs/sdk/sdk-impl/config/init";

const INTERACTIVE_CMDS = ["agg", "build", "pub"];

/**
 * Wrapper around rempts' runCmd to handle jiti-loaded modules
 */
async function runCmd(cmdPromise: Promise<Command>, args: string[]) {
  const cmd = await cmdPromise;
  // Ensure we have a valid command object with required properties
  if (!cmd || typeof cmd !== "object" || !cmd.meta || !cmd.run) {
    throw new Error("Invalid command module: missing required properties");
  }
  return remptsRunCmd(cmd, args);
}

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
    cwd: {
      type: "string",
      description: "The working directory to run the CLI in",
      default: process.cwd(),
    },
  }),
  async run({ args }) {
    const isDev = args.dev;
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

    await ensureDlerConfig(args.dev);

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
        { value: "build", label: "build project" },
        { value: "pub", label: "publish project" },
        { value: "agg", label: "aggregate files" },
        { separator: true },
        { value: "utils", label: re.bold("UTILS"), disabled: true },
        { separator: true },
        { value: "copy", label: "copy files" },
        { value: "init", label: "init files" },
        {
          value: "rename-prepare",
          label: "[experimental] my project is a bootstrapper cli (apply rename optimizations)",
        },
        {
          value: "rename-prepare-revert",
          label: "[experimental] revert rename cli files optimizations",
        },
      ],
    });

    if (cmdToRun === "agg") {
      await promptAggCommand();
    } else if (cmdToRun === "build") {
      await runCmd(getBuildCmd(), [`--dev=${args.dev}`]);
    } else if (cmdToRun === "pub") {
      await runCmd(getPubCmd(), [`--dev=${args.dev}`]);
    } else if (cmdToRun === "init") {
      await runCmd(getInitCmd(), []);
    } else if (cmdToRun === "rename-prepare") {
      await runCmd(getRenameCmd(), ["--prepareMyCLI"]);
    } else if (cmdToRun === "rename-prepare-revert") {
      await runCmd(getRenameCmd(), ["--prepareMyCLI", "--revert"]);
    }

    relinka("log", " ");
    await showEndPrompt();
  },
});

await runMain(main);
