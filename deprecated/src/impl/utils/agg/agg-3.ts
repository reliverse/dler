import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

/**
 * Build a relative import/export path, removing `stripPrefix` if it is truly a prefix,
 * converting .ts -> .js, and ensuring it starts with "./" or "../".
 */
export function buildPathRelative(
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
export async function collectFiles(
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
        relinka("verbose", `Skipping output file: ${fullPath}`);
      }
      continue;
    }

    if (entry.isDirectory()) {
      if (ignoreDirs.includes(entry.name)) {
        if (verbose) {
          relinka("verbose", `Skipping ignored directory: ${fullPath}`);
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
      if (
        !includeInternal &&
        path.basename(fullPath).startsWith(internalMarker)
      ) {
        if (verbose) {
          relinka("verbose", `Skipping internal file: ${fullPath}`);
        }
        continue;
      }
      if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        if (verbose) {
          relinka("verbose", `Found file: ${fullPath}`);
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
export async function generateAggregatorLines(
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
export async function getNamedExports(
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
        } else if (
          pattern.source.includes("=\\s*([A-Za-z0-9_$]+)") &&
          matchGroups[1]
        ) {
          // Handle export assignments
          valueNamesSet.add(matchGroups[1]);
        } else {
          // Handle regular exports
          const keyword = matchGroups[1];
          const name = matchGroups[2];
          if (keyword && name) {
            if (
              keyword === "type" ||
              keyword === "interface" ||
              keyword === "enum"
            ) {
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
 * For star imports, we generate an identifier from the filename, e.g.
 *  'utils-cwd.ts' -> 'utils_cwd'
 * so we do: import * as utils_cwd from "./utils-cwd";
 */
export function guessStarImportIdentifier(filePath: string): string {
  // e.g. "foo-bar.ts" => baseName is "foo-bar"
  const base = path.basename(filePath, path.extname(filePath));
  // Replace invalid chars
  let identifier = base.replace(/[^a-zA-Z0-9_$]/g, "_");
  // If it starts with digit, prefix undesrcore
  if (/^\d/.test(identifier)) {
    identifier = `_${identifier}`;
  }
  return identifier || "file";
}

/**
 * Prints usage examples based on whether dev mode or not.
 */
export function printUsage(isDev?: boolean) {
  relinka("verbose", "====================");
  relinka("verbose", "TOOLS USAGE EXAMPLES");
  relinka("verbose", "====================");
  relinka(
    "log",
    `${isDev ? "bun dev:agg" : "dler tools"} --tool agg --input <dir> --out <file> [options]`,
  );
  if (isDev) {
    relinka(
      "log",
      "bun dev:tools agg --input src/impl --out src/mod.ts --recursive --named --strip src/impl",
    );
  } else {
    relinka(
      "log",
      "dler tools --tool agg --input src/libs --out aggregator.ts --recursive --named",
    );
  }
}
