#!/usr/bin/env bun

import { createCLI } from "@reliverse/rempts-core";
import { aiAgentPlugin } from "@reliverse/rempts-plugin-ai-detect";
import { configMergerPlugin } from "@reliverse/rempts-plugin-config";
import { metricsPlugin } from "./plugins/metrics";

const plugins = [
  configMergerPlugin({
    sources: [".devserverrc.json", "devserver.config.json"],
  }),
  aiAgentPlugin({ verbose: true }),
  metricsPlugin(),
] as const;

const cli = await createCLI({
  plugins: plugins as any,
});

await cli.init();
await cli.run();
