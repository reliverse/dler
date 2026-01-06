#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts";
import { loadConfig } from "@reliverse/rempts";

// Load configuration first
const config = await loadConfig();

const cli = await createCLI({
  name: "rempts",
  version: "0.1.0",
  description: "The Rempts CLI toolchain for developing, building, and distributing CLIs",
  ...config, // Pass config to enable automatic command loading
});

// Load commands from manifest
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
