import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { confirmPrompt, inputPrompt, selectPrompt } from "@reliverse/rempts";

import { getConfigDler } from "~/app/config/load";

import { useAggregator } from "./agg-2";
import { findMainEntryFile } from "./agg-4";
import { isAggregationDisabled } from "./agg-5";

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
      relinka.verbose("Main package aggregation is disabled due to <dler-disable-agg> comment.");
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
          relinka.verbose(
            "Main package aggregation is disabled due to <dler-disable-agg> comment.",
          );
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
              relinka.verbose(
                `Library "${libName}" aggregation is disabled due to <dler-disable-agg> comment.`,
              );
              return;
            }
          }
        }
      }
    }
  }

  // Ask for verbose mode first to determine if we should show additional options
  const verbose = await confirmPrompt({
    title: "Enable verbose logging and additional options?",
    defaultValue: false,
  });

  // Default values for non-essential options
  let sortLines = false;
  let headerComment = "";
  let includeInternal = false;
  let internalMarker = "#";
  let overrideFile = false;
  let extensions = ".ts,.js,.mts,.cts,.mjs,.cjs";

  // Only ask non-essential questions if verbose mode is enabled
  if (verbose) {
    sortLines = await confirmPrompt({
      title: "Sort aggregated lines alphabetically?",
      defaultValue: false,
    });

    headerComment = await inputPrompt({
      title: "Add a header comment to the aggregator output (optional):",
      defaultValue: "",
    });

    includeInternal = await confirmPrompt({
      title: "Include files marked as internal (starting with #)?",
      defaultValue: false,
    });

    internalMarker = await inputPrompt({
      title: "Marker for internal files:",
      defaultValue: "#",
    });

    overrideFile = await confirmPrompt({
      title: "Override entire file instead of updating only the aggregator block?",
      defaultValue: false,
    });

    extensions = await inputPrompt({
      title: "File extensions to process (comma-separated):",
      defaultValue: ".ts,.js,.mts,.cts,.mjs,.cjs",
    });

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

    recursive = await confirmPrompt({
      title: "Do you want to recursively scan subdirectories?",
      defaultValue: recursive,
    });

    separateTypesFile = await confirmPrompt({
      title: "Do you want to create a separate file for type exports?",
      defaultValue: separateTypesFile,
    });
  }

  if (!selectedLibName || !out) {
    out = await inputPrompt({
      title: "Enter the output file",
      defaultValue: out,
    });
  }

  if (!selectedLibName || !strip) {
    strip = await inputPrompt({
      title: "Enter the path to strip from the final imports/exports",
      defaultValue: strip,
    });
  }

  if (separateTypesFile) {
    typesOut = await inputPrompt({
      title: "Enter the output file for types",
      defaultValue: out.replace(/\.(ts|js)$/, ".types.$1"),
    });
  }

  await useAggregator({
    inputDir: path.resolve(input),
    isRecursive: recursive,
    outFile: path.resolve(out),
    stripPrefix: strip ? path.resolve(strip) : "",
    useImport: imports,
    useNamed: named,
    sortLines: sortLines,
    headerComment: headerComment,
    verbose: verbose,
    includeInternal: includeInternal,
    internalMarker: internalMarker,
    overrideFile: overrideFile,
    fileExtensions: extensions.split(",").map((ext) => ext.trim()),
    separateTypesFile: separateTypesFile,
    typesOutFile: typesOut ? path.resolve(typesOut) : undefined,
  });
}
