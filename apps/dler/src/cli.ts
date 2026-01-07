#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";
import { loadConfig } from "@reliverse/rempts-core";

// Load configuration first
const config = await loadConfig();

const cli = await createCLI({
  name: "rempts",
  version: "0.1.0",
  description: "The Rempts CLI toolchain for developing, building, and distributing CLIs",
  ...config, // Pass config to enable automatic command loading
});

// Load commands from directory (including app directory)
await cli.init();

// Load commands from manifest (these will take priority over file-based commands)
await cli.load({
  dev: () => import("./commands/dev.js"),
  build: () => import("./commands/build.js"),
  generate: () => import("./commands/generate.js"),
  test: () => import("./commands/test.js"),
  release: () => import("./commands/release.js"),
  init: () => import("./commands/init.js"),
});

// Run CLI
await cli.run();
