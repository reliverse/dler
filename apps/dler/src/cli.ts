#!/usr/bin/env bun
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "@reliverse/rempts-core";

// Always use the dler app's own config directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cli = await createApp({
  configDir: dirname(__dirname), // Go up one level to the dler app directory
});

// Run CLI
await cli.run();
