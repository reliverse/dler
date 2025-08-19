import { defineArgs, defineCommand } from "@reliverse/rempts";

import { dlerBuild } from "~/impl/build/impl";
import { getConfigDler } from "~/impl/config/load";
import { finalizeBuild } from "~/impl/sdk-mod";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build the project (without publishing)",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
    debugOnlyCopyNonBuildFiles: {
      type: "boolean",
      description: "Only copy non-build files to dist directories",
    },
    debugDontCopyNonBuildFiles: {
      type: "boolean",
      description:
        "Don't copy non-build files to dist directories, only build buildPreExtensions files",
    },
  }),
  async run({ args }) {
    const isDev = args.dev || process.env.DLER_DEV_MODE === "true";

    const config = await getConfigDler();

    const { timer } = await dlerBuild(
      isDev,
      config,
      args.debugOnlyCopyNonBuildFiles,
      args.debugDontCopyNonBuildFiles,
    );

    await finalizeBuild(timer, false, "build");
  },
});
