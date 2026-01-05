#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";
import initCommand from "./commands/init";
import validateCommand from "./commands/validate";
import serveCommand from "./commands/serve";
import configCommand from "./commands/config";
import { loadConfig } from "./utils/config";

const cli = await createCLI({
  name: "{{name}}",
  version: "0.1.0",
  description: "{{description}}",
});

// Global options
cli.option("verbose", {
  type: "boolean",
  description: "Enable verbose output",
});

cli.option("quiet", {
  type: "boolean",
  description: "Suppress output",
});

// Add commands
cli.command(initCommand);
cli.command(validateCommand);
cli.command(serveCommand);
cli.command(configCommand);

// Load config and run
async function run() {
  try {
    const config = await loadConfig();
    // Store config in global context if needed
    await cli.run();
  } catch (error) {
    console.error("Failed to start CLI:", error);
    process.exit(1);
  }
}

await run();
