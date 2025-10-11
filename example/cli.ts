import { defineCommand, runMain } from "@reliverse/rempts";

await runMain(
  defineCommand({
    // empty object activates file-based
    // commands in the example/app directory
  }),
);
