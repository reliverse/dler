#!/usr/bin/env bun

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { $ } from "bun";
import {
  generateAllPackages,
  generateRootFiles,
  generateRootPackageJson,
} from "./impl/generators";
import { promptMonorepoConfig } from "./impl/prompts";

const initCmd = async (): Promise<void> => {
  try {
    const config = await promptMonorepoConfig();

    logger.info("\n🔨 Generating monorepo structure...\n");

    await generateRootPackageJson(config);
    await generateRootFiles(config);
    await generateAllPackages(config);

    logger.info("\n📦 Installing dependencies...\n");

    await $`bun install`.cwd(config.rootPath);

    logger.success("\n✅ Monorepo created successfully!");
    logger.success(`\n📁 Location: ${config.rootPath}`);
    logger.success("\nTo get started:");
    logger.log(`  cd ${config.rootPath}`);
    logger.log("  bun --filter '*' dev\n");
  } catch (error) {
    logger.error("\n❌ Error creating monorepo:");

    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
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
