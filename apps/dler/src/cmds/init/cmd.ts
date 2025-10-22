#!/usr/bin/env bun

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { finalizePromptIO } from "@reliverse/dler-prompt";
import { $ } from "bun";
import {
  generateAllPackages,
  generateRootFiles,
  generateRootPackageJson,
} from "./impl/generators";
import { promptMonorepoConfig } from "./impl/prompts";

const writeLine = (text: string): void => {
  Bun.write(Bun.stdout, `${text}\n`);
};

const writeError = (text: string): void => {
  Bun.write(Bun.stderr, `${text}\n`);
};

const initCmd = async (): Promise<void> => {
  try {
    const config = await promptMonorepoConfig();
    await finalizePromptIO();

    writeLine("\n🔨 Generating monorepo structure...\n");

    await generateRootPackageJson(config);
    await generateRootFiles(config);
    await generateAllPackages(config);

    writeLine("\n📦 Installing dependencies...\n");

    await $`bun install`.cwd(config.rootPath);

    writeLine("\n✅ Monorepo created successfully!");
    writeLine(`\n📁 Location: ${config.rootPath}`);
    writeLine("\nTo get started:");
    writeLine(`  cd ${config.rootPath}`);
    writeLine("  bun --filter '*' dev\n");
  } catch (error) {
    writeError("\n❌ Error creating monorepo:");

    if (error instanceof Error) {
      writeError(error.message);
    } else {
      writeError(String(error));
    }

    process.exit(1);
  }
};

function getCurrentWorkingDirectory() {
  return process.cwd();
}

const initCmdArgs = defineCmdArgs({
  name: {
    type: "string",
    description: "Current working directory",
    default: getCurrentWorkingDirectory(),
  },
});

const initCmdCfg = defineCmdCfg({
  name: "init",
  description: "Initialize a new monorepo",
});

export default defineCmd(initCmd, initCmdArgs, initCmdCfg);
