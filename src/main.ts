import { defineCommand, errorHandler, runMain } from "@reliverse/prompts";

const main = defineCommand({
  meta: {
    name: "relidler",
    version: "1.0.6",
    description: "https://docs.reliverse.org",
  },
  subCommands: {
    cli: () => import("./cli.js").then((r) => r.default),
    init: () => import("./init.js").then((r) => r.default),
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
