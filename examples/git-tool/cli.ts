#!/usr/bin/env bun
import { createCLI } from "@reliverse/rempts-core";

const cli = await createCLI();
await cli.init();
await cli.run();
