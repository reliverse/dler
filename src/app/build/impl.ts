import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";
import { $ } from "bun";
import { execa } from "execa";
import { lookpath } from "lookpath";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

import { getCheckCmd } from "~/app/cmds";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { library_buildFlow } from "~/libs/sdk/sdk-impl/library-flow";
import { regular_buildFlow } from "~/libs/sdk/sdk-impl/regular-flow";
import { finalizeBuild } from "~/libs/sdk/sdk-impl/utils/finalize";
import { removeDistFolders } from "~/libs/sdk/sdk-impl/utils/utils-clean";
import { PROJECT_ROOT } from "~/libs/sdk/sdk-impl/utils/utils-consts";
import { handleDlerError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";
import { createPerfTimer } from "~/libs/sdk/sdk-impl/utils/utils-perf";

type ToolName = "tsc" | "eslint" | "biome" | "knip" | "dler-check";
type AfterBuildToolName = "dler-check";

interface ToolConfig {
  name: string;
  args?: string[];
  run?: () => Promise<void>;
}

type ToolInfo = ToolConfig & {
  tool: ToolName;
  available: boolean;
};

type AfterBuildToolInfo = ToolConfig & {
  tool: AfterBuildToolName;
  available: boolean;
};

// ==========================
// dler build
// ==========================

/**
 * Checks if a command is available in the system
 * Uses lookpath for efficient cross-platform command detection
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  const path = await lookpath(command);
  return path !== undefined;
}

/**
 * Executes a shell command using the appropriate method based on the environment
 */
async function executeCommand(command: string, args: string[] = []): Promise<void> {
  if (process.versions.bun) {
    await $`${command} ${args.join(" ")}`;
  } else {
    await execa(command, args);
  }
}

/**
 * Main entry point for the dler build process.
 * Handles building for both main project and libraries.
 * @see `src/app/pub/impl.ts` for pub main function implementation.
 */
export async function dlerBuild(isDev: boolean, config?: DlerConfig) {
  // Create a performance timer
  const timer = createPerfTimer();

  let effectiveConfig = config;

  try {
    if (!effectiveConfig) {
      // Load config with defaults and user overrides
      // This config load is a single source of truth
      effectiveConfig = await getConfigDler();
    }

    // Run pre-build tools if configured
    if (effectiveConfig?.runBeforeBuild?.length > 0) {
      const tools: Record<ToolName, ToolConfig> = {
        tsc: { name: "TypeScript compiler", args: ["--noEmit"] },
        eslint: { name: "ESLint", args: ["--cache", "--fix", "."] },
        biome: { name: "Biome", args: ["check", "--fix", "--unsafe", "."] },
        knip: { name: "Knip" },
        "dler-check": {
          name: "Dler Check",
          async run() {
            const checkCmd = await getCheckCmd();
            await runCmd(checkCmd, ["--no-exit", "--no-progress"]);
          },
        },
      };

      const availableTools = await Promise.all(
        effectiveConfig.runBeforeBuild.map(async (tool) => {
          const toolConfig = tools[tool as ToolName];
          if (!toolConfig) return null;
          return {
            tool: tool as ToolName,
            ...toolConfig,
            available: (tool as ToolName) === "dler-check" ? true : await isCommandAvailable(tool),
          };
        }),
      );

      const commandsToRun = availableTools.filter(
        (tool): tool is ToolInfo => tool?.available ?? false,
      );

      for (const { name, args, run } of commandsToRun) {
        relinka("log", `Running ${name}...`);
        if (run) {
          await run();
        } else {
          await executeCommand(name.toLowerCase(), args ?? []);
        }
      }
    }

    // Clean up previous run artifacts
    if (effectiveConfig.logsFreshFile) {
      await fs.remove(path.join(PROJECT_ROOT, effectiveConfig.logsFileName));
    }
    await removeDistFolders(
      effectiveConfig.distNpmDirName,
      effectiveConfig.distJsrDirName,
      effectiveConfig.libsDirDist,
      effectiveConfig.libsList,
    );

    // Build step
    await regular_buildFlow(timer, isDev, effectiveConfig);
    await library_buildFlow(timer, isDev, effectiveConfig);

    // Run post-build tools if configured
    if (effectiveConfig?.runAfterBuild?.length > 0) {
      const tools: Record<AfterBuildToolName, ToolConfig> = {
        "dler-check": {
          name: "Dler Check",
          async run() {
            const checkCmd = await getCheckCmd();
            await runCmd(checkCmd, ["--no-exit", "--no-progress"]);
          },
        },
      };

      const availableTools = await Promise.all(
        effectiveConfig.runAfterBuild.map(async (tool) => {
          const toolConfig = tools[tool];
          if (!toolConfig) return null;
          return {
            tool,
            ...toolConfig,
            available: true, // dler-check is always available
          };
        }),
      );

      const commandsToRun = availableTools.filter(
        (tool): tool is AfterBuildToolInfo => tool?.available ?? false,
      );

      for (const { name, run } of commandsToRun) {
        relinka("log", `Running ${name}...`);
        if (run) {
          await run();
        }
      }
    }

    // Finalize build
    await finalizeBuild(timer, effectiveConfig.commonPubPause);

    return { timer, effectiveConfig };
  } catch (error) {
    handleDlerError(error);
  }
}
