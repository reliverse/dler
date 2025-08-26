/* !! DEPRECATED: This file is deprecated and will be removed in the future. Use `rse build` instead. */

import { defineArgs, defineCommand } from "@reliverse/rempts";
import { getConfigDler } from "../config/load";
import { commonEndActions, commonStartActions } from "../utils/common";
import { finalizeBuild } from "../utils/finalize";
import { getCurrentWorkingDirectory } from "../utils/terminalHelpers";
import { createPerfTimer } from "../utils/utils-perf";
import { dlerBuild } from "./impl";

export default defineCommand({
  meta: {
    name: "build",
    description: "",
  },
  args: defineArgs({
    // Common args
    ci: {
      type: "boolean",
      description: "ci",
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    dev: {
      type: "boolean",
      description: "dev",
    },
    cwd: {
      type: "string",
      description: "cwd",
      default: getCurrentWorkingDirectory(),
    },
    // Command specific args
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
  run: async ({ args }) => {
    const { ci, cwd, dev, debugOnlyCopyNonBuildFiles, debugDontCopyNonBuildFiles } = args;
    const isCI = Boolean(ci);
    const isDev = Boolean(dev);
    const strCwd = String(cwd);
    const isDebugOnlyCopyNonBuildFiles = Boolean(debugOnlyCopyNonBuildFiles);
    const isDebugDontCopyNonBuildFiles = Boolean(debugDontCopyNonBuildFiles);
    await commonStartActions({ isCI, isDev, strCwd });

    const timer = createPerfTimer();
    const config = await getConfigDler();
    await dlerBuild(
      timer,
      isDev,
      config,
      isDebugOnlyCopyNonBuildFiles,
      isDebugDontCopyNonBuildFiles,
    );
    await finalizeBuild(timer, false, "build");

    await commonEndActions();
  },
});
