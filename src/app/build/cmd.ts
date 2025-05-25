import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerBuild } from "~/app/build/impl.js";
import { ensureDlerConfig } from "~/init/init.js";

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
    await ensureDlerConfig(args.dev);
    await dlerBuild(args.dev);
  },
});
