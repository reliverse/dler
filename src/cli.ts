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
import { getBuildCmd, getPubCmd, getUpdateCmd } from "./app/cmds";
import { showEndPrompt, showStartPrompt } from "./libs/sdk/sdk-impl/config/info";
import { ensureDlerConfig } from "./libs/sdk/sdk-impl/config/init";

const MENU_CMDS = ["agg", "build", "pub", "update"];

const main = defineCommand({
  meta: {
    name: "dler",
    description: `Displays dler's command menu.\nTo see ALL available commands and arguments, run: 'dler --help' (or 'dler <command> --help')\nAvailable menu commands: ${MENU_CMDS.join(", ")}`,
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
    const isDev = args.dev || process.env.DLER_DEV_MODE === "true";
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

    await ensureDlerConfig(isDev);

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
    await showStartPrompt(isDev);

    const cmdToRun = await selectPrompt({
      title: "Select a command to run (run 'dler --help' to see all available commands)",
      options: [
        { value: "build", label: "build project" },
        { value: "pub", label: "publish project" },
        { value: "update", label: "update deps" },
        { value: "agg", label: "aggregate" },
        { value: "exit", label: "exit" },
      ],
    });

    switch (cmdToRun) {
      case "build": {
        await runCmd(await getBuildCmd(), [`--dev=${isDev} --no-pub`]);
        break;
      }
      case "pub": {
        await runCmd(await getPubCmd(), [`--dev=${isDev}`]);
        break;
      }
      case "agg": {
        await promptAggCommand();
        break;
      }
      case "update": {
        await runCmd(await getUpdateCmd(), []);
        break;
      }
    }

    await showEndPrompt();
  },
});

await runMain(main);
