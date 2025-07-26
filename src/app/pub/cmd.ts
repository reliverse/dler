import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerPub } from "~/app/pub/impl";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { ensureDlerConfig } from "~/libs/sdk/sdk-impl/config/prepare";

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
  }),
  async run({ args }) {
    const isDev = args.dev || process.env.DLER_DEV_MODE === "true";
    await ensureDlerConfig(isDev);

    const config = await getConfigDler();

    await dlerPub(isDev, config);
  },
});
