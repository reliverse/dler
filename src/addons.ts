import {
  selectPrompt,
  runCmd,
  confirmPrompt,
  inputPrompt,
} from "@reliverse/rempts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { cmdAgg } from "./app/cmds.js";

type LibConfig = {
  libDeclarations: boolean;
  libDescription: string;
  libDirName: string;
  libMainFile: string;
  libPkgKeepDeps: boolean;
  libTranspileMinify: boolean;
  libPubPause: boolean;
};

type DlerConfig = {
  libsDirSrc: string;
  libsList: Record<string, LibConfig>;
};

// Helper to load config if exists
async function loadConfig(): Promise<DlerConfig | null> {
  const configPath = resolve(".config/dler.ts");
  if (!existsSync(configPath)) return null;
  return (await import(configPath)).default;
}

export async function promptAggCommand() {
  // Try to load config and check for libs
  const config = await loadConfig();
  let selectedLibName: string | null = null;

  if (config?.libsList && Object.keys(config.libsList).length > 0) {
    const libs = Object.entries(config.libsList).map(([name, lib]) => ({
      value: name,
      label: name,
      hint: `${config.libsDirSrc}/${lib.libDirName}/${lib.libDirName}-impl`,
    }));

    // Add "Skip" option
    libs.push({ value: "", label: "Skip library selection", hint: "" });

    selectedLibName = await selectPrompt({
      title: "Select a library to aggregate or skip",
      options: libs,
    });
  }

  // If lib selected, use its config
  let imports = false;
  let input = "";
  let named = true;
  let out = "";
  let recursive = true;
  let strip = "";

  if (selectedLibName && selectedLibName !== "") {
    const libConfig = config?.libsList?.[selectedLibName];
    if (config && libConfig) {
      input = `${config.libsDirSrc}/${libConfig.libDirName}/${libConfig.libDirName}-impl`;
      out = `${config.libsDirSrc}/${libConfig.libMainFile}`;
      strip = `${config.libsDirSrc}/${libConfig.libDirName}`;
    }
  }

  // Only prompt for values not set by lib config
  if (!selectedLibName || !input) {
    input = await inputPrompt({
      title: "Enter the input directory",
      defaultValue: input,
    });
  }

  imports = await confirmPrompt({
    title: "Do you want to generate imports instead of exports?",
    content: "(N generates exports)",
    defaultValue: imports,
  });

  named = await confirmPrompt({
    title: imports
      ? "Do you want to generate named imports?"
      : "Do you want to generate named exports?",
    defaultValue: named,
  });

  if (!selectedLibName || !out) {
    out = await inputPrompt({
      title: "Enter the output file",
      defaultValue: out,
    });
  }

  recursive = await confirmPrompt({
    title: "Do you want to recursively scan subdirectories?",
    defaultValue: recursive,
  });

  if (!selectedLibName || !strip) {
    strip = await inputPrompt({
      title: "Enter the path to strip from the final imports/exports",
      defaultValue: strip,
    });
  }

  await runCmd(await cmdAgg(), [
    `--imports=${imports}`,
    `--input=${input}`,
    `--named=${named}`,
    `--out=${out}`,
    `--recursive=${recursive}`,
    `--strip=${strip}`,
  ]);
}
