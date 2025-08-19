import { defineArgs, defineCommand } from "@reliverse/rempts";
import { getConfigDler } from "~/impl/config/load";
import { ensureDlerConfig } from "~/impl/config/prepare";
import { dlerPub } from "~/impl/pub/impl";

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
