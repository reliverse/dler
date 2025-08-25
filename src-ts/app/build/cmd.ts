import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { dlerBuild } from "~/app/build/impl";
import { getConfigDler } from "~/app/config/load";
import { finalizeBuild } from "~/app/utils/finalize";
import { prepareReliverseEnvironment } from "../config/prepare";

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
    const isDev = args.dev;

    await prepareReliverseEnvironment(isDev, "ts");
    relinka("verbose", `Running in ${isDev ? "dev" : "prod"} mode`);

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
