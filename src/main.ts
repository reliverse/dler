import { defineCommand, errorHandler, runMain } from "@reliverse/prompts";

import { initRelidlerConfig } from "./libs/sdk/sdk-init.js";
import { relidler } from "./libs/sdk/sdk-main.js";

const main = defineCommand({
  meta: {
    name: "relidler",
    version: "1.0.12",
    description: "https://docs.reliverse.org",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
      required: false,
    },
  },
  run: async ({ args }) => {
    const isDev = args.dev;
    await initRelidlerConfig(isDev);
    await relidler(isDev);
  },
});

if (import.meta.main) {
  await runMain(main).catch((error: unknown) => {
    errorHandler(
      error instanceof Error ? error : new Error(String(error)),
      "An unhandled error occurred, please report it at https://github.com/reliverse/relidler",
    );
  });
}
