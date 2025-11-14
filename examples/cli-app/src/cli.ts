#!/usr/bin/env bun

import { runLauncher } from "@reliverse/dler-launcher";

await runLauncher(import.meta.url, {
  cmdsDir: "./cmds",
  verbose: false,
});
