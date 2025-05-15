import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import MagicString from "magic-string";
import path from "pathe";

const AGGREGATOR_START = "// AUTO-GENERATED AGGREGATOR START";
const AGGREGATOR_END = "// AUTO-GENERATED AGGREGATOR END";

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
}) {
  try {
    // Validate input directory
    const st = await fs.stat(inputDir).catch(() => null);
    if (!st?.isDirectory()) {
      relinka("error", `Error: --input is not a valid directory: ${inputDir}`);
      process.exit(1);
    }

    // Collect .ts/.js files
    const exts = [".ts", ".js"];
    if (verbose)
      relinka(
        "log",
        `Scanning directory ${inputDir} for files with extensions: ${exts.join(
          ", ",
        )}`,
      );
    const filePaths = await collectFiles(
      inputDir,
      exts,
      isRecursive,
      ignoreDirs,
      verbose,
      includeInternal,
      internalMarker,
    );
    if (!filePaths.length) {
      relinka("warn", `No matching .ts/.js files found in ${inputDir}`);
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
        ),
      ),
    );
    const allLines = aggregatorLinesArrays.flat();

    // Optionally sort lines alphabetically
    if (sortLines) {
      allLines.sort();
      if (verbose) relinka("log", "Sorted aggregator lines alphabetically.");
    }

    // Warn if outFile is inside inputDir (to avoid self-import/export)
    if (outFile.startsWith(inputDir)) {
      relinka(
        "warn",
        `Warning: The output file is inside (or overlaps with) the input directory.\nMight re-import (or re-export) itself.\n   input: ${inputDir}\n   out: ${outFile}\n`,
      );
    }

    // Build the aggregator block content
    const aggregatorContent = allLines.join("\n");
    const aggregatorBlock = `${
      headerComment ? `${headerComment}\n` : ""
    }${AGGREGATOR_START}\n${aggregatorContent}\n${AGGREGATOR_END}\n`;

    // Write aggregator file: update only the aggregator block unless overrideFile is true
    let finalText: string;
    if (overrideFile) {
      // Overwrite entire file with aggregator block
      finalText = aggregatorBlock;
      if (verbose) {
        relinka("log", "Override mode: rewriting entire file.");
      }
    } else {
      // Check if file exists
      let existingContent = "";
      try {
        existingContent = await fs.readFile(outFile, "utf8");
      } catch {
        // File does not exist, so we'll create it
        if (verbose)
          relinka("log", "Aggregator file does not exist. Creating new one.");
      }
      if (
        existingContent?.includes(AGGREGATOR_START) &&
        existingContent.includes(AGGREGATOR_END)
      ) {
        if (verbose) {
          relinka(
            "log",
            "Existing aggregator block found. Updating auto-generated section.",
          );
        }
        const s = new MagicString(existingContent);
        const startIdx = existingContent.indexOf(AGGREGATOR_START);
        const endIdx =
          existingContent.indexOf(AGGREGATOR_END) + AGGREGATOR_END.length;
        s.update(startIdx, endIdx, aggregatorBlock.trim());
        finalText = s.toString();
      } else {
        if (existingContent) {
          if (verbose)
            relinka(
              "log",
              "No aggregator block found. Appending auto-generated section.",
            );
          finalText = `${existingContent.trim()}\n\n${aggregatorBlock}`;
        } else {
          finalText = aggregatorBlock;
        }
      }
    }

    // Write final content to file
    await fs.ensureFile(outFile);
    await fs.writeFile(outFile, finalText, "utf8");

    relinka(
      "success",
      `Aggregator done: processed ${allLines.length} lines in:\n  ${outFile}`,
    );
  } catch (error) {
    relinka("error", `Aggregator failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Build a relative import/export path, removing `stripPrefix` if it is truly a prefix,
 * converting .ts -> .js, and ensuring it starts with "./" or "../".
 */
function buildPathRelative(
  filePath: string,
  inputDir: string,
  stripPrefix: string,
): string {
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

  // Ensure the path starts with "./" or "../"
  if (!resolved.startsWith("./") && !resolved.startsWith("../")) {
    resolved = `./${resolved}`;
  }

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
): Promise<string[]> {
  const found: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
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
        );
        found.push(...sub);
      }
    } else if (entry.isFile()) {
      // Skip file if its basename starts with the internal marker and internal files are not included.
      if (
        !includeInternal &&
        path.basename(fullPath).startsWith(internalMarker)
      ) {
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
      lines.push(
        `import type { ${typeNames.join(", ")} } from "${importPath}";`,
      );
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
    const code = await fs.readFile(filePath, "utf-8");
    // Regex captures lines like:
    //   export async function <NAME>
    //   export function <NAME>
    //   export const <NAME>
    //   export let <NAME>
    //   export class <NAME>
    //   export type <NAME>
    //   export interface <NAME>
    // Group 1: keyword; Group 2: exported name.
    const pattern =
      /^export\s+(?:async\s+)?(function|const|class|let|type|interface)\s+([A-Za-z0-9_$]+)/gm;
    const typeNamesSet = new Set<string>();
    const valueNamesSet = new Set<string>();

    let match: RegExpExecArray | null;
    while (true) {
      match = pattern.exec(code);
      if (match === null) break;

      const keyword = match[1];
      const name = match[2];

      if (keyword && name) {
        if (keyword === "type" || keyword === "interface") {
          typeNamesSet.add(name);
        } else {
          valueNamesSet.add(name);
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
