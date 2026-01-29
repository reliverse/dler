import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { getConfigPath, loadConfig, saveConfig } from "../utils/config";

const configCommand = defineCommand({
  name: "config",
  description: "Manage configuration",
  commands: [
    defineCommand({
      name: "get",
      description: "Get a config value",
      options: {
        key: option(type("string | undefined"), {
          description: "Config key to get",
        }),
      },
      handler: async ({ flags }) => {
        const key = flags.key;

        try {
          const config = await loadConfig();
          const value = getNestedValue(config, key);

          if (value === undefined) {
            console.log(relico.yellow(`Config key '${key}' not found`));
          } else {
            console.log(JSON.stringify(value, null, 2));
          }
        } catch (error) {
          console.error(relico.red(`Failed to load config: ${error}`));
          process.exit(1);
        }
      },
    }),

    defineCommand({
      name: "set",
      description: "Set a config value",
      options: {
        key: option(type("string | undefined"), {
          description: "Config key to set",
        }),
        value: option(type("string | undefined"), {
          description: "Value to set",
        }),
      },
      handler: async ({ flags, spinner }) => {
        const key = flags.key;
        const value = flags.value;

        const spin = spinner("Updating config...");
        spin.start();

        try {
          const config = await loadConfig();
          setNestedValue(config, key, JSON.parse(value));
          await saveConfig(config);

          spin.succeed(`Config '${key}' updated`);
        } catch (error) {
          spin.fail("Failed to update config");
          console.error(relico.red(String(error)));
          process.exit(1);
        }
      },
    }),

    defineCommand({
      name: "list",
      description: "List all config values",
      handler: async () => {
        try {
          const config = await loadConfig();
          const configPath = await getConfigPath();

          console.log(relico.bold("Configuration:"));
          console.log(relico.dim(`  File: ${configPath}`));
          console.log();
          console.log(JSON.stringify(config, null, 2));
        } catch (error) {
          console.error(relico.red(`Failed to load config: ${error}`));
          process.exit(1);
        }
      },
    }),

    defineCommand({
      name: "reset",
      description: "Reset config to defaults",
      options: {
        force: option(type("boolean", "=", false), {
          short: "f",
          description: "Skip confirmation",
        }),
      },
      handler: async ({ flags, prompt, spinner }) => {
        if (!flags.force) {
          const confirmed = await prompt.confirm(
            "This will reset all config to defaults. Continue?",
            { default: false }
          );

          if (!confirmed) {
            console.log(relico.yellow("Reset cancelled"));
            return;
          }
        }

        const spin = spinner("Resetting config...");
        spin.start();

        try {
          const { DEFAULT_CONFIG } = await import("../utils/constants.js");
          await saveConfig(DEFAULT_CONFIG);

          spin.succeed("Config reset to defaults");
        } catch (error) {
          spin.fail("Failed to reset config");
          console.error(relico.red(String(error)));
          process.exit(1);
        }
      },
    }),
  ],
});

function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

export default configCommand;
