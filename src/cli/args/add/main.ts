// todo: implement
import { defineCommand, errorHandler, runMain } from "@reliverse/prompts";

const main = defineCommand({
  meta: {
    name: "reinject",
    version: "1.0.0",
    description: "@reliverse/reinject-cli",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  },
  subCommands: {
    cli: () => import("./cli/cli-mod.js").then((r) => r.default),
    tee: () => import("./cli/args/arg-ts-expect-error.js").then((r) => r.default),
  }
});

await runMain(main).catch((error: unknown) => {
  errorHandler(
    error instanceof Error ? error : new Error(String(error)),
    "An unhandled error occurred, please report it at https://github.com/reliverse/reinject",
  );
});
 