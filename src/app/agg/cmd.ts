import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  selectPrompt,
  confirmPrompt,
  inputPrompt,
  defineArgs,
  defineCommand,
} from "@reliverse/rempts";

import { getConfigDler } from "~/libs/sdk/sdk-impl/config/load";

const AGGREGATOR_START = "// AUTO-GENERATED AGGREGATOR START (via `dler agg`)";
const AGGREGATOR_END = "// AUTO-GENERATED AGGREGATOR END";

export default defineCommand({
  args: defineArgs({
    imports: {
      description: "If true, produce import lines instead of export lines",
      type: "boolean",
    },
    input: {
      description: "Directory containing .ts/.js files (--input <directory>)",
      type: "string",
    },
    named: {
      description: "Parse each file for named exports (function/class/const/let)",
      type: "boolean",
      default: true,
    },
    out: {
      description: "Output aggregator file path (--out <fileName>)",
      type: "string",
    },
    recursive: {
      description:
        "Recursively scan subdirectories (default true) (false means only scan the files in the current directory and not subdirectories)",
      type: "boolean",
      default: true,
    },
    strip: {
      description: "Remove specified path prefix from final imports/exports",
      type: "string",
    },
    sort: {
      description: "Sort aggregated lines alphabetically",
      type: "boolean",
    },
    header: {
      description: "Add a header comment to the aggregator output",
      type: "string",
    },
    verbose: {
      description: "Enable verbose logging",
      type: "boolean",
    },
    includeInternal: {
      description: "Include files marked as internal (starting with #)",
      type: "boolean",
    },
    internalMarker: {
      description: "Marker for internal files (default: #)",
      type: "string",
      default: "#",
    },
    override: {
      description: "Override entire file instead of updating only the aggregator block",
      type: "boolean",
    },
    extensions: {
      description:
        "Comma-separated list of file extensions to process (default: .ts,.js,.mts,.cts,.mjs,.cjs)",
      type: "string",
      default: ".ts,.js,.mts,.cts,.mjs,.cjs",
    },
    separateTypesFile: {
      description: "Create a separate file for type exports",
      type: "boolean",
    },
    typesOut: {
      description: "Output file path for types (used when separateTypesFile is true)",
      type: "string",
    },
    nonInteractive: {
      description: "Disable interactive prompts and require all arguments to be provided via flags",
      type: "boolean",
      default: false,
    },
  }),
  async run({ args }) {
    const resolvedArgs = { ...args };

    // Handle required arguments with prompts when nonInteractive is false
    if (!args.nonInteractive) {
      if (!args.input) {
        resolvedArgs.input = await inputPrompt({
          title: "Enter input directory containing .ts/.js files:",
          defaultValue: "",
        });
      }

      if (!args.out) {
        resolvedArgs.out = await inputPrompt({
          title: "Enter output aggregator file path:",
          defaultValue: "",
        });
      }

      if (args.separateTypesFile && !args.typesOut) {
        resolvedArgs.typesOut = await inputPrompt({
          title: "Enter output file path for types:",
          defaultValue: resolvedArgs.out.replace(/\.(ts|js)$/, ".types.$1"),
        });
      }
    } else {
      // Validate required arguments in non-interactive mode
      if (!args.input) {
        throw new Error("Missing required argument: --input");
      }
      if (!args.out) {
        throw new Error("Missing required argument: --out");
      }
      if (args.separateTypesFile && !args.typesOut) {
        throw new Error(
          "Missing required argument: --typesOut (required when --separateTypesFile is true)",
        );
      }
    }

    await useAggregator({
      inputDir: path.resolve(resolvedArgs.input),
      isRecursive: !!resolvedArgs.recursive,
      outFile: path.resolve(resolvedArgs.out),
      stripPrefix: resolvedArgs.strip ? path.resolve(resolvedArgs.strip) : "",
      useImport: !!resolvedArgs.imports,
      useNamed: !!resolvedArgs.named,
      sortLines: !!resolvedArgs.sort,
      headerComment: resolvedArgs.header || "",
      verbose: !!resolvedArgs.verbose,
      includeInternal: !!resolvedArgs.includeInternal,
      internalMarker: resolvedArgs.internalMarker,
      overrideFile: !!resolvedArgs.override,
      fileExtensions: resolvedArgs.extensions.split(",").map((ext) => ext.trim()),
      separateTypesFile: !!resolvedArgs.separateTypesFile,
      typesOutFile: resolvedArgs.typesOut ? path.resolve(resolvedArgs.typesOut) : undefined,
    });
  },
});

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

/**
 * Aggregator supporting:
 * - --import or default export,
 * - star or named exports,
 * - separate "type" vs "value" for both import and export.
 *
 * Options:
 * - Option to ignore specific directories (default: node_modules, .git)
 * - Option to sort aggregated lines alphabetically.
 * - Option to add a header comment in the aggregator output.
 * - Option to enable verbose logging.
 * - Deduplicates overloaded export names.
 * - Skips files whose basenames start with an internal marker (default: "#")
 *   unless includeInternal is true or an alternative marker is provided.
 * - By default, updates only the auto-generated block in the aggregator file,
 *   leaving any other content intact. Pass `overrideFile: true` to rewrite the entire file.
 */
export async function useAggregator({
  inputDir,
  isRecursive,
  outFile,
  stripPrefix,
  useImport,
  useNamed,
  ignoreDirs = ["node_modules", ".git"],
  sortLines = false,
  headerComment = "",
  verbose = false,
  includeInternal = false,
  internalMarker = "#",
  overrideFile = false,
  fileExtensions = [".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"],
  separateTypesFile = false,
  typesOutFile,
}: {
  inputDir: string;
  isRecursive: boolean;
  outFile: string;
  stripPrefix: string;
  useImport: boolean;
  useNamed: boolean;
  ignoreDirs?: string[];
  sortLines?: boolean;
  headerComment?: string;
  verbose?: boolean;
  includeInternal?: boolean;
  internalMarker?: string;
  overrideFile?: boolean;
  fileExtensions?: string[];
  separateTypesFile?: boolean;
  typesOutFile?: string;
}) {
  try {
    // Validate input directory
    const st = await fs.stat(inputDir).catch(() => null);
    if (!st?.isDirectory()) {
      relinka("error", `Error: --input is not a valid directory: ${inputDir}`);
      process.exit(1);
    }

    // Validate output file directory exists or can be created
    const outDir = path.dirname(outFile);
    try {
      await fs.ensureDir(outDir);
    } catch (error) {
      relinka("error", `Error: Cannot create output directory: ${outDir}\n${error}`);
      process.exit(1);
    }

    // Validate types output file directory if separateTypesFile is true
    if (separateTypesFile && typesOutFile) {
      const typesOutDir = path.dirname(typesOutFile);
      try {
        await fs.ensureDir(typesOutDir);
      } catch (error) {
        relinka("error", `Error: Cannot create types output directory: ${typesOutDir}\n${error}`);
        process.exit(1);
      }
    }

    // Validate output file extension matches input extensions
    const outExt = path.extname(outFile).toLowerCase();
    if (!fileExtensions.includes(outExt)) {
      relinka(
        "warn",
        `Warning: Output file extension (${outExt}) doesn't match any of the input extensions: ${fileExtensions.join(", ")}`,
      );
    }

    // Validate strip prefix is a valid directory if provided
    if (stripPrefix) {
      const stripSt = await fs.stat(stripPrefix).catch(() => null);
      if (!stripSt?.isDirectory()) {
        relinka("error", `Error: --strip is not a valid directory: ${stripPrefix}`);
        process.exit(1);
      }
    }

    // Collect files with specified extensions
    if (verbose)
      relinka(
        "log",
        `Scanning directory ${inputDir} for files with extensions: ${fileExtensions.join(", ")}`,
      );
    const filePaths = await collectFiles(
      inputDir,
      fileExtensions,
      isRecursive,
      ignoreDirs,
      verbose,
      includeInternal,
      internalMarker,
      outFile,
    );
    if (!filePaths.length) {
      relinka(
        "warn",
        `No matching files found in ${inputDir} with extensions: ${fileExtensions.join(", ")}`,
      );
      if (!overrideFile) {
        relinka("warn", "No changes will be made to the output file.");
        return;
      }
    }

    // Generate aggregator lines concurrently with unique star-import identifiers
    const usedIdentifiers = new Set<string>();
    const aggregatorLinesArrays = await Promise.all(
      filePaths.map((fp) =>
        generateAggregatorLines(
          fp,
          inputDir,
          stripPrefix,
          useImport,
          useNamed,
          usedIdentifiers,
        ).catch((error) => {
          relinka("error", `Error processing file ${fp}: ${error}`);
          return [];
        }),
      ),
    );

    // Separate type and value lines
    const allLines = aggregatorLinesArrays.flat();
    const typeLines: string[] = [];
    const valueLines: string[] = [];

    for (const line of allLines) {
      if (line.includes("type {")) {
        typeLines.push(line);
      } else {
        valueLines.push(line);
      }
    }

    // Optionally sort lines alphabetically
    if (sortLines) {
      typeLines.sort();
      valueLines.sort();
      if (verbose) relinka("log", "Sorted aggregator lines alphabetically.");
    }

    // Build the aggregator block content
    const buildAggregatorBlock = (lines: string[]) =>
      `${headerComment ? `${headerComment}\n` : ""}${AGGREGATOR_START}\n${lines.join("\n")}\n${AGGREGATOR_END}\n`;

    if (separateTypesFile && typesOutFile) {
      // Write type exports to separate file
      const typeBlock = buildAggregatorBlock(typeLines);
      await fs.ensureFile(typesOutFile);
      await fs.writeFile(typesOutFile, typeBlock, "utf8");

      // Write value exports to main file, including type file import
      const valueBlock = buildAggregatorBlock([
        ...valueLines,
        `export * from "${path.relative(path.dirname(outFile), typesOutFile).replace(/\\/g, "/")}";`,
      ]);
      await fs.ensureFile(outFile);
      await fs.writeFile(outFile, valueBlock, "utf8");

      relinka(
        "success",
        `Aggregator done: processed ${typeLines.length} type lines in: ${typesOutFile} and ${valueLines.length} value lines in: ${outFile}`,
      );
    } else {
      // Write all lines to single file
      const aggregatorBlock = buildAggregatorBlock(allLines);
      await fs.ensureFile(outFile);
      await fs.writeFile(outFile, aggregatorBlock, "utf8");

      relinka("success", `Aggregator done: processed ${allLines.length} lines in: ${outFile}`);
    }
  } catch (error) {
    relinka("error", `Aggregator failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Build a relative import/export path, removing `stripPrefix` if it is truly a prefix,
 * converting .ts -> .js, and ensuring it starts with "./" or "../".
 */
function buildPathRelative(filePath: string, inputDir: string, stripPrefix: string): string {
  let resolved = path.resolve(filePath);
  const resolvedStrip = stripPrefix ? path.resolve(stripPrefix) : "";

  // If stripPrefix applies, remove it; otherwise, compute a relative path.
  if (resolvedStrip && resolved.startsWith(resolvedStrip)) {
    resolved = resolved.slice(resolvedStrip.length);
  } else {
    resolved = path.relative(path.resolve(inputDir), resolved);
  }

  // Remove any leading path separator(s)
  while (resolved.startsWith(path.sep)) {
    resolved = resolved.slice(1);
  }

  // Normalize backslashes to forward slashes
  resolved = resolved.replace(/\\/g, "/");

  // Convert .ts -> .js extension
  if (resolved.toLowerCase().endsWith(".ts")) {
    resolved = `${resolved.slice(0, -3)}.js`;
  }

  // Ensure the path starts with "./" or "../" only if it doesn't already
  if (!resolved.startsWith("./") && !resolved.startsWith("../")) {
    resolved = `./${resolved}`;
  }

  // Fix any double slashes in the path
  resolved = resolved.replace(/\/+/g, "/");

  return resolved;
}

/**
 * Recursively collects files with given extensions, ignoring specified directories
 * and files marked as internal.
 */
async function collectFiles(
  dir: string,
  exts: string[],
  recursive: boolean,
  ignoreDirs: string[],
  verbose: boolean,
  includeInternal: boolean,
  internalMarker: string,
  outFile?: string,
): Promise<string[]> {
  const found: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip the output file if it matches
    if (outFile && path.resolve(fullPath) === path.resolve(outFile)) {
      if (verbose) {
        relinka("log", `Skipping output file: ${fullPath}`);
      }
      continue;
    }

    if (entry.isDirectory()) {
      if (ignoreDirs.includes(entry.name)) {
        if (verbose) {
          relinka("log", `Skipping ignored directory: ${fullPath}`);
        }
        continue;
      }
      if (recursive) {
        const sub = await collectFiles(
          fullPath,
          exts,
          recursive,
          ignoreDirs,
          verbose,
          includeInternal,
          internalMarker,
          outFile,
        );
        found.push(...sub);
      }
    } else if (entry.isFile()) {
      // Skip file if its basename starts with the internal marker and internal files are not included.
      if (!includeInternal && path.basename(fullPath).startsWith(internalMarker)) {
        if (verbose) {
          relinka("log", `Skipping internal file: ${fullPath}`);
        }
        continue;
      }
      if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        if (verbose) {
          relinka("log", `Found file: ${fullPath}`);
        }
        found.push(fullPath);
      }
    }
  }
  return found;
}

/**
 * Creates aggregator lines for a single file.
 *
 * If `useNamed` is true, parses named exports and produces up to two lines:
 *   - import type { ... } / export type { ... }
 *   - import { ... } / export { ... }
 *
 * If `useNamed` is false, produces a single star import or export.
 *
 * @param usedIdentifiers A set to track and ensure unique identifiers for star imports.
 */
async function generateAggregatorLines(
  filePath: string,
  inputDir: string,
  stripPrefix: string,
  useImport: boolean,
  useNamed: boolean,
  usedIdentifiers?: Set<string>,
): Promise<string[]> {
  const importPath = buildPathRelative(filePath, inputDir, stripPrefix);

  // Star import/export approach when not using named exports
  if (!useNamed) {
    if (useImport) {
      let ident = guessStarImportIdentifier(filePath);
      if (usedIdentifiers) {
        let uniqueIdent = ident;
        let counter = 1;
        while (usedIdentifiers.has(uniqueIdent)) {
          uniqueIdent = `${ident}_${counter}`;
          counter++;
        }
        usedIdentifiers.add(uniqueIdent);
        ident = uniqueIdent;
      }
      return [`import * as ${ident} from "${importPath}";`];
    }
    return [`export * from "${importPath}";`];
  }

  // For named exports, parse the file to extract export names.
  const { typeNames, valueNames } = await getNamedExports(filePath);
  if (!typeNames.length && !valueNames.length) {
    return [];
  }

  if (useImport) {
    const lines: string[] = [];
    if (typeNames.length > 0) {
      lines.push(`import type { ${typeNames.join(", ")} } from "${importPath}";`);
    }
    if (valueNames.length > 0) {
      lines.push(`import { ${valueNames.join(", ")} } from "${importPath}";`);
    }
    return lines;
  }

  // For exports
  const lines: string[] = [];
  if (typeNames.length > 0) {
    lines.push(`export type { ${typeNames.join(", ")} } from "${importPath}";`);
  }
  if (valueNames.length > 0) {
    lines.push(`export { ${valueNames.join(", ")} } from "${importPath}";`);
  }
  return lines;
}

/**
 * Parses a file to extract named exports, separating type exports from value exports.
 * Deduplicates export names (to handle overloads).
 */
async function getNamedExports(
  filePath: string,
): Promise<{ typeNames: string[]; valueNames: string[] }> {
  try {
    const code = await fs.readFile(filePath, "utf8");
    const typeNamesSet = new Set<string>();
    const valueNamesSet = new Set<string>();

    // Match various export patterns:
    // 1. Regular exports: export const/let/var/function/class/interface/type/enum
    // 2. Default exports: export default class/function/const/interface
    // 3. Named exports: export { name, name2 as alias }
    // 4. Re-exports: export { name } from './other'
    // 5. Export assignments: export = name
    const patterns = [
      // Regular exports and default exports
      /^export\s+(?:default\s+)?(?:async\s+)?(function|const|class|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm,
      // Named exports and re-exports
      /^export\s*{([^}]+)}(?:\s+from\s+['"][^'"]+['"])?/gm,
      // Export assignments
      /^export\s*=\s*([A-Za-z0-9_$]+)/gm,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while (true) {
        match = pattern.exec(code);
        if (!match) break;

        const matchGroups = match as RegExpExecArray & Record<number, string>;
        if (pattern.source.includes("{([^}]+)}") && matchGroups[1]) {
          // Handle named exports/re-exports
          const exports = (matchGroups[1] ?? "").split(",").map(
            (e) =>
              e
                ?.trim()
                ?.split(/\s+as\s+/)?.[0]
                ?.trim() ?? "",
          );
          for (const exp of exports) {
            // Skip 'type' keyword in named exports
            const name = exp.replace(/^type\s+/, "");
            if (exp.startsWith("type ")) {
              typeNamesSet.add(name);
            } else {
              valueNamesSet.add(name);
            }
          }
        } else if (pattern.source.includes("=\\s*([A-Za-z0-9_$]+)") && matchGroups[1]) {
          // Handle export assignments
          valueNamesSet.add(matchGroups[1]);
        } else {
          // Handle regular exports
          const keyword = matchGroups[1];
          const name = matchGroups[2];
          if (keyword && name) {
            if (keyword === "type" || keyword === "interface" || keyword === "enum") {
              typeNamesSet.add(name);
            } else {
              valueNamesSet.add(name);
            }
          }
        }
      }
    }

    return {
      typeNames: Array.from(typeNamesSet),
      valueNames: Array.from(valueNamesSet),
    };
  } catch (error) {
    relinka("error", `Error reading file ${filePath}: ${error}`);
    return { typeNames: [], valueNames: [] };
  }
}

/**
 * Generates a valid identifier for star imports based on the file name.
 */
function guessStarImportIdentifier(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  let identifier = base.replace(/[^a-zA-Z0-9_$]/g, "_");
  if (/^\d/.test(identifier)) {
    identifier = `_${identifier}`;
  }
  return identifier || "file";
}

/**
 * Prints usage examples based on whether dev mode or not.
 */
export function printUsage(isDev?: boolean) {
  relinka("log", "====================");
  relinka("log", "TOOLS USAGE EXAMPLES");
  relinka("log", "====================");
  relinka(
    "log",
    `${isDev ? "bun dev:agg" : "dler tools"} --tool agg --input <dir> --out <file> [options]`,
  );
  if (isDev) {
    relinka(
      "log",
      "bun dev:tools agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-mod.ts --recursive --named --strip src/libs/sdk",
    );
  } else {
    relinka(
      "log",
      "dler tools --tool agg --input src/libs --out aggregator.ts --recursive --named",
    );
  }
}
