import fs from "node:fs/promises";
import type { PlatformPath } from "node:path";

import {
  type GetFileImportsExportsOptions,
  getFileImportsExports,
  type ImportExportInfo,
  type ImportExportSpecifier,
} from "./utils/get-imports-exports";

// end-user logging
const regularLogger = (msg: string | (() => string)) => {
  const message = typeof msg === "function" ? msg() : msg;
  console.log(`\x1b[2m${message}\x1b[0m`);
};

const filteredLogger = (msg: string | (() => string)) => {
  const message = typeof msg === "function" ? msg() : msg;
  console.log(`\x1b[36;2m${message}\x1b[0m`);
};

// internal logging (all usage will be removed from final build by @reliverse/dler)
const DEBUG_MODE = false;
const logInternal = (msg: string | (() => string)) => {
  if (DEBUG_MODE) {
    const message = typeof msg === "function" ? msg() : msg;
    console.log(`\x1b[36;2m${message}\x1b[0m`);
  }
};

// constants for configuration
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"];

// constants for path handling
const SLASH = "/";
const BACK_SLASH = "\\";
const DOT = ".";
const DOUBLE_DOT = "..";
const EMPTY = "";

// symbol for normalized alias tracking
const normalizedAliasSymbol = Symbol.for("pathkit:normalizedAlias");

// regex patterns
const DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
const DRIVE_LETTER_RE = /^[A-Za-z]:$/;
const UNC_REGEX = /^[/\\]{2}/;
const IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const ROOT_FOLDER_RE = /^\/([A-Za-z]:)?$/;
const PATH_ROOT_RE = /^[/\\]|^[a-zA-Z]:[/\\]/;

export const IMPORT_EXPORT_REGEX =
  /(?:import\s+(?:type\s+)?[\s\S]*?\s+from\s+|import\s*\(\s*|export\s+(?:type\s+)?(?:\*\s+from\s+|(?:\w+(?:\s*,\s*|\s+))?\{[\s\S]*?\}(?:\s*,\s*\w+)?\s+from\s+|\w+\s+from\s+))\s*(['"])([^'"]+)\1/g;

interface NormalizedRecord extends Record<string, string> {
  [normalizedAliasSymbol]?: true;
}

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export interface FormatInputPathObject {
  root?: string;
  dir?: string;
  base?: string;
  ext?: string;
  name?: string;
}

// extension handling type
type PathExtFilter = "js" | "ts" | "none" | "js-ts-none";

// type for extension conversion
type ImportExtType = "js" | "ts" | "none";

/**
 * normalizes windows paths to use forward slashes
 */
function normalizeWindowsPath(input = ""): string {
  if (!input) return input;

  return input
    .replace(/\\/g, SLASH)
    .replace(DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}

/**
 * compares paths by segment count for sorting
 */
function compareAliases(a: string, b: string): number {
  return b.split(SLASH).length - a.split(SLASH).length;
}

/**
 * gets current working directory with normalized slashes
 */
function cwd(): string {
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd().replace(/\\/g, SLASH);
  }
  return SLASH;
}

/**
 * normalizes path segments with dot handling
 */
function normalizeString(path: string, allowAboveRoot: boolean): string {
  let res = EMPTY;
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char: string | null = null;

  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index] ?? null;
    } else if (char === SLASH) {
      break;
    } else {
      char = SLASH;
    }

    if (char === SLASH) {
      if (lastSlash === index - 1 || dots === 1) {
        // noop: consecutive slashes or single dot
      } else if (dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          !res.endsWith(DOT) ||
          res[res.length - 2] !== DOT
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(SLASH);
            if (lastSlashIndex === -1) {
              res = EMPTY;
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf(SLASH);
            }
            lastSlash = index;
            dots = 0;
            continue;
          }
          if (res.length > 0) {
            res = EMPTY;
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }

        if (allowAboveRoot) {
          res += res.length > 0 ? `${SLASH}..` : DOUBLE_DOT;
          lastSegmentLength = 2;
        }
      } else {
        const segment = path.slice(lastSlash + 1, index);
        if (res.length > 0) {
          res += `${SLASH}${segment}`;
        } else {
          res = segment;
        }
        lastSegmentLength = segment.length;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

const sep = SLASH;

/**
 * normalizes a path, resolving . and .. segments
 */
const normalize = (path: string): string => {
  if (path.length === 0) return DOT;

  const originalPath = path;
  path = normalizeWindowsPath(path);

  const isPathAbsolute = IS_ABSOLUTE_RE.test(path);
  const trailingSeparator = path.endsWith(SLASH);

  path = normalizeString(path, !isPathAbsolute);

  if (path.length === 0) {
    if (isPathAbsolute) return SLASH;

    return trailingSeparator && originalPath.length > 0 && originalPath !== DOT
      ? "./"
      : DOT;
  }

  if (trailingSeparator && !path.endsWith(SLASH)) {
    path += SLASH;
  }

  if (DRIVE_LETTER_RE.test(path) && path.length === 2) {
    path += SLASH;
  }

  if (UNC_REGEX.test(originalPath.replace(/\\/g, SLASH))) {
    const normOriginal = originalPath.replace(/\\/g, SLASH);
    if (normOriginal.startsWith("//./")) {
      return `//./${path.startsWith(SLASH) ? path.substring(1) : path}`;
    }
    if (normOriginal.startsWith("//") && !normOriginal.startsWith("//./")) {
      return `//${path.startsWith(SLASH) ? path.substring(1) : path}`;
    }
  }

  if (isPathAbsolute && !IS_ABSOLUTE_RE.test(path) && path !== SLASH) {
    return `${SLASH}${path}`;
  }

  return path;
};

/**
 * joins path segments with proper normalization
 */
const join = (...segments: string[]): string => {
  if (segments.length === 0) return DOT;

  let joined = EMPTY;
  for (const segment of segments) {
    if (typeof segment !== "string") {
      throw new TypeError("Arguments to path.join must be strings");
    }
    if (segment.length > 0) {
      if (joined.length === 0) {
        joined = segment;
      } else {
        joined += `${SLASH}${segment}`;
      }
    }
  }

  if (joined.length === 0) return DOT;
  return normalize(joined);
};

/**
 * resolves path to an absolute path
 */
const resolve = (...args: string[]): string => {
  let resolvedPath = EMPTY;
  let resolvedAbsolute = false;

  for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? args[i] : cwd();

    if (typeof path !== "string") {
      throw new TypeError("Arguments to path.resolve must be strings");
    }
    if (path.length === 0) continue;

    const normalizedSegment = normalizeWindowsPath(path);
    resolvedPath = `${normalizedSegment}${SLASH}${resolvedPath}`;
    resolvedAbsolute = IS_ABSOLUTE_RE.test(normalizedSegment);
  }

  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);

  if (resolvedAbsolute) {
    if (IS_ABSOLUTE_RE.test(resolvedPath)) {
      return resolvedPath;
    }
    return `${SLASH}${resolvedPath}`;
  }

  return resolvedPath.length > 0 ? resolvedPath : DOT;
};

/**
 * checks if path is absolute
 */
const isAbsolute = (p: string): boolean => {
  if (typeof p !== "string") return false;
  return IS_ABSOLUTE_RE.test(normalizeWindowsPath(p));
};

/**
 * converts path to namespaced path for windows
 */
const toNamespacedPath = (p: string): string => {
  if (typeof p !== "string" || p.length === 0) return p;
  return normalize(p);
};

/**
 * gets file extension including the dot
 */
const extname = (p: string): string => {
  if (typeof p !== "string") return EMPTY;
  const path = normalizeWindowsPath(p);

  let lastSlashIdx = path.lastIndexOf(SLASH);
  if (lastSlashIdx === -1) lastSlashIdx = 0;

  const basePart = lastSlashIdx === 0 ? path : path.substring(lastSlashIdx + 1);

  if (basePart === DOT || basePart === DOUBLE_DOT) return EMPTY;

  const lastDotIdx = basePart.lastIndexOf(DOT);
  if (lastDotIdx <= 0) return EMPTY;

  return basePart.substring(lastDotIdx);
};

/**
 * gets relative path from one path to another
 */
const relative = (from: string, to: string): string => {
  const resolvedFrom = resolve(from);
  const resolvedTo = resolve(to);

  if (resolvedFrom === resolvedTo) return EMPTY;

  const fromSegments = resolvedFrom
    .replace(ROOT_FOLDER_RE, "$1")
    .split(SLASH)
    .filter(Boolean);

  const toSegments = resolvedTo
    .replace(ROOT_FOLDER_RE, "$1")
    .split(SLASH)
    .filter(Boolean);

  // handle different drive letters on windows
  if (
    fromSegments.length > 0 &&
    toSegments.length > 0 &&
    fromSegments[0] &&
    toSegments[0] &&
    DRIVE_LETTER_RE.test(fromSegments[0]) &&
    DRIVE_LETTER_RE.test(toSegments[0]) &&
    fromSegments[0].toUpperCase() !== toSegments[0].toUpperCase()
  ) {
    return resolvedTo;
  }

  // find common path segments
  let commonSegments = 0;
  const maxCommon = Math.min(fromSegments.length, toSegments.length);

  while (
    commonSegments < maxCommon &&
    fromSegments[commonSegments] === toSegments[commonSegments]
  ) {
    commonSegments++;
  }

  const upSegments = Array(fromSegments.length - commonSegments).fill(
    DOUBLE_DOT,
  );
  const downSegments = toSegments.slice(commonSegments);

  const result = [...upSegments, ...downSegments].join(SLASH);
  return result.length > 0 ? result : DOT;
};

/**
 * gets directory name from path
 */
const dirname = (p: string): string => {
  if (typeof p !== "string" || p.length === 0) return DOT;

  const normalizedPath = normalizeWindowsPath(p);
  const lastSlash = normalizedPath.lastIndexOf(SLASH);

  if (lastSlash === -1) {
    return IS_ABSOLUTE_RE.test(normalizedPath) ? SLASH : DOT;
  }
  if (lastSlash === 0) return SLASH;

  const dir = normalizedPath.slice(0, lastSlash);

  if (DRIVE_LETTER_RE.test(dir) && dir.length === 2) {
    return dir + SLASH;
  }

  return normalize(dir);
};

/**
 * formats object parts into a path string
 */
const format = (p: FormatInputPathObject): string => {
  if (typeof p !== "object" || p === null) {
    throw new TypeError(
      'Parameter "pathObject" must be an object, not null or other type.',
    );
  }

  const dir = p.dir || p.root || "";
  const base = p.base || `${p.name || ""}${p.ext || ""}`;

  if (!dir) return base;
  if (dir === p.root) return `${dir}${base}`;

  return normalize(`${dir}${SLASH}${base}`);
};

/**
 * gets base filename from path
 */
const basename = (p: string, ext?: string): string => {
  if (typeof p !== "string") throw new TypeError("Path must be a string.");
  if (ext !== undefined && typeof ext !== "string")
    throw new TypeError("[basename] `ext` must be a string.");

  const normalizedPath = normalizeWindowsPath(p);

  // handle trailing slashes
  let end = normalizedPath.length;
  while (end > 0 && normalizedPath[end - 1] === SLASH) {
    end--;
  }
  if (end === 0) return EMPTY;

  // find last slash
  let start = normalizedPath.lastIndexOf(SLASH, end - 1);
  start = start === -1 ? 0 : start + 1;

  let filename = normalizedPath.slice(start, end);

  // remove ext if specified
  if (ext && filename.endsWith(ext) && filename !== ext) {
    filename = filename.slice(0, filename.length - ext.length);
  }

  return filename;
};

/**
 * parses a path into its components
 */
const parse = (p: string): ParsedPath => {
  if (typeof p !== "string") throw new TypeError("Path must be a string.");

  const normalizedPath = normalizeWindowsPath(p);
  const B = basename(normalizedPath);
  const E = extname(B);
  const N = B.slice(0, B.length - E.length);
  const D = dirname(normalizedPath);

  let R = EMPTY;
  const rootMatch = PATH_ROOT_RE.exec(normalizedPath);

  if (rootMatch) {
    R = rootMatch[0];

    // handle windows drive letters
    if (
      DRIVE_LETTER_RE.test(R) &&
      R.length === 2 &&
      normalizedPath.length > 2 &&
      normalizedPath[2] === SLASH
    ) {
      R += SLASH;
    }
    // handle unc paths
    else if (R === SLASH && D.startsWith("//")) {
      if (UNC_REGEX.exec(D)) {
        const uncParts = D.split(SLASH).slice(0, 3);
        R = uncParts.join(SLASH) || R;
      }
    }
  }

  const resolvedDir = D === DOT && R !== EMPTY && R !== DOT ? R : D;

  return {
    root: R,
    dir: resolvedDir,
    base: B,
    ext: E,
    name: N,
  };
};

/**
 * gets filename without extension
 */
function filename(pathString: string): string | undefined {
  const base = basename(pathString);
  if (!base) return undefined;

  const separatorIndex = base.lastIndexOf(DOT);
  return separatorIndex <= 0 ? base : base.slice(0, separatorIndex);
}

/**
 * normalizes alias records and optimizes nested aliases
 */
function normalizeAliases(aliases: Record<string, string>): NormalizedRecord {
  // return early if already normalized
  if ((aliases as NormalizedRecord)[normalizedAliasSymbol]) {
    return aliases as NormalizedRecord;
  }

  // normalize and sort by segment count (longest first)
  const sortedAliasesEntries = Object.entries(aliases)
    .map(
      ([key, value]) =>
        [normalizeWindowsPath(key), normalizeWindowsPath(value)] as [
          string,
          string,
        ],
    )
    .sort(([a], [b]) => compareAliases(a, b));

  const sortedAliases: Record<string, string> =
    Object.fromEntries(sortedAliasesEntries);

  // resolve nested aliases
  for (const key in sortedAliases) {
    for (const aliasPrefix in sortedAliases) {
      if (
        aliasPrefix === key ||
        key.startsWith(aliasPrefix + SLASH) ||
        key === aliasPrefix
      )
        continue;

      const value = sortedAliases[key];
      if (value?.startsWith(aliasPrefix)) {
        const nextChar = value[aliasPrefix.length];
        if (nextChar === undefined || nextChar === SLASH) {
          sortedAliases[key] =
            sortedAliases[aliasPrefix] + value.slice(aliasPrefix.length);
        }
      }
    }
  }

  // mark as normalized
  const finalNormalizedAliases: NormalizedRecord = { ...sortedAliases };
  Object.defineProperty(finalNormalizedAliases, normalizedAliasSymbol, {
    value: true,
    enumerable: false,
  });

  return finalNormalizedAliases;
}

/**
 * resolves a path using aliases
 */
function resolveAlias(path: string, aliases: Record<string, string>): string {
  const normalizedPath = normalizeWindowsPath(path);
  const normalizedAliases = normalizeAliases(aliases);

  for (const [alias, to] of Object.entries(normalizedAliases)) {
    const effectiveAlias = alias.endsWith(SLASH) ? alias : alias + SLASH;
    const effectivePath = normalizedPath.endsWith(SLASH)
      ? normalizedPath
      : normalizedPath + SLASH;

    if (effectivePath.startsWith(effectiveAlias)) {
      return join(to, normalizedPath.slice(alias.length));
    }

    if (normalizedPath === alias) {
      return to;
    }
  }

  return normalizedPath;
}

/**
 * finds all alias paths that could resolve to the given path
 */
function reverseResolveAlias(
  path: string,
  aliases: Record<string, string>,
): string[] {
  const normalizedPath = normalizeWindowsPath(path);
  const normalizedAliases = normalizeAliases(aliases);
  const matches: string[] = [];

  for (const [alias, to] of Object.entries(normalizedAliases)) {
    const effectiveTo = to.endsWith(SLASH) ? to : to + SLASH;
    const effectivePath = normalizedPath.endsWith(SLASH)
      ? normalizedPath
      : normalizedPath + SLASH;

    if (effectivePath.startsWith(effectiveTo)) {
      matches.push(join(alias, normalizedPath.slice(to.length)));
    }

    if (normalizedPath === to) {
      matches.push(alias);
    }
  }

  return matches.sort((a, b) => b.length - a.length);
}

/**
 * finds a matching alias in tsconfig-style paths
 */
const findAliasMatch = (
  importPath: string,
  paths: Record<string, string[]>,
): {
  key: string;
  root: string;
  resolvedPath: string;
  suffix: string;
} | null => {
  logInternal(`[findAliasMatch] Processing import: ${importPath}`);
  logInternal(`  - paths: ${JSON.stringify(paths)}`);

  // Skip if it's an npm package import/export that doesn't match our alias
  const firstPathKey = Object.keys(paths)[0];
  if (!firstPathKey) {
    logInternal(`  - no paths defined`);
    return null;
  }

  const baseAlias = firstPathKey.replace("/*", "");
  if (importPath.startsWith("@") && !importPath.startsWith(baseAlias)) {
    logInternal(`  - skipping: npm package import`);
    return null;
  }

  // exact match
  if (paths[importPath]?.[0]) {
    logInternal(`  - found exact match`);
    return {
      key: importPath,
      root: importPath,
      resolvedPath: paths[importPath][0],
      suffix: "",
    };
  }

  // wildcard match
  for (const aliasKey in paths) {
    if (aliasKey.endsWith("/*")) {
      const aliasRoot = aliasKey.slice(0, -2);
      logInternal(`  - checking wildcard match for: ${aliasRoot}`);

      if (importPath === aliasRoot || importPath.startsWith(`${aliasRoot}/`)) {
        const suffix =
          importPath === aliasRoot
            ? ""
            : importPath.slice(aliasRoot.length + 1);

        const targetPaths = paths[aliasKey];
        if (targetPaths?.[0]) {
          const resolvedPathPattern = targetPaths[0].slice(0, -2);
          logInternal(`  - found wildcard match`);
          logInternal(`    - suffix: ${suffix}`);
          logInternal(`    - resolvedPathPattern: ${resolvedPathPattern}`);

          return {
            key: aliasKey,
            root: aliasRoot,
            resolvedPath: resolvedPathPattern,
            suffix,
          };
        }
      }
    }
  }

  logInternal(`  - no match found`);
  return null;
};

/**
 * converts absolute path to relative import/export path
 */
const toRelativeImport = (absPath: string, fromDir: string): string => {
  const rel = normalizeWindowsPath(relative(fromDir, absPath));
  return rel.startsWith(DOT) ? rel : `./${rel}`;
};

/**
 * attempts to find a file with various extensions
 */
async function resolveFileWithExtensions(
  basePath: string,
  extensions = ["", ...EXTENSIONS, ".json"],
): Promise<string | null> {
  // try direct file
  for (const ext of extensions) {
    try {
      const fullPath = basePath + ext;
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
    } catch {
      // file doesn't exist with this extension
    }
  }

  // try index file
  for (const ext of extensions) {
    try {
      const indexPath = join(basePath, `index${ext}`);
      const stat = await fs.stat(indexPath);
      if (stat.isFile()) {
        return indexPath;
      }
    } catch {
      // index file doesn't exist
    }
  }

  return null;
}

/**
 * determines the appropriate file extension to use based on the pathExtFilter setting
 */
function getTargetExtension(relPath: string, originalExt: string): string {
  // Always preserve the original extension if it exists
  if (originalExt) {
    return relPath;
  }
  return relPath;
}

/**
 * converts aliased path to relative path
 */
async function convertStringAliasRelative({
  importPath,
  importerFile,
  pathPattern,
  targetDir,
}: {
  importPath: string;
  importerFile: string;
  pathPattern: string;
  targetDir: string;
}): Promise<string> {
  logInternal(`[convertStringAliasRelative] Processing import: ${importPath}`);
  logInternal(`  - importerFile: ${importerFile}`);
  logInternal(`  - pathPattern: ${pathPattern}`);
  logInternal(`  - targetDir: ${targetDir}`);

  // Skip if it's an npm package import/export that doesn't match our alias
  const baseAlias = pathPattern.replace("/*", "");
  if (importPath.startsWith("@") && !importPath.startsWith(baseAlias)) {
    logInternal(`  - skipping: npm package import`);
    return importPath;
  }

  const paths = { [pathPattern]: ["./*"] };
  const importerDir = dirname(importerFile);
  const match = findAliasMatch(importPath, paths);

  if (!match) {
    logInternal(`  - no alias match found`);
    return importPath;
  }

  logInternal(`  - found alias match: ${JSON.stringify(match)}`);

  const absPath = resolve(targetDir, match.resolvedPath, match.suffix);
  logInternal(`  - resolved absolute path: ${absPath}`);

  const resolvedFile = await resolveFileWithExtensions(absPath);
  logInternal(`  - resolved file with exts: ${resolvedFile || "not found"}`);

  const relPath = toRelativeImport(resolvedFile || absPath, importerDir);
  logInternal(`  - relative path: ${relPath}`);

  // apply extension formatting
  const originalExt = extname(importPath);
  const result = getTargetExtension(relPath, originalExt);
  logInternal(`  - final result: ${result}`);

  return result;
}

/**
 * replaces all occurrences of a string while tracking position
 */
function replaceAllInString(
  original: string,
  searchValue: string,
  replaceValue: string,
): string {
  let currentPosition = 0;
  let result = "";

  while (currentPosition < original.length) {
    const foundIdx = original.indexOf(searchValue, currentPosition);
    if (foundIdx === -1) {
      result += original.substring(currentPosition);
      break;
    }

    result += original.substring(currentPosition, foundIdx);
    result += replaceValue;
    currentPosition = foundIdx + searchValue.length;
  }

  return result;
}

/**
 * processes a file to convert import/export paths
 */
async function processFile(
  filePath: string,
  aliasToReplace: string,
  targetDir: string,
  pathExtFilter: PathExtFilter,
  displayLogsOnlyFor?: string[],
  displayLogs = false,
): Promise<{ from: string; to: string }[]> {
  const shouldLog =
    displayLogs &&
    (!displayLogsOnlyFor || displayLogsOnlyFor.includes(filePath));
  const log = (msg: string) => shouldLog && filteredLogger(msg);

  const content = await fs.readFile(filePath, "utf-8");
  let updated = content;
  const changes: { from: string; to: string }[] = [];
  const matches = Array.from(content.matchAll(IMPORT_EXPORT_REGEX));

  // ensure aliastoreplace has the wildcard pattern if it doesn't already
  const normalizedAlias = aliasToReplace.endsWith("/*")
    ? aliasToReplace
    : `${aliasToReplace}/*`;

  // Get the base alias without wildcard for comparison
  const baseAlias = aliasToReplace.replace("/*", "");

  log(`[processFile] Processing file: ${filePath}`);
  log(`  - normalizedAlias: ${normalizedAlias}`);
  log(`  - baseAlias: ${baseAlias}`);
  log(`  - found ${matches.length} import/export statements`);

  for (const match of matches) {
    const originalQuote = match[1];
    const importPath = match[2];
    if (!importPath) continue;

    log(`  Processing import: ${importPath}`);

    if (!importPath.startsWith(baseAlias)) {
      if (DEBUG_MODE) {
        log(`  - skipping: import/export doesn't start with ${baseAlias}`);
      }
      continue;
    }

    // apply filter based on pathextfilter
    const importExt = extname(importPath);
    const shouldProcess =
      (pathExtFilter === "js" && importExt === ".js") || // process paths with .js extension
      (pathExtFilter === "ts" && importExt === ".ts") || // process paths with .ts extension
      (pathExtFilter === "none" && importExt === "") || // process paths without any extension
      pathExtFilter === "js-ts-none"; // process all paths (which has js and/or ts extensions, and/or does not have any extension)

    if (!shouldProcess) {
      log(`  - skipping: doesn't match pathExtFilter ${pathExtFilter}`);
      continue;
    }

    log(`  - converting alias to relative path...`);
    const relPath = await convertStringAliasRelative({
      importPath,
      importerFile: filePath,
      pathPattern: normalizedAlias,
      targetDir,
    });

    log(`  - original path: ${importPath}`);
    log(`  - converted to: ${relPath}`);

    // For "none" mode, ensure we remove any extension from the relative path
    const finalPath =
      pathExtFilter === "none"
        ? relPath.replace(/\.(ts|js|tsx|jsx|mjs|cjs)$/, "")
        : relPath;

    if (importPath !== finalPath) {
      changes.push({ from: importPath, to: finalPath });

      const searchString = `${originalQuote}${importPath}${originalQuote}`;
      const replacementString = `${originalQuote}${finalPath}${originalQuote}`;
      updated = replaceAllInString(updated, searchString, replacementString);
      log(`  - applied change: ${importPath} → ${finalPath}`);
    } else {
      log(`  - no change needed`);
    }
  }

  if (content !== updated) {
    await fs.writeFile(filePath, updated);
    log(`✓ processed: ${filePath}`);
  } else {
    if (DEBUG_MODE) {
      log(`  - no changes made to file: ${filePath}`);
    }
  }

  return changes;
}

/**
 * recursively processes all files to convert import/export paths
 */
async function processAllFiles({
  srcDir,
  aliasToReplace,
  extensionsToProcess,
  rootDir,
  pathExtFilter,
  displayLogsOnlyFor,
}: {
  srcDir: string;
  aliasToReplace: string;
  extensionsToProcess: string[];
  rootDir: string;
  pathExtFilter: PathExtFilter;
  displayLogsOnlyFor?: string[];
}): Promise<{ file: string; changes: { from: string; to: string }[] }[]> {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    const results: { file: string; changes: { from: string; to: string }[] }[] =
      [];

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(srcDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules") return;

          const subdirResults = await processAllFiles({
            srcDir: fullPath,
            aliasToReplace,
            extensionsToProcess,
            rootDir,
            pathExtFilter,
            displayLogsOnlyFor,
          });

          results.push(...subdirResults);
        } else if (extensionsToProcess.includes(extname(entry.name))) {
          const changes = await processFile(
            fullPath,
            aliasToReplace,
            rootDir,
            pathExtFilter,
            displayLogsOnlyFor,
          );

          if (changes.length > 0) {
            results.push({ file: fullPath, changes });
          }
        } else {
          logInternal(`  - non-matching file skip: ${entry.name}`);
        }
      }),
    );

    return results;
  } catch (error) {
    regularLogger(
      `error processing directory ${srcDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * main function to convert import/export paths from aliases to relative paths
 */
async function convertImportsAliasToRelative({
  targetDir,
  aliasToReplace,
  pathExtFilter,
  displayLogsOnlyFor,
  displayLogs = false,
}: {
  targetDir: string;
  aliasToReplace: string;
  pathExtFilter: PathExtFilter;
  displayLogsOnlyFor?: string[];
  displayLogs?: boolean;
}): Promise<{ file: string; changes: { from: string; to: string }[] }[]> {
  const normalizedAlias = aliasToReplace.endsWith("/*")
    ? aliasToReplace
    : `${aliasToReplace}/*`;

  // regularLogger(
  //   `Converting aliased imports starting with '${aliasToReplace}' to relative paths in "${targetDir}"...`,
  // );
  // regularLogger(
  //   `   (Assuming "${normalizedAlias}" resolves relative to "${targetDir}")`,
  // );
  logInternal(`   (Using extension mode: ${pathExtFilter})`);

  const results = await processAllFiles({
    srcDir: targetDir,
    aliasToReplace: normalizedAlias,
    extensionsToProcess: EXTENSIONS,
    rootDir: targetDir,
    pathExtFilter,
    displayLogsOnlyFor,
  });

  if (results.length > 0 && displayLogs) {
    regularLogger("\n[convertImportsAliasToRelative] Summary of changes:");
    for (const { file, changes } of results) {
      const displayPath = relative(targetDir, file) || basename(file);
      regularLogger(() => `  in ${displayPath}:`);
      for (const { from, to } of changes) {
        regularLogger(() => `    - ${from} → ${to}`);
      }
    }
  }

  // regularLogger("Import/export path conversion process complete.");
  return results;
}

/**
 * converts extensions in import/export paths from one format to another
 */
async function convertImportsExt({
  targetDir,
  extFrom,
  extTo,
  alias,
  displayLogs = false,
}: {
  targetDir: string;
  extFrom: ImportExtType;
  extTo: ImportExtType;
  alias?: string;
  displayLogs?: boolean;
}): Promise<{ file: string; changes: { from: string; to: string }[] }[]> {
  logInternal(`Converting import/export extensions`);
  logInternal(`from '${extFrom}' to '${extTo}' in "${targetDir}"...`);

  // create regex pattern based on extfrom
  const fromExtStr = extFrom === "none" ? "" : `.${extFrom}`;
  const toExtStr = extTo === "none" ? "" : `.${extTo}`;

  // Normalize alias to handle both @ and @/* formats
  const normalizedAlias = alias
    ? alias.endsWith("/*")
      ? alias
      : `${alias}/*`
    : undefined;
  const aliasPrefix = normalizedAlias?.replace("/*", "");

  // match import/export statements with the specified extension
  // this regex matches both standard imports and dynamic imports
  // but only at the start of a line or after a semicolon/newline
  const importRegex = new RegExp(
    `(?:^|;|\\n)\\s*(?:import\\s+(?:[\\s\\S]*?)\\s+from\\s+|import\\s*\\(\\s*|export\\s+\\*\\s+from\\s+)\\s*(['"])([^'"]+${fromExtStr.replace(".", "\\.")})(\\1)`,
    "gm",
  );

  // Helper to determine if a path should be skipped
  function shouldSkipPath(path: string): boolean {
    // Skip built-in modules and package managers
    if (
      path.startsWith("node:") ||
      path.startsWith("bun:") ||
      path.startsWith("npm:") ||
      path.startsWith("jsr:") ||
      path.startsWith("node_modules")
    )
      return true;

    // Handle alias paths if specified
    if (aliasPrefix && path.startsWith(aliasPrefix)) {
      return false; // Don't skip alias paths
    }

    // Skip package imports
    // 1. Scoped packages (starting with @)
    // 2. Simple package names (no / in the first segment)
    // 3. Package names with subpaths (like package/subpath)
    const segments = path.split("/");
    const firstSegment = segments[0];
    if (!firstSegment) return false;

    if (
      path.startsWith("@") || // scoped packages
      !firstSegment.includes(".") || // simple package names
      (firstSegment.includes("-") && !firstSegment.startsWith(".")) // hyphenated package names
    )
      return true;

    // Skip URLs
    if (path.startsWith("http://") || path.startsWith("https://")) return true;

    // Skip if path already has the target extension
    if (extTo !== "none" && path.endsWith(`.${extTo}`)) return true;

    // Only skip paths with extensions when extFrom is "none"
    if (extFrom === "none" && /\.[^/]+$/.test(path)) return true;

    return false;
  }

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: { file: string; changes: { from: string; to: string }[] }[] =
      [];

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(targetDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules") return;

          const subdirResults = await convertImportsExt({
            targetDir: fullPath,
            extFrom,
            extTo,
            alias,
          });

          results.push(...subdirResults);
        } else if (EXTENSIONS.includes(extname(entry.name))) {
          // process file
          const content = await fs.readFile(fullPath, "utf-8");
          let updated = content;
          const changes: { from: string; to: string }[] = [];

          // using regex to find and replace import/export paths
          let match: RegExpExecArray | null;
          match = importRegex.exec(content);
          while (match !== null) {
            const quote = match[1];
            const importPath = match[2];
            if (!importPath) continue;

            // Skip paths that shouldn't be modified
            if (shouldSkipPath(importPath)) {
              match = importRegex.exec(updated);
              continue;
            }

            // compute replacement path
            let replacementPath: string;

            if (extFrom === "none") {
              // Only add extension if path doesn't already have one
              replacementPath = /\.[^/]+$/.test(importPath)
                ? importPath
                : importPath + toExtStr;
            } else if (extTo === "none") {
              // removing extension
              replacementPath = importPath.slice(0, -fromExtStr.length);
            } else {
              // replacing one extension with another
              replacementPath =
                importPath.slice(0, -fromExtStr.length) + toExtStr;
            }

            // skip if the path doesn't actually change
            if (importPath === replacementPath) continue;

            changes.push({ from: importPath, to: replacementPath });

            // create replacements
            const searchStr = `${quote}${importPath}${quote}`;
            const replaceStr = `${quote}${replacementPath}${quote}`;

            updated = replaceAllInString(updated, searchStr, replaceStr);

            match = importRegex.exec(updated);
          }

          if (content !== updated) {
            await fs.writeFile(fullPath, updated);
            logInternal(`✓ processed: ${fullPath}`);

            if (changes.length > 0) {
              results.push({ file: fullPath, changes });
            }
          }
        } else {
          logInternal(`  - skipping non-matching file: ${entry.name}`);
        }
      }),
    );

    if (results.length > 0 && displayLogs) {
      regularLogger("\n[convertImportsExt] Summary of changes:");
      for (const { file, changes } of results) {
        const displayPath = relative(targetDir, file) || basename(file);
        regularLogger(() => `  in ${displayPath}:`);
        for (const { from, to } of changes) {
          regularLogger(() => `    - ${from} → ${to}`);
        }
      }
    }

    logInternal("Extension conversion complete.");
    return results;
  } catch (error) {
    regularLogger(
      `error processing directory ${targetDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * strips a specified number of segments from the beginning of a path
 * @param path - The path to strip segments from
 * @param count - Number of segments to strip (default: 1)
 * @param alias - Optional alias to preserve (e.g. "@", "~")
 * @returns The path with the specified number of segments removed
 */
function stripPathSegments(path: string, count = 1, alias = ""): string {
  if (typeof path !== "string" || path.length === 0) return path;
  if (count <= 0) return path;

  logInternal(`[stripPathSegments] Processing path: ${path}`);
  logInternal(`  - count: ${count}, alias: ${alias}`);

  const normalizedPath = normalizeWindowsPath(path);
  logInternal(`  - normalized: ${normalizedPath}`);

  const parsed = parse(normalizedPath);
  logInternal(`  - parsed: ${JSON.stringify(parsed)}`);

  // Reconstruct segments from dir and base, relative to root
  let pathSegments: string[] = [];
  if (parsed.dir && parsed.dir !== parsed.root) {
    let dirRelativeToRoot = parsed.dir;
    if (parsed.root && parsed.dir.startsWith(parsed.root)) {
      dirRelativeToRoot = parsed.dir.substring(parsed.root.length);
    }
    pathSegments.push(...dirRelativeToRoot.split(SLASH));
  }

  if (parsed.base) {
    pathSegments.push(parsed.base);
  }
  pathSegments = pathSegments.filter(Boolean);
  logInternal(`  - initial segments: ${JSON.stringify(pathSegments)}`);

  const leadingPreservedSegments: string[] = [];

  if (alias && pathSegments.length > 0 && pathSegments[0]?.startsWith(alias)) {
    const preserved = pathSegments.shift();
    if (preserved) {
      leadingPreservedSegments.push(preserved);
      logInternal(`  - preserved alias segment: ${preserved}`);
    }
  }

  while (
    pathSegments.length > 0 &&
    (pathSegments[0] === DOT || pathSegments[0] === DOUBLE_DOT)
  ) {
    const preserved = pathSegments.shift();
    if (preserved) {
      leadingPreservedSegments.push(preserved);
      logInternal(`  - preserved relative segment: ${preserved}`);
    }
  }

  const numToStrip = Math.min(count, pathSegments.length);
  const remainingBodySegments = pathSegments.slice(numToStrip);
  logInternal(`  - stripping ${numToStrip} segments`);
  logInternal(`  from: ${JSON.stringify(pathSegments)}`);
  logInternal(`  - remaining body segments:`);
  logInternal(`  ${JSON.stringify(remainingBodySegments)}`);

  const pathRoot = parsed.root;
  const effectiveSegments = [
    ...leadingPreservedSegments,
    ...remainingBodySegments,
  ];
  logInternal(`  - effective segments: ${JSON.stringify(effectiveSegments)}`);

  let result: string;
  if (effectiveSegments.length === 0) {
    result = normalize(pathRoot || DOT);
  } else if (pathRoot) {
    result = join(pathRoot, ...effectiveSegments);
  } else {
    result = join(...effectiveSegments);
  }

  logInternal(`  - final result: ${result}`);
  return result;
}

/**
 * recursively processes files in a directory to strip path segments from their contents
 * @param targetDir - The directory to process
 * @param segmentsToStrip - Number of segments to strip from paths
 * @param alias - Optional alias to preserve (e.g. "@", "~")
 * @param extensionsToProcess - Array of file extensions to process (default: EXTENSIONS)
 * @returns Array of processed files and their changes
 */
async function stripPathSegmentsInDirectory({
  targetDir,
  segmentsToStrip,
  alias = "",
  extensionsToProcess = EXTENSIONS,
  displayLogs = false,
}: {
  targetDir: string;
  segmentsToStrip: number;
  alias?: string;
  extensionsToProcess?: string[];
  displayLogs?: boolean;
}): Promise<{ file: string; changes: { from: string; to: string }[] }[]> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: { file: string; changes: { from: string; to: string }[] }[] =
      [];

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(targetDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules") return;

          logInternal(`  - recursing into directory: ${entry.name}`);
          const subdirResults = await stripPathSegmentsInDirectory({
            targetDir: fullPath,
            segmentsToStrip,
            alias,
            extensionsToProcess,
          });

          results.push(...subdirResults);
        } else if (extensionsToProcess.includes(extname(entry.name))) {
          logInternal(`  Processing file: ${entry.name}`);
          const content = await fs.readFile(fullPath, "utf-8");
          let updated = content;
          const changes: { from: string; to: string }[] = [];

          const matches = Array.from(content.matchAll(IMPORT_EXPORT_REGEX));
          logInternal(`  - found ${matches.length} import/export statements`);

          for (const match of matches) {
            const originalQuote = match[1];
            const importPath = match[2];
            if (!importPath) continue;

            if (!importPath.includes(SLASH)) {
              logInternal(`  - skipping non-path import: ${importPath}`);
              continue;
            }

            // Skip if it's not an alias path
            if (alias && !importPath.startsWith(alias.replace("/*", ""))) {
              logInternal(`  - skipping non-alias import: ${importPath}`);
              continue;
            }

            logInternal(`  Processing import/export: ${importPath}`);
            const strippedPath = stripPathSegments(
              importPath,
              segmentsToStrip,
              alias,
            );

            if (importPath === strippedPath) {
              logInternal(`  - no changes needed for ${importPath}`);
              continue;
            }

            changes.push({ from: importPath, to: strippedPath });
            logInternal(`  - transformed: ${importPath} → ${strippedPath}`);

            const searchStr = `${originalQuote}${importPath}${originalQuote}`;
            const replaceStr = `${originalQuote}${strippedPath}${originalQuote}`;
            updated = replaceAllInString(updated, searchStr, replaceStr);
          }

          if (content !== updated) {
            await fs.writeFile(fullPath, updated);
            logInternal("  ✓ wrote changes to file");

            if (changes.length > 0) {
              results.push({ file: fullPath, changes });
            }
          } else {
            logInternal(`  - no changes made to file: ${fullPath}`);
          }
        } else {
          logInternal(`  - skipping non-matching file: ${entry.name}`);
        }
      }),
    );

    if (results.length > 0 && displayLogs) {
      regularLogger(() => "[stripPathSegmentsInDirectory] Summary of changes:");
      for (const { file, changes } of results) {
        const displayPath = relative(targetDir, file) || basename(file);
        regularLogger(() => `  in ${displayPath}:`);
        for (const { from, to } of changes) {
          regularLogger(() => `    - ${from} → ${to}`);
        }
      }
    } else {
      logInternal("  No changes were made in any files");
    }

    return results;
  } catch (error) {
    regularLogger(
      `error processing directory ${targetDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * attaches path segments to an existing path
 * @param path - The base path to attach segments to
 * @param segments - The segments to attach
 * @param options - Configuration options
 * @returns The path with segments attached
 */
function attachPathSegments(
  path: string,
  segments: string | string[],
  options: {
    position?: "before" | "after";
    normalize?: boolean;
    ensureSlash?: boolean;
    preserveRoot?: boolean;
    preserveAlias?: string;
  } = {},
): string {
  if (typeof path !== "string" || path.length === 0) return path;

  const {
    position = "after",
    normalize: shouldNormalize = true,
    ensureSlash = true,
    preserveRoot = true,
    preserveAlias,
  } = options;

  // Convert segments to array and filter out empty strings
  const segmentsArray = Array.isArray(segments) ? segments : [segments];
  const validSegments = segmentsArray.filter((s) => s.length > 0);

  if (validSegments.length === 0) return path;

  // Normalize the base path if requested
  const basePath = shouldNormalize ? normalizeWindowsPath(path) : path;

  // Handle alias preservation
  let alias = "";
  let pathWithoutAlias = basePath;
  if (preserveAlias && position === "before") {
    const aliasMatch = new RegExp(`^${preserveAlias.replace("*", ".*")}`).exec(
      basePath,
    );
    if (aliasMatch) {
      alias = aliasMatch[0];
      pathWithoutAlias = basePath.slice(alias.length);
    }
  }

  // Handle absolute paths and preserve root if requested
  const isAbsolute = IS_ABSOLUTE_RE.test(pathWithoutAlias);
  const root = preserveRoot && isAbsolute ? SLASH : "";
  const pathWithoutRoot = isAbsolute
    ? pathWithoutAlias.slice(1)
    : pathWithoutAlias;

  // Join segments with proper slashes
  const joinedSegments = validSegments.join(SLASH);

  // Construct the final path based on position
  let result: string;
  if (position === "before") {
    result = ensureSlash
      ? `${alias}${root}${joinedSegments}${SLASH}${pathWithoutRoot}`
      : `${alias}${root}${joinedSegments}${pathWithoutRoot}`;
  } else {
    result = ensureSlash
      ? `${alias}${root}${pathWithoutRoot}${SLASH}${joinedSegments}`
      : `${alias}${root}${pathWithoutRoot}${joinedSegments}`;
  }

  // Normalize the final result if requested
  return shouldNormalize ? normalize(result) : result;
}

/**
 * recursively processes files in a directory to attach path segments to import/export statements
 * @param targetDir - The directory to process
 * @param segments - The segments to attach
 * @param options - Configuration options for path segment attachment
 * @param extensionsToProcess - Array of file extensions to process (default: EXTENSIONS)
 * @returns Array of processed files and their changes
 */
async function attachPathSegmentsInDirectory({
  targetDir,
  segments,
  options = {},
  extensionsToProcess = EXTENSIONS,
  displayLogs = false,
}: {
  targetDir: string;
  segments: string | string[];
  options?: Parameters<typeof attachPathSegments>[2];
  extensionsToProcess?: string[];
  displayLogs?: boolean;
}): Promise<{ file: string; changes: { from: string; to: string }[] }[]> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: { file: string; changes: { from: string; to: string }[] }[] =
      [];

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(targetDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules") return;

          const subdirResults = await attachPathSegmentsInDirectory({
            targetDir: fullPath,
            segments,
            options,
            extensionsToProcess,
          });

          results.push(...subdirResults);
        } else if (extensionsToProcess.includes(extname(entry.name))) {
          // process file
          const content = await fs.readFile(fullPath, "utf-8");
          let updated = content;
          const changes: { from: string; to: string }[] = [];

          // match import/export statements
          const matches = Array.from(content.matchAll(IMPORT_EXPORT_REGEX));

          for (const match of matches) {
            const originalQuote = match[1];
            const importPath = match[2];
            if (!importPath) continue;

            // skip if path doesn't need processing
            if (!importPath.includes(SLASH)) continue;

            const modifiedPath = attachPathSegments(
              importPath,
              segments,
              options,
            );

            // skip if no change
            if (importPath === modifiedPath) continue;

            changes.push({ from: importPath, to: modifiedPath });

            // create replacements
            const searchStr = `${originalQuote}${importPath}${originalQuote}`;
            const replaceStr = `${originalQuote}${modifiedPath}${originalQuote}`;

            updated = replaceAllInString(updated, searchStr, replaceStr);
          }

          if (content !== updated) {
            await fs.writeFile(fullPath, updated);
            logInternal(`✓ processed: ${fullPath}`);

            if (changes.length > 0) {
              results.push({ file: fullPath, changes });
            }
          }
        } else {
          logInternal(`  - skipping non-matching file: ${entry.name}`);
        }
      }),
    );

    if (results.length > 0 && displayLogs) {
      regularLogger(
        () => "\n[attachPathSegmentsInDirectory] Summary of changes:",
      );
      for (const { file, changes } of results) {
        const displayPath = relative(targetDir, file) || basename(file);
        regularLogger(() => `  in ${displayPath}:`);
        for (const { from, to } of changes) {
          regularLogger(() => `    - ${from} → ${to}`);
        }
      }
    }

    return results;
  } catch (error) {
    regularLogger(
      `error processing directory ${targetDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

// base path functions
const _pathBase = {
  sep,
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  format,
  parse,
  toNamespacedPath,
  relative,
  filename,
};

// platform-specific implementations
const _platforms = {
  posix: { ..._pathBase } as unknown as PlatformPath,

  win32: {
    ..._pathBase,
    sep: BACK_SLASH,
    delimiter: ";",
    isAbsolute: (p: string): boolean => {
      if (typeof p !== "string") return false;
      return /^[a-zA-Z]:[/\\]/.test(p) || /^[/\\]{2}/.test(p);
    },
    toNamespacedPath: (p: string): string => {
      if (typeof p !== "string" || p.length === 0) return p;

      const resolved = resolve(p);
      if (/^[a-zA-Z]:/.test(resolved)) {
        return `\\\\?\\${resolved.replace(/\//g, BACK_SLASH)}`;
      }
      if (/^[/\\]{2}/.test(resolved)) {
        return `\\\\?\\UNC\\${resolved.substring(2).replace(/\//g, BACK_SLASH)}`;
      }
      return p.replace(/\//g, BACK_SLASH);
    },
  } as unknown as PlatformPath,
} as {
  posix: PlatformPath;
  win32: PlatformPath;
  [key: PropertyKey]: unknown;
};

/**
 * creates a platform-specific path object with appropriate defaults
 */
const mix = (
  platformDefault: "posix" | "win32" | "currentSystem" = "currentSystem",
): PlatformPath &
  typeof _pathBase & { posix: PlatformPath; win32: PlatformPath } => {
  const actualDefault =
    platformDefault === "currentSystem"
      ? globalThis.process?.platform === "win32"
        ? "win32"
        : "posix"
      : platformDefault;

  const defaultPathObject =
    actualDefault === "win32" ? _platforms.win32 : _platforms.posix;

  return new Proxy(defaultPathObject, {
    get(target, prop) {
      if (prop === "delimiter") return actualDefault === "win32" ? ";" : ":";
      if (prop === "posix") return _platforms.posix;
      if (prop === "win32") return _platforms.win32;

      if (prop in target) {
        return (target as any)[prop];
      }

      if (prop in _pathBase) {
        return (_pathBase as any)[prop];
      }
      return undefined;
    },
  }) as unknown as PlatformPath &
    typeof _pathBase & { posix: PlatformPath; win32: PlatformPath };
};

const path: PlatformPath &
  typeof _pathBase & { posix: PlatformPath; win32: PlatformPath } = mix();
const win32 = _platforms.win32;
const delimiter: ";" | ":" =
  globalThis.process?.platform === "win32" ? ";" : (":" as const);

export type {
  PlatformPath,
  PathExtFilter,
  ImportExtType,
  ImportExportInfo,
  ImportExportSpecifier,
  GetFileImportsExportsOptions,
};

export {
  _pathBase as posix,
  win32,
  basename,
  delimiter,
  dirname,
  extname,
  filename,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
  sep,
  toNamespacedPath,
  normalizeAliases,
  resolveAlias,
  reverseResolveAlias,
  normalizeWindowsPath,
  convertStringAliasRelative,
  convertImportsAliasToRelative,
  convertImportsExt,
  stripPathSegments,
  stripPathSegmentsInDirectory,
  attachPathSegments,
  attachPathSegmentsInDirectory,
  getFileImportsExports,
};

export default path;
