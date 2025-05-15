import { runMain, defineCommand, defineArgs } from "@reliverse/rempts";

import { initDlerConfig } from "./init.js";

const main = defineCommand({
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  }),
  async onCmdInit({ args }) {
    await initDlerConfig(args.dev);
  },
});

await runMain(main);
