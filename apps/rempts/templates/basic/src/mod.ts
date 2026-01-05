#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";
import helloCommand from "./commands/hello";

const cli = await createCLI({
  name: "{{name}}",
  version: "0.1.0",
  description: "{{description}}",
});

cli.command(helloCommand);

await cli.run();
