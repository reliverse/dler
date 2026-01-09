#!/usr/bin/env bun

import { createApp } from "@reliverse/rempts-core";

const cli = await createApp({
  entryFile: import.meta.path,
});

await cli.run();
