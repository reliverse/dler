import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { selectPrompt, runCmd, confirmPrompt, inputPrompt } from "@reliverse/rempts";

import { getAggCmd } from "~/app/cmds";
import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";

/**
 * Checks if a file exists at the given path
 */
async function fileExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

/**
 * Finds the main package based on dler configuration with fallbacks
 */
async function findMainEntryFile(config: any): Promise<string | null> {
  const { coreEntryFile, coreEntrySrcDir } = config;

  // Check the configured entry file first
  if (coreEntryFile && coreEntrySrcDir) {
    const configuredPath = path.join(coreEntrySrcDir, coreEntryFile);
    if (await fileExists(configuredPath)) {
      return configuredPath;
    }
  }

  // Fallback to common entry file patterns
  const fallbackPatterns = [
    path.join(coreEntrySrcDir || "src", "mod.ts"),
    path.join(coreEntrySrcDir || "src", "index.ts"),
    path.join(coreEntrySrcDir || "src", "mod.js"),
    path.join(coreEntrySrcDir || "src", "index.js"),
  ];

  for (const pattern of fallbackPatterns) {
    if (await fileExists(pattern)) {
      return pattern;
    }
  }

  return null;
}

export async function promptAggCommand() {
  // Try to load config and check for libs
  const config = await getConfigDler();
  let selectedLibName: string | null = null;

  // Check for main package
  const mainEntryFile = await findMainEntryFile(config);

  if (config?.libsList && Object.keys(config.libsList).length > 0) {
    const libs = Object.entries(config.libsList).map(([name, lib]) => ({
      value: name,
      label: name,
      hint: `${config.libsDirSrc}/${lib.libDirName}/${lib.libDirName}-impl`,
    }));

    // Add main package option if found
    if (mainEntryFile) {
      libs.unshift({
        value: "main",
        label: "Main package",
        hint: mainEntryFile,
      });
    }

    // Add "Skip" option
    libs.push({ value: "", label: "Skip selection", hint: "" });

    selectedLibName = await selectPrompt({
      title: "Select a package to aggregate or skip",
      options: libs,
    });
  } else if (mainEntryFile) {
    // If no libs but main package exists, offer it as the only option
    const shouldUseMain = await confirmPrompt({
      title: "Use main package for aggregation?",
      content: `Found: ${mainEntryFile}`,
      defaultValue: true,
    });

    if (shouldUseMain) {
      selectedLibName = "main";
    }
  }

  // If lib selected, use its config
  let imports = false;
  let input = "";
  let named = true;
  let out = "";
  let recursive = true;
  let strip = "";
  let separateTypesFile = false;
  let typesOut = "";

  if (selectedLibName && selectedLibName !== "") {
    if (selectedLibName === "main" && mainEntryFile) {
      // Use main package configuration
      const entryDir = path.dirname(mainEntryFile);

      input = entryDir;
      out = mainEntryFile;
      strip = entryDir;
    } else {
      // Use library configuration
      const libConfig = config?.libsList?.[selectedLibName];
      if (config && libConfig) {
        input = `${config.libsDirSrc}/${libConfig.libDirName}/${libConfig.libDirName}-impl`;
        out = `${config.libsDirSrc}/${libConfig.libMainFile}`;
        strip = `${config.libsDirSrc}/${libConfig.libDirName}`;
      }
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

  separateTypesFile = await confirmPrompt({
    title: "Do you want to create a separate file for type exports?",
    defaultValue: separateTypesFile,
  });

  if (separateTypesFile) {
    typesOut = await inputPrompt({
      title: "Enter the output file for types",
      defaultValue: out.replace(/\.(ts|js)$/, ".types.$1"),
    });
  }

  await runCmd(await getAggCmd(), [
    `--imports=${imports}`,
    `--input=${input}`,
    `--named=${named}`,
    `--out=${out}`,
    `--recursive=${recursive}`,
    `--strip=${strip}`,
    `--separateTypesFile=${separateTypesFile}`,
    ...(separateTypesFile ? [`--typesOut=${typesOut}`] : []),
  ]);
}
