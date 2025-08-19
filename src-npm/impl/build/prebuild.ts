import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";
import { glob } from "tinyglobby";
import { getCheckCmd } from "@/npm/app/cmds";
import type { DlerConfig } from "~/impl/types/mod";
import { PROJECT_ROOT } from "~/impl/utils/utils-consts";

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
        await runCmd(await getCheckCmd(), ["--no-exit", "--no-progress"]);
      },
    },
  }) as const;

async function copyFilesToTempDir(
  srcDir: string,
  tempDir: string,
  extensions: string[],
  excludeDir: string,
): Promise<void> {
  try {
    // Create temp directory if it doesn't exist
    await fs.ensureDir(tempDir);

    // Get all files in src directory
    const files = await glob("**/*", {
      cwd: srcDir,
      ignore: [`**/${excludeDir}/**`],
      onlyFiles: true,
    });

    // Filter files by extension and copy them
    for (const file of files) {
      const ext = path.extname(file).slice(1);
      if (extensions.includes(ext)) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(tempDir, file);
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(srcPath, destPath);
      }
    }
  } catch (error) {
    relinka(
      "error",
      `Error copying files to temp directory: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export async function dlerPreBuild(config: DlerConfig): Promise<void> {
  relinka("verbose", "— — — dlerPreBuild — — —");

  await executeDlerHooks(config?.hooksBeforeBuild ?? [], "pre-build");

  // Create temporary directories and copy files
  const tempDirs = {
    npm: path.join(PROJECT_ROOT, "dist-tmp", "tmp-npm"),
    jsr: path.join(PROJECT_ROOT, "dist-tmp", "tmp-jsr"),
    libs: path.join(PROJECT_ROOT, "dist-tmp", "tmp-libs"),
  };

  // Clean up previous temp directories
  for (const dir of Object.values(tempDirs)) {
    await fs.remove(dir);
  }

  // Copy files to temp directories based on registry configuration
  if (config.commonPubRegistry === "npm" || config.commonPubRegistry === "npm-jsr") {
    await copyFilesToTempDir(
      path.join(PROJECT_ROOT, config.coreEntrySrcDir),
      tempDirs.npm,
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

  if (config.commonPubRegistry === "jsr" || config.commonPubRegistry === "npm-jsr") {
    await copyFilesToTempDir(
      path.join(PROJECT_ROOT, config.coreEntrySrcDir),
      tempDirs.jsr,
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

  if (config.libsActMode === "libs-only" || config.libsActMode === "main-and-libs") {
    await copyFilesToTempDir(
      path.join(PROJECT_ROOT, config.libsDirSrc),
      tempDirs.libs,
      config.buildPreExtensions,
      config.buildTemplatesDir,
    );
  }

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
    relinka("verbose", `Running ${name}...`);
    await run();
  }
}
