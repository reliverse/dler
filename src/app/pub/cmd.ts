import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerPub } from "~/app/pub/impl";
import { ensureDlerConfig } from "~/libs/sdk/sdk-impl/config/init";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";

export default defineCommand({
  meta: {
    name: "pub",
    description: "Build and publish the project",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
    preventPub: {
      type: "boolean",
      description: "Do not publish the project (command will act the same as `dler build` command)",
    },
  }),
  async run({ args }) {
    await ensureDlerConfig(args.dev);

    const config = await getConfigDler();

    await dlerPub(args.dev, config, args.preventPub);
  },
});
