import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerBuild } from "~/cli.js";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build the project",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  }),
  async run({ args }) {
    await dlerBuild(args.dev);
  },
});
