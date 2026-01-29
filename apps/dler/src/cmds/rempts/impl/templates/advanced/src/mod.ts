#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts";
import configCommand from "./commands/config";
import initCommand from "./commands/init";
import serveCommand from "./commands/serve";
import validateCommand from "./commands/validate";
import { loadConfig } from "./utils/config";

const cli = await createCLI({
  name: "{{name}}",
  version: "0.1.0",
  description: "{{description}}",
});

// Global setup hook
cli.before(async (context) => {
  // Set up logging based on flags (commands can define their own verbose/quiet options)
  const logger = {
    level: "info",
    log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
    error: (message: string) => console.error(`[ERROR] ${message}`),
  };

  context.set("logger", logger);
});

// Add commands
cli.command(initCommand);
cli.command(validateCommand);
cli.command(serveCommand);
cli.command(configCommand);

// Load config and run
async function run() {
  try {
    await loadConfig();
    await cli.run();
  } catch (error) {
    console.error("Failed to start CLI:", error);
    process.exit(1);
  }
}

await run();
