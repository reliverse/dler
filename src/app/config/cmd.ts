import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import { ensureConfigMod } from "~/libs/sdk/sdk-impl/config/core";

export default defineCommand({
  meta: {
    name: "config",
    description: "Manage project-level and device-global configurations",
  },
  args: defineArgs({
    mode: {
      type: "string",
      description: "Config mode: copy-remote, copy-internal",
      default: "copy-remote",
    },
    tool: {
      type: "string",
      description: "Tool name (e.g., dler, rse)",
      default: "dler",
    },
    update: {
      type: "boolean",
      description: "Force update existing configuration",
      default: false,
    },
  }),
  run: async ({ args }) => {
    const { mode, tool, update } = args;

    try {
      await ensureConfigMod({
        tool,
        mode,
        forceUpdate: update,
      });

      relinka("success", `Configuration for ${tool} has been ${update ? "updated" : "created"}`);
    } catch (error) {
      relinka(
        "error",
        `Failed to manage config: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  },
});
