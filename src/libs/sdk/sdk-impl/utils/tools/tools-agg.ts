import fs from "fs-extra";
import path from "pathe";

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
 * Parses the given file to find exported function/const/let/class.
 * Returns an array of exported names, e.g. ["myFunc", "SOME_CONST", "MyClass"].
 */
async function getNamedExports(filePath: string): Promise<string[]> {
  const code = await fs.readFile(filePath, "utf-8");

  // Regex capturing lines like:
  //   export function <NAME>
  //   export const <NAME>
  //   export let <NAME>
  //   export class <NAME>
  const pattern = /^export\s+(function|const|class|let)\s+([A-Za-z0-9_$]+)/gm;

  const out: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    out.push(match[2]);
  }
  return out;
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
 * For star imports, we generate an identifier from the filename, e.g.
 *  'utils-cwd.ts' -> 'utils_cwd'
 * so we can do: import * as utils_cwd from "./utils-cwd.js";
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

/**
 * The aggregator logic: produce either star or named import/exports.
 * If `useImport = true`, produce import lines, else export lines.
 * If `useNamed = true`, parse named exports (or skip file if none).
 */
async function generateAggregatorLine(
  filePath: string,
  inputDir: string,
  stripPrefix: string,
  useImport: boolean,
  useNamed: boolean,
): Promise<string | null> {
  const importPath = buildPathRelative(filePath, inputDir, stripPrefix);

  if (useNamed) {
    // Named approach: parse the file
    const names = await getNamedExports(filePath);
    if (!names.length) {
      // If no named exports found, skip
      return null;
    }

    // E.g. { foo, bar } from "./some-file.js"
    const block = names.join(", ");

    if (useImport) {
      // import { foo, bar } from ...
      return `import { ${block} } from "${importPath}";`;
    } else {
      // export { foo, bar } from ...
      return `export { ${block} } from "${importPath}";`;
    }
  } else {
    // Star approach
    if (useImport) {
      // import * as <id> from ...
      const ident = guessStarImportIdentifier(filePath);
      return `import * as ${ident} from "${importPath}";`;
    } else {
      // export * from ...
      return `export * from "${importPath}";`;
    }
  }
}

/**
 * Aggregator supporting --import or --export, star or named.
 */
export async function useAggregator({
  inputDir,
  outFile,
  stripPrefix,
  isRecursive,
  useNamed,
  useImport,
}: {
  inputDir: string;
  outFile: string;
  stripPrefix: string;
  isRecursive: boolean;
  useNamed: boolean;
  useImport: boolean;
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

  const lines: string[] = [];
  for (const fp of filePaths) {
    const line = await generateAggregatorLine(
      fp,
      inputDir,
      stripPrefix,
      useImport,
      useNamed,
    );
    if (line) lines.push(line);
  }

  // Warn if outFile is inside inputDir
  if (outFile.startsWith(inputDir)) {
    console.warn(
      `Warning: The output file is inside (or overlaps with) the input directory.\nMight re-import (or re-export) itself.\n   input: ${inputDir}\n   out: ${outFile}\n`,
    );
  }

  // Write aggregator
  const finalText = `${lines.join("\n")}\n`;
  await fs.ensureFile(outFile);
  await fs.writeFile(outFile, finalText, "utf8");

  console.log(
    `\nAggregator done: wrote ${lines.length} lines to:\n  ${outFile}`,
  );
}
