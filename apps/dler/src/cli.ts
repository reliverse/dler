#!/usr/bin/env bun

// apps/dler/src/cli.ts

import { runLauncher } from "@reliverse/dler-launcher";

await runLauncher(import.meta.url);
