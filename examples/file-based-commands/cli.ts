#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";

const cli = await createCLI({
  name: "file-cli",
  version: "1.0.0",
  description: "CLI with file-based commands",
  commands: {
    directory: "./commands", // Enable file-based command loading
  },
});

await cli.run();
