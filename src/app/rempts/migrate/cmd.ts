import fs from "@reliverse/relifso";
import { defineCommand, defineArgs, confirmPrompt } from "@reliverse/rempts";

import { commanderToRempts } from "./impl/commander";

export default defineCommand({
  args: defineArgs({
    provider: {
      type: "string",
      description: "The provider to migrate from",
      required: true,
      allowed: ["commander"],
    },
    input: {
      type: "string",
      description: "Target directory path containing the files to migrate",
      required: true,
    },
  }),
  async run({ args }) {
    const { provider, input } = args;

    const confidence = await confirmPrompt({
      title: `This is an experimental feature and probably may broke some things.\nIt will be improved in the future.\nAre you sure you want to migrate files in ${input}?`,
      defaultValue: false,
    });
    if (!confidence) {
      throw new Error("Migration cancelled");
    }

    // check if input is a directory and exists
    if (!(await fs.pathExists(input))) {
      throw new Error(`Input directory does not exist: ${input}`);
    }

    if (provider === "commander") {
      await commanderToRempts(input);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  },
});
