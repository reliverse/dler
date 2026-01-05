#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";
import { loadConfig } from "@reliverse/rempts-core";

const cli = await createCLI({
  name: "rempts",
  version: "0.1.0",
  description: "The Rempts CLI toolchain for developing, building, and distributing CLIs",
});

// Load configuration
const config = await loadConfig();

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
