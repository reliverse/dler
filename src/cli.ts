import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import {
  runMain,
  defineCommand,
  defineArgs,
  selectPrompt,
  showUsage,
  runCmd,
} from "@reliverse/rempts";

import { promptAggCommand } from "./app/agg/run";
import { getBuildCmd, getPubCmd, getInitCmd, getRenameCmd } from "./app/cmds";
import { showEndPrompt, showStartPrompt } from "./libs/sdk/sdk-impl/config/info";
import { ensureDlerConfig } from "./libs/sdk/sdk-impl/config/init";
import { getConfigDler } from "./libs/sdk/sdk-impl/config/load";

const INTERACTIVE_CMDS = ["agg", "build", "pub"];

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

interface SeparatorOption {
  separator: true;
}

type PromptOption = SelectOption | SeparatorOption;

const main = defineCommand({
  meta: {
    name: "dler",
    description: `Interactively runs selected dler's command.\nHowever, NI (non-interactive) mode is more powerful, to see NI mode available commands and arguments: 'dler --help' (or 'dler <command> --help')\nAvailable interactive commands: ${INTERACTIVE_CMDS.join(", ")}`,
  },
  onLauncherInit() {
    const isBun = process.versions.bun;
    if (!isBun) {
      relinka(
        "warn",
        "🔥 At the moment Dler is optimized only for Bun! We can't guarantee any success for other environments like Node.js, Deno, etc.",
      );
    }
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

    const config = await getConfigDler();
    const hasValidCLIConfig =
      config.coreIsCLI?.enabled &&
      config.coreIsCLI?.scripts &&
      Object.keys(config.coreIsCLI.scripts).length > 0;

    const options: PromptOption[] = [
      { value: "build", label: "build project" },
      { value: "pub", label: "publish project" },
      { value: "agg", label: "aggregate files" },
      { separator: true },
      { value: "utils", label: re.bold("UTILS"), disabled: true },
      { separator: true },
      { value: "copy", label: "copy files" },
      { value: "init", label: "init files" },
      { value: "remdn", label: "run remdn", hint: "undocs alternative" },
    ];

    if (hasValidCLIConfig) {
      options.push(
        {
          value: "rename-prepare",
          label: "[experimental] my project is a bootstrapper cli (apply rename optimizations)",
        },
        {
          value: "rename-prepare-revert",
          label: "[experimental] revert rename cli files optimizations",
        },
      );
    }

    const cmdToRun = await selectPrompt({
      title: "Select a command to run",
      options,
    });

    if (cmdToRun === "agg") {
      await promptAggCommand();
    } else if (cmdToRun === "build") {
      await runCmd(await getBuildCmd(), [`--dev=${args.dev} --no-pub`]);
    } else if (cmdToRun === "pub") {
      await runCmd(await getPubCmd(), [`--dev=${args.dev}`]);
    } else if (cmdToRun === "init") {
      await runCmd(await getInitCmd(), []);
    } else if (cmdToRun === "rename-prepare") {
      await runCmd(await getRenameCmd(), ["--prepareMyCLI"]);
    } else if (cmdToRun === "rename-prepare-revert") {
      await runCmd(await getRenameCmd(), ["--prepareMyCLI", "--revert"]);
    }

    relinka("log", " ");
    await showEndPrompt();
  },
});

await runMain(main);
