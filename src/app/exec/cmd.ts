import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, inputPrompt } from "@reliverse/rempts";
import { glob } from "tinyglobby";
import pMap from "p-map";

export default defineCommand({
  meta: {
    name: "exec",
    version: "1.1.0",
    description:
      "Execute a command. Usage example: `dler exec --target 'bun run build'`",
  },
  args: defineArgs({
    target: {
      type: "string",
      description: "Command to execute.",
      required: true,
    },
  }),
  async run({ args }) {},
});
