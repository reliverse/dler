import { defineCommand, errorHandler, runMain } from "@reliverse/prompts";

import { relidler } from "./cli.js";
import { initRelidlerConfig } from "./init.js";

const main = defineCommand({
  args: {
    dev: {
      description: "Runs the CLI in dev mode",
      required: false,
      type: "boolean",
    },
  },
  meta: {
    description: "https://docs.reliverse.org",
    name: "relidler",
    version: "1.0.12",
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
