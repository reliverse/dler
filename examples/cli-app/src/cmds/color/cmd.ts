import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";

export default defineCommand({
  meta: {
    name: "color",
    description: "Demonstrate allowed values for arguments",
    examples: [
      "cli-app color --color red",
      "cli-app color --color green --brightness 5",
      "cli-app color --color blue --brightness 2 --enabled",
    ],
  },
  args: defineArgs({
    color: {
      type: "string",
      description: "What color you like?",
      required: true,
      allowed: ["red", "green", "blue"],
    },
    brightness: {
      type: "number",
      description: "Brightness level",
      allowed: [1, 2, 3, 4, 5],
      default: 3,
    },
    enabled: {
      type: "boolean",
      description: "Enable color mode",
      allowed: [true],
      default: true,
    },
  }),
  run: async ({ args }) => {
    logger.log(`You selected color: ${args.color}`);
    if (args.brightness !== undefined) {
      logger.log(`Brightness level: ${args.brightness}`);
    }
    if (args.enabled !== undefined) {
      logger.log(`Enabled: ${args.enabled}`);
    }
  },
});
