import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { exitCancelled, isCancel, selectPrompt } from "@reliverse/dler-prompt";

export default defineCommand({
  meta: {
    name: "config",
    description: "Manage application configuration",
    aliases: ["cfg"],
    examples: [
      "cli-app config list",
      "cli-app config set --key theme --value dark",
      "cli-app config get --key theme",
      "cli-app config reset",
    ],
  },
  args: defineArgs({
    action: {
      type: "string",
      description: "Configuration action",
      required: true,
      validate: (value: string) => {
        const validActions = ["set", "get", "list", "reset"];
        if (!validActions.includes(value)) {
          return `Action must be one of: ${validActions.join(", ")}`;
        }
        return true;
      },
    },
    key: {
      type: "string",
      description: "Configuration key",
      aliases: ["k"],
    },
    value: {
      type: "string",
      description: "Configuration value",
      aliases: ["v"],
    },
  }),
  run: async ({ args }) => {
    if (args.action === "set") {
      if (!args.key || !args.value) {
        logger.error("Both --key and --value are required for 'set' action");
        return;
      }

      logger.success(`✅ Set ${args.key} = ${args.value}`);
    } else if (args.action === "get") {
      if (!args.key) {
        logger.error("--key is required for 'get' action");
        return;
      }

      logger.log(`📋 ${args.key} = (not implemented in example)`);
    } else if (args.action === "list") {
      logger.log("📋 Configuration:\n");
      logger.log("  theme: dark");
      logger.log("  language: en");
      logger.log("  editor: vscode\n");
    } else if (args.action === "reset") {
      let theme: "light" | "dark" | "auto";
      try {
        theme = await selectPrompt({
          title: "Select default theme:",
          options: [
            { value: "light", label: "light" },
            { value: "dark", label: "dark" },
            { value: "auto", label: "auto" },
          ],
        });
      } catch (error) {
        if (isCancel(error)) {
          return exitCancelled("Operation cancelled");
        }
        logger.error(
          error instanceof Error ? error.message : "Selection failed",
        );
        return;
      }
      logger.success(`✅ Reset configuration with theme: ${theme}`);
    }
  },
});
