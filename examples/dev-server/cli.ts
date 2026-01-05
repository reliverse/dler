#!/usr/bin/env bun

import { createCLI } from "@reliverse/rempts-core";
import { configMergerPlugin } from "@reliverse/rempts-plugin-config";
import { aiAgentPlugin } from "@reliverse/rempts-plugin-ai-detect";
import { metricsPlugin } from "./plugins/metrics";

// Import commands
import startCommand from "./commands/start";
import buildCommand from "./commands/build";
import envCommand from "./commands/env";
import logsCommand from "./commands/logs";

const cli = await createCLI({
  plugins: [
    configMergerPlugin({
      sources: [".devserverrc.json", "devserver.config.json"],
    }),
    aiAgentPlugin({ verbose: true }),
    metricsPlugin,
  ] as const,
});

// Add commands
cli.command(startCommand);
cli.command(buildCommand);
cli.command(envCommand);
cli.command(logsCommand);

await cli.run();
