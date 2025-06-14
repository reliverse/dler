import path, { convertImportsAliasToRelative } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { runCmd } from "@reliverse/rempts";

import { getCheckCmd } from "~/app/cmds";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";
import { applyMagicSpells } from "~/libs/sdk/sdk-impl/magic/ms-apply";
import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";

import { directoryExists, executeDlerHooks } from "./ppb-utils";

const DIST_DIRECTORIES = ["dist-npm", "dist-jsr"] as const;
const ALIAS_TO_REPLACE = "~";

type PostBuildToolName = "dler-check";

interface PostBuildTool {
  name: string;
  run: () => Promise<void>;
}

const createPostBuildToolRunner = (): Record<PostBuildToolName, PostBuildTool> => ({
  "dler-check": {
    name: "Dler Check",
    async run() {
      const checkCmd = await getCheckCmd();
      await runCmd(checkCmd, ["--no-exit", "--no-progress"]);
    },
  },
});

async function processDistDirectory(dir: string, alias: string): Promise<void> {
  try {
    const binDir = path.join(dir, "bin");

    if (await directoryExists(binDir)) {
      await convertImportsAliasToRelative({
        targetDir: binDir,
        aliasToReplace: alias,
        pathExtFilter: "js-ts-none",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("internal", `Error processing ${dir}: ${errorMessage}`);
    throw error;
  }
}

async function processDistDirectories(): Promise<void> {
  for (const dir of DIST_DIRECTORIES) {
    relinka("log", `[processDistDirectory] ${dir}`);
    await processDistDirectory(dir, ALIAS_TO_REPLACE);
  }
}

export async function dlerPostBuild(isDev: boolean): Promise<void> {
  // Cross replacements
  await resolveAllCrossLibs();

  // Apply magic spells for end-users only
  if (isDev) {
    await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
  }

  // Convert alias to relative paths
  await processDistDirectories();

  // Execute custom post-build hooks
  const config = await getConfigDler();
  await executeDlerHooks(config?.hooksAfterBuild ?? [], "post-build");

  // Run post-build tools
  if (config?.runAfterBuild?.length) {
    const tools = createPostBuildToolRunner();

    const availableTools = config.runAfterBuild
      .filter((toolName): toolName is PostBuildToolName => toolName in tools)
      .map((toolName) => ({ toolName, ...tools[toolName] }));

    for (const { name, run } of availableTools) {
      relinka("log", `Running ${name}...`);
      await run();
    }
  }
}
