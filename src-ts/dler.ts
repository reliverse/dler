// TODO: dler's cli is deprecated starting from v1.7.90 and PROBABLY will be removed in v1.8.x

import { relinka } from "@reliverse/relinka";
import {
  callCmd,
  defineArgs,
  defineCommand,
  runMain,
  selectPrompt,
  showUsage,
} from "@reliverse/rempts";
import { default as buildCmd } from "~/app/build/cmd";
import { prepareReliverseEnvironment } from "~/app/config/prepare";
import {
  showEndPrompt,
  showStartPrompt,
} from "~/app/init/use-template/cp-modules/cli-main-modules/modules/showStartEndPrompt";
import { default as pubCmd } from "~/app/pub/cmd";
import { default as updateCmd } from "~/app/update/cmd";
import { default as upgradeCmd } from "~/app/upgrade/cmd";
import { promptAggCommand } from "~/app/utils/agg/agg-1";

const MENU_CMDS = ["agg", "build", "pub", "update"];

const main = defineCommand({
  meta: {
    name: "dler",
    version: "1.7.109",
    description: `Displays dler's command menu.\nTo see ALL available commands and arguments, run: 'dler --help' (or 'dler <command> --help')\nAvailable menu commands: ${MENU_CMDS.join(", ")}`,
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
    "install-dlerust": {
      type: "boolean",
      description: "(experimental) Install 'dlerust' binary",
      default: false,
    },
  }),
  async run({ args }) {
    const isDev = args.dev;
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
    await showStartPrompt(isDev, false);

    await prepareReliverseEnvironment(isDev, "ts");
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

    const cmdToRun = await selectPrompt({
      title: "Select a command to run",
      content: "Run 'dler --help' to see all available commands",
      options: [
        { value: "build", label: "build only project" },
        { value: "pub", label: "build+pub project" },
        { value: "upgrade", label: "upgrade dev tools" },
        { value: "update", label: "update all deps" },
        { value: "agg", label: "aggregate" },
        { value: "exit", label: "exit" },
      ],
    });

    switch (cmdToRun) {
      case "build": {
        await callCmd(buildCmd, { dev: isDev });
        break;
      }
      case "pub": {
        await callCmd(pubCmd, { dev: isDev });
        break;
      }
      case "update": {
        await callCmd(updateCmd, {});
        break;
      }
      case "upgrade": {
        await callCmd(upgradeCmd, {});
        break;
      }
      case "agg": {
        await promptAggCommand();
        break;
      }
    }

    await showEndPrompt();
  },
});

await runMain(main);
