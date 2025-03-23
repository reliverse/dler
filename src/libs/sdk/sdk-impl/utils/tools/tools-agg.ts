import fs from "fs-extra";
import path from "pathe";

/**
 * Aggregator supporting:
 * - --import or default export,
 * - star or named,
 * - separate "type" vs "value" for both import and export
 */
export async function useAggregator({
  inputDir,
  isRecursive,
  outFile,
  stripPrefix,
  useImport,
  useNamed,
}: {
  inputDir: string;
  isRecursive: boolean;
  outFile: string;
  stripPrefix: string;
  useImport: boolean;
  useNamed: boolean;
}) {
  // Validate input
  const st = await fs.stat(inputDir).catch(() => null);
  if (!st?.isDirectory()) {
    console.error(`Error: --input is not a valid directory: ${inputDir}`);
    process.exit(1);
  }

  // Collect .ts/.js files
  const exts = [".ts", ".js"];
  const filePaths = await collectFiles(inputDir, exts, isRecursive);
  if (!filePaths.length) {
    console.warn(`No matching .ts/.js files found in ${inputDir}`);
  }

  // Build aggregator lines
  const allLines: string[] = [];
  for (const fp of filePaths) {
    const lines = await generateAggregatorLines(
      fp,
      inputDir,
      stripPrefix,
      useImport,
      useNamed,
    );
    allLines.push(...lines);
  }

  // Warn if outFile is inside inputDir
  if (outFile.startsWith(inputDir)) {
    console.warn(
      `Warning: The output file is inside (or overlaps with) the input directory.\nMight re-import (or re-export) itself.\n   input: ${inputDir}\n   out: ${outFile}\n`,
    );
  }

  // Write aggregator
  const finalText = `${allLines.join("\n")}\n`;
  await fs.ensureFile(outFile);
  await fs.writeFile(outFile, finalText, "utf8");

  console.log(
    `\nAggregator done: wrote ${allLines.length} lines to:\n  ${outFile}`,
  );
}

/**
 * Build a relative import/export path, removing `stripPrefix` if it is truly a prefix,
 * converting .ts -> .js, and ensuring it starts with "./" or "../" as needed.
 */
function buildPathRelative(
  filePath: string,
  inputDir: string,
  stripPrefix: string,
): string {
  let resolved = path.resolve(filePath);
  const resolvedStrip = stripPrefix ? path.resolve(stripPrefix) : "";

  // If stripPrefix actually applies, remove it. Otherwise, just do a relative path.
  if (resolvedStrip && resolved.startsWith(resolvedStrip)) {
    resolved = resolved.slice(resolvedStrip.length);
  } else {
    resolved = path.relative(path.resolve(inputDir), resolved);
  }

  // Remove leading path separator(s)
  while (resolved.startsWith(path.sep)) {
    resolved = resolved.slice(1);
  }

  // Normalize backslashes to forward slashes
  resolved = resolved.replace(/\\/g, "/");

  // Convert .ts -> .js
  if (resolved.toLowerCase().endsWith(".ts")) {
    resolved = `${resolved.slice(0, -3)}.js`;
  }

  // Ensure it starts with "./" or "../"
  if (!resolved.startsWith("./") && !resolved.startsWith("../")) {
    resolved = `./${resolved}`;
  }

  return resolved;
}

/**
 * Collects files with given extensions.
 */
async function collectFiles(
  dir: string,
  exts: string[],
  recursive: boolean,
): Promise<string[]> {
  const found: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        const sub = await collectFiles(fullPath, exts, recursive);
        found.push(...sub);
      }
    } else if (entry.isFile()) {
      if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        found.push(fullPath);
      }
    }
  }
  return found;
}

/**
 * Creates aggregator lines for a single file.
 *
 * If `--named` is true, we parse named exports. We may produce up to two lines:
 * - import type { ... } / export type { ... }
 * - import { ... } / export { ... }
 *
 * If `--named` is false, we produce a single star import or export.
 */
async function generateAggregatorLines(
  filePath: string,
  inputDir: string,
  stripPrefix: string,
  useImport: boolean,
  useNamed: boolean,
): Promise<string[]> {
  const importPath = buildPathRelative(filePath, inputDir, stripPrefix);

  // If not named => star approach
  if (!useNamed) {
    if (useImport) {
      // import * as ident from ...
      const ident = guessStarImportIdentifier(filePath);
      return [`import * as ${ident} from "${importPath}";`];
    } else {
      // export * from ...
      return [`export * from "${importPath}";`];
    }
  }

  // If named => we parse the file
  const { typeNames, valueNames } = await getNamedExports(filePath);
  // If neither type nor value exports found, skip
  if (!typeNames.length && !valueNames.length) {
    return [];
  }

  // We'll produce up to two lines
  if (useImport) {
    // Example:
    // import type { T1, T2 } from "...";
    // import { V1, V2 } from "...";
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
  } else {
    // Example:
    // export type { T1, T2 } from "...";
    // export { V1, V2 } from "...";
    const lines: string[] = [];

    if (typeNames.length > 0) {
      lines.push(
        `export type { ${typeNames.join(", ")} } from "${importPath}";`,
      );
    }
    if (valueNames.length > 0) {
      lines.push(`export { ${valueNames.join(", ")} } from "${importPath}";`);
    }
    return lines;
  }
}

/**
 * This function returns the named exports in a file, separated into
 *   - typeNames: for "export type Foo" or "export interface Bar"
 *   - valueNames: for "export (async)? function Foo", "export const Foo", etc.
 */
async function getNamedExports(filePath: string): Promise<{
  typeNames: string[];
  valueNames: string[];
}> {
  const code = await fs.readFile(filePath, "utf-8");

  // Regex captures lines like:
  //
  //   export async function <NAME>
  //   export function <NAME>
  //   export const <NAME>
  //   export let <NAME>
  //   export class <NAME>
  //   export type <NAME>
  //   export interface <NAME>
  //
  // Group #1 is the keyword: function|const|class|let|type|interface
  // Group #2 is the exported name (like doStuff, MyType, etc.)
  //
  // We'll separate them based on whether #1 is type/interface vs function/class/const/let.
  const pattern =
    /^export\s+(?:async\s+)?(function|const|class|let|type|interface)\s+([A-Za-z0-9_$]+)/gm;

  const typeNames: string[] = [];
  const valueNames: string[] = [];

  let match: null | RegExpExecArray;
  while ((match = pattern.exec(code)) !== null) {
    const keyword = match[1]; // e.g. "type", "interface", "function", etc.
    const name = match[2];

    if (keyword === "type" || keyword === "interface") {
      typeNames.push(name);
    } else {
      // function|class|const|let => treat as value export
      valueNames.push(name);
    }
  }

  return { typeNames, valueNames };
}

/**
 * For star imports, we generate an identifier from the filename, e.g.
 *  'utils-cwd.ts' -> 'utils_cwd'
 * so we do: import * as utils_cwd from "./utils-cwd.js";
 */
function guessStarImportIdentifier(filePath: string): string {
  // e.g. "foo-bar.ts" => baseName is "foo-bar"
  const base = path.basename(filePath, path.extname(filePath));
  // Replace invalid chars
  let identifier = base.replace(/[^a-zA-Z0-9_$]/g, "_");
  // If it starts with digit, prefix underscore
  if (/^\d/.test(identifier)) {
    identifier = `_${identifier}`;
  }
  return identifier || "file";
}
