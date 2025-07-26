import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
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
 * Checks if the first line of a file contains the disable aggregation comment
 */
async function isAggregationDisabled(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const firstLine = content.split("\n")[0]?.trim();
    return firstLine === "// <dler-disable-agg>";
  } catch {
    return false;
  }
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
  const isMainDisabled = mainEntryFile ? await isAggregationDisabled(mainEntryFile) : false;

  if (config?.libsList && Object.keys(config.libsList).length > 0) {
    const libEntries = await Promise.all(
      Object.entries(config.libsList).map(async ([name, lib]) => {
        const libMainFile = `${config.libsDirSrc}/${lib.libMainFile}`;
        const isLibDisabled = await isAggregationDisabled(libMainFile);

        return {
          name,
          lib,
          isDisabled: isLibDisabled,
        };
      }),
    );

    const libs = libEntries
      .filter(({ isDisabled }) => !isDisabled)
      .map(({ name, lib }) => ({
        value: name,
        label: name,
        hint: `${config.libsDirSrc}/${lib.libDirName}/${lib.libDirName}-impl`,
      }));

    // Add main package option if found and not disabled
    if (mainEntryFile && !isMainDisabled) {
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
  } else if (mainEntryFile && !isMainDisabled) {
    // If no libs but main package exists and is not disabled, offer it as the only option
    const shouldUseMain = await confirmPrompt({
      title: `Use main package for aggregation? (Found: ${mainEntryFile})`,
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
    if (selectedLibName === "main" && mainEntryFile && !isMainDisabled) {
      // Use main package configuration
      const entryDir = path.dirname(mainEntryFile);

      input = entryDir;
      out = mainEntryFile;
      strip = entryDir;
    } else if (selectedLibName === "main" && isMainDisabled) {
      // Main package is disabled, exit early
      relinka.log("Main package aggregation is disabled due to <dler-disable-agg> comment.");
      return;
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

    // Check if manually entered input corresponds to a disabled file
    if (input) {
      // Check if the input is pointing to a disabled main file (directory or file)
      if (mainEntryFile && isMainDisabled) {
        const mainEntryDir = path.dirname(mainEntryFile);
        if (
          path.resolve(input) === path.resolve(mainEntryDir) ||
          path.resolve(input) === path.resolve(mainEntryFile)
        ) {
          relinka.log("Main package aggregation is disabled due to <dler-disable-agg> comment.");
          return;
        }
      }

      // Check if the input is pointing to a disabled library
      if (config?.libsList) {
        for (const [libName, libConfig] of Object.entries(config.libsList)) {
          const libImplPath = `${config.libsDirSrc}/${libConfig.libDirName}/${libConfig.libDirName}-impl`;
          const libMainFile = `${config.libsDirSrc}/${libConfig.libMainFile}`;

          if (
            path.resolve(input) === path.resolve(libImplPath) ||
            path.resolve(input) === path.resolve(libMainFile)
          ) {
            const isLibDisabled = await isAggregationDisabled(libMainFile);
            if (isLibDisabled) {
              relinka.log(
                `Library "${libName}" aggregation is disabled due to <dler-disable-agg> comment.`,
              );
              return;
            }
          }
        }
      }
    }
  }

  imports = await confirmPrompt({
    title: "Do you want to generate imports instead of exports? (N generates exports)",
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
