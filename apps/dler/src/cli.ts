#!/usr/bin/env bun

// 👉 bun dler <cmd> <args>
// 💡 dler === apps/dler/src/cli.ts

import { runLauncher } from "@reliverse/dler-launcher";

await runLauncher(import.meta.url);
