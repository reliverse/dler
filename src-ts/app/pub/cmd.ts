import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { getConfigDler } from "~/app/config/load";
import { ensureReliverseConfig, prepareReliverseEnvironment } from "~/app/config/prepare";
import { dlerPub } from "~/app/pub/impl";
import { createPerfTimer } from "../utils/utils-perf";

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
    const isDev = args.dev;

    await prepareReliverseEnvironment(isDev, "ts");
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

    await ensureReliverseConfig(isDev, "ts");

    const config = await getConfigDler();

    const timer = createPerfTimer();

    await dlerPub(timer, isDev, config);
  },
});
