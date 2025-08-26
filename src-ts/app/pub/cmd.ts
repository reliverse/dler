/* !! DEPRECATED: This file is deprecated and will be removed in the future. Use `rse publish` instead. */

import { defineArgs, defineCommand } from "@reliverse/rempts";
import { getConfigDler } from "../config/load";
import { commonEndActions, commonStartActions } from "../utils/common";
import { getCurrentWorkingDirectory } from "../utils/terminalHelpers";
import { createPerfTimer } from "../utils/utils-perf";
import { dlerPub } from "./impl";

export default defineCommand({
  meta: {
    name: "publish",
    description: "",
  },
  args: defineArgs({
    // Common args
    ci: {
      type: "boolean",
      description: "ci",
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    cwd: {
      type: "string",
      description: "cwd",
      default: getCurrentWorkingDirectory(),
    },
    dev: {
      type: "boolean",
      description: "dev",
    },
    // Command specific args
    // ...
  }),
  run: async ({ args }) => {
    const { ci, cwd, dev } = args;
    const isCI = Boolean(ci);
    const isDev = Boolean(dev);
    const strCwd = String(cwd);
    await commonStartActions({ isCI, isDev, strCwd });

    const timer = createPerfTimer();
    const config = await getConfigDler();
    await dlerPub(timer, isDev, config);

    await commonEndActions();
  },
});
