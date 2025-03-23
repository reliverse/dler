import { defineCommand, errorHandler, runMain } from "@reliverse/prompts";

import { relidler } from "./cli.js";
import { initRelidlerConfig } from "./init.js";
import { validateDevCwd } from "./libs/sdk/sdk-impl/utils/utils-cwd.js";

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
    // Get relidler dev flag
    const isDev = args.dev;

    // Ensure --dev flag is used only within a valid relidler dev env
    await validateDevCwd(isDev, ["relidler"], "relidler", "reliverse");

    // Init config if does not exist
    await initRelidlerConfig(isDev);

    // Run Relidler CLI
    await relidler(isDev);
  },
  subCommands: {
    tools: () => import("./tools.js").then((r) => r.default),
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
