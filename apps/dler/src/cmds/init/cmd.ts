#!/usr/bin/env bun

import { $ } from "bun";
import { promptMonorepoConfig } from "./impl/prompts";
import { finalizePromptIO } from "@reliverse/dler-prompts";
import {
  generateAllPackages,
  generateRootFiles,
  generateRootPackageJson,
} from "./impl/generators";

const writeLine = (text: string): void => {
  Bun.write(Bun.stdout, `${text}\n`);
};

const writeError = (text: string): void => {
  Bun.write(Bun.stderr, `${text}\n`);
};

const main = async (): Promise<void> => {
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

await main();
