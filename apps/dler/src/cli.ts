#!/usr/bin/env bun

import { createApp } from "@reliverse/rempts";

const cli = await createApp({
  entryFile: import.meta.path,
});

await cli.run();
