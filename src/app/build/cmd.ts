import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerBuild } from "~/app/build/impl";
import { ensureDlerConfig } from "~/libs/sdk/sdk-impl/config/init";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";

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

    const config = await getConfigDler();

    await dlerBuild(args.dev, config);
  },
});
