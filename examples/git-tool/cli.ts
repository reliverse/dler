#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts";

const cli = await createCLI();

await cli.load({
  branch: () => import("./commands/branch"),
  pr: () => import("./commands/pr"),
  sync: () => import("./commands/sync"),
  status: () => import("./commands/status"),
});

await cli.run();
