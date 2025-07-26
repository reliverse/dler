import { relinka } from "@reliverse/relinka";
import { runMain, defineCommand, defineArgs, selectPrompt, showUsage } from "@reliverse/rempts";

import { promptAggCommand } from "./app/agg/run";
import { callCmd } from "./app/cmds";
import { showEndPrompt, showStartPrompt } from "./libs/sdk/sdk-impl/config/info";
import { prepareDlerEnvironment } from "./libs/sdk/sdk-impl/config/prepare";

const MENU_CMDS = ["agg", "build", "pub", "update"];
let isDev = process.env.DLER_DEV_MODE === "true";

const main = defineCommand({
  meta: {
    name: "dler",
    description: `Displays dler's command menu.\nTo see ALL available commands and arguments, run: 'dler --help' (or 'dler <command> --help')\nAvailable menu commands: ${MENU_CMDS.join(", ")}`,
  },
  async onLauncherInit() {
    const isBun = process.versions.bun;
    if (!isBun) {
      relinka(
        "warn",
        "🔥 dler is currently bun-first. support for node.js, deno, and others is experimental until v2.0.",
      );
    }
    await prepareDlerEnvironment(isDev);
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);
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
    isDev = args.dev;
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
        await callCmd("build", { dev: isDev });
        break;
      }
      case "pub": {
        await callCmd("pub", { dev: isDev });
        break;
      }
      case "update": {
        await callCmd("update");
        break;
      }
      case "upgrade": {
        await callCmd("upgrade");
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
