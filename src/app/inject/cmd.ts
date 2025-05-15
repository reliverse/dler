import { relinka } from "@reliverse/relinka";
import { defineCommand, selectPrompt } from "@reliverse/rempts";

export default defineCommand({
  meta: {
    name: "cli",
    description:
      "Runs the Reinject CLI interactive menu (displays list of available commands)",
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

    await selectPrompt({
      title: "Select a command",
      options: [
        {
          value: "ts-expect-error",
          label: "Inject `@ts-expect-error` above lines where TS errors occur",
        },
      ],
    });
  },
});
