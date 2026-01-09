#!/usr/bin/env bun
import { analyzeCommand, processCommand } from "@{{name}}/core";
import { logger } from "@{{name}}/utils";
import { createCLI } from "@reliverse/rempts-core";

const cli = await createCLI({
  name: "{{name}}",
  version: "0.1.0",
  description: "{{description}}",
});

// Add commands
cli.command(processCommand);
cli.command(analyzeCommand);

// Run CLI
try {
  await cli.run();
} catch (error) {
  logger.error("CLI failed:", error);
  process.exit(1);
}
