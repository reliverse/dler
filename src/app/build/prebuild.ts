import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";
import path from "node:path";

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

async function copySourceFilesToTemp(srcDir: string, config: DlerConfig): Promise<void> {
  const tempDirs = ["dist-tmp/tmp-npm", "dist-tmp/tmp-jsr", "dist-tmp/tmp-libs"];

  // Create temp directories
  for (const dir of tempDirs) {
    await fs.ensureDir(dir);
  }

  // Get all files recursively
  const files = await fs.readdir(srcDir, { withFileTypes: true, recursive: true });

  for (const file of files) {
    if (!file.isFile()) continue;

    const filePath = path.join(srcDir, file.name);
    const relativePath = path.relative(srcDir, filePath);
    const ext = path.extname(filePath).slice(1);

    // Skip files in templates directory
    if (relativePath.startsWith(config.buildTemplatesDir)) continue;

    // Skip files that are not in pre-build extensions
    if (!config.buildPreExtensions.includes(ext)) continue;

    // Copy to each temp directory
    for (const tempDir of tempDirs) {
      const destPath = path.join(tempDir, relativePath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(filePath, destPath);
    }
  }
}

export async function dlerPreBuild(config: DlerConfig): Promise<void> {
  await executeDlerHooks(config?.hooksBeforeBuild ?? [], "pre-build");

  // Copy source files to temp directories
  await copySourceFilesToTemp(config.coreEntrySrcDir, config);

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
