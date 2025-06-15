import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { getCheckCmd } from "~/app/cmds";

import { executeCommand, executeDlerHooks, isCommandAvailable } from "./ppb-utils";

type ToolName = "tsc" | "eslint" | "biome" | "knip" | "dler-check";

const createToolRunner = () =>
  ({
    tsc: {
      name: "TypeScript compiler",
      run: () => executeCommand("tsc --noEmit"),
    },
    eslint: {
      name: "ESLint",
      run: () => executeCommand("eslint --cache --fix ."),
    },
    biome: {
      name: "Biome",
      run: () => executeCommand("biome check --fix --unsafe ."),
    },
    knip: {
      name: "Knip",
      run: () => executeCommand("knip"),
    },
    "dler-check": {
      name: "Dler Check",
      async run() {
        const checkCmd = await getCheckCmd();
        await runCmd(checkCmd, ["--no-exit", "--no-progress"]);
      },
    },
  }) as const;

export async function dlerPreBuild(config: DlerConfig): Promise<void> {
  await executeDlerHooks(config?.hooksBeforeBuild ?? [], "pre-build");

  if (!config?.runBeforeBuild?.length) return;

  const tools = createToolRunner();

  const availableTools = await Promise.all(
    config.runBeforeBuild.map(async (toolName) => {
      const tool = tools[toolName as ToolName];
      if (!tool) return null;

      // For dler-check, we don't need to check availability
      if (toolName === "dler-check") {
        return { toolName, ...tool };
      }

      // Check if command is available either in package.json or globally
      const isAvailable = await isCommandAvailable(toolName);
      return isAvailable ? { toolName, ...tool } : null;
    }),
  );

  const commandsToRun = availableTools.filter(Boolean);

  for (const { name, run } of commandsToRun) {
    relinka("log", `Running ${name}...`);
    await run();
  }
}
