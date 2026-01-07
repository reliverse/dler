import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { relico } from "@reliverse/relico";

const envCommand = defineCommand({
  name: "env",
  description: "Manage environment variables",
  options: {
    set: option(type("string | undefined"), {
      description: "Set environment variable (format: KEY=VALUE)",
      short: "s",
    }),
    get: option(type("string | undefined"), {
      description: "Get environment variable value",
      short: "g",
    }),
    list: option(type("boolean | undefined").pipe(b => b ?? false), {
      description: "List all environment variables",
      short: "l",
    }),
    file: option(type("string | undefined").pipe(s => s ?? ".env"), {
      description: "Environment file to use",
      short: "f",
    }),
  },
  handler: async ({ flags, spinner, colors, context }) => {
    const { set, get, list, file } = flags;

    if (set) {
      const [key, ...valueParts] = set.split("=");
      const value = valueParts.join("=");

      if (!key || !value) {
        console.error(relico.red("Error: Invalid format. Use KEY=VALUE"));
        process.exit(1);
      }

      const setSpinner = spinner(`Setting ${key}...`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSpinner.succeed(`Set ${relico.cyan(key)}=${relico.green(value)}`);

      // In a real implementation, you'd write to the env file
      console.log(relico.dim(`Would write to ${file}`));
    } else if (get) {
      const getSpinner = spinner(`Getting ${get}...`);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const value = process.env[get];
      if (value) {
        getSpinner.succeed(`${relico.cyan(get)}=${relico.green(value)}`);
      } else {
        getSpinner.fail(`${relico.red(get)} not found`);
      }
    } else if (list) {
      const listSpinner = spinner("Loading environment variables...");
      await new Promise((resolve) => setTimeout(resolve, 400));
      listSpinner.succeed("Environment variables loaded");

      const envVars = Object.keys(process.env)
        .filter((key) => key.startsWith("DEV_") || key.startsWith("NODE_"))
        .sort();

      if (envVars.length === 0) {
        console.log(relico.yellow("No environment variables found"));
        return;
      }

      console.log(relico.cyan("\nEnvironment Variables:"));
      envVars.forEach((key) => {
        const value = process.env[key];
        console.log(`  ${relico.cyan(key)}=${relico.green(value || "undefined")}`);
      });
    } else {
      console.log(relico.yellow("No action specified. Use --set, --get, or --list"));
      console.log(relico.dim("\nExamples:"));
      console.log(relico.dim("  dev-server env --set API_KEY=abc123"));
      console.log(relico.dim("  dev-server env --get API_KEY"));
      console.log(relico.dim("  dev-server env --list"));
    }

    // Access plugin context
    if (context?.store && "metrics" in context.store) {
      context.store.metrics.recordEvent("env_command", {
        action: set ? "set" : get ? "get" : "list",
      });
    }
  },
});

export default envCommand;
