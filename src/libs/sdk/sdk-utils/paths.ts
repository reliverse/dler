import fs from "fs-extra";
import MagicString from "magic-string";
import pMap from "p-map";
import path from "pathe";

import type { LibConfig } from "~/types.js";

import { relinka } from "~/utils.js";

// ========================================
// Paths (TODO: Move to a separate repo)
// ========================================

// TODO: Eliminate the functions related to the `relidler` specifically

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const debug = false;

// Cache current working directory to
// avoid repeated calls to process.cwd()
const CWD = process.cwd();

// -------------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------------

type ImportType =
  | "relative"
  | "absolute"
  | "alias"
  | "module"
  | "dynamic"
  | "bare";

type ConversionOptions = {
  sourceFile: string;
  baseDir: string;
  aliasPrefix: string;
  libs: Record<string, LibConfig>;
  currentLibName?: string;
  urlMap?: Record<string, string>;
};

// -------------------------------------------------------------------
// Helper Functions & Utilities
// -------------------------------------------------------------------

/**
 * Normalizes the alias prefix so that it always ends with a "/".
 */
function normalizeAliasPrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

/**
 * Normalizes quotes in a string.
 */
export function normalizeQuotes(str: string): string {
  return str.replace(/['"]/g, '"');
}

/**
 * Extracts the package name from an import path.
 */
export function extractPackageName(
  importPath: string | undefined,
): string | null {
  relinka("verbose", `Extracting package name from: ${importPath}`);
  if (!importPath || importPath.startsWith(".")) return null;
  const parts = importPath.split("/");
  if (importPath.startsWith("@") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] || null;
}

/**
 * Checks if an import path belongs to a library.
 */
function isLibraryImport(
  importPath: string,
  libName: string,
  libConfig: { main: string },
  currentLibName?: string,
): boolean {
  if (currentLibName && libName === currentLibName) {
    return false;
  }
  const libDirPath = path.dirname(libConfig.main);
  return (
    importPath.startsWith(libDirPath) ||
    importPath.includes(`/${path.basename(libDirPath)}/`) ||
    path.basename(path.dirname(importPath)) === path.basename(libDirPath)
  );
}

/**
 * Matches a relative path to a library from the config.
 */
function matchLibraryImport(
  relativeToRoot: string,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string | null {
  for (const [libName, libConfig] of Object.entries(libs)) {
    if (isLibraryImport(relativeToRoot, libName, libConfig, currentLibName)) {
      return libName;
    }
  }
  return null;
}

/**
 * Extracts the inner path from a dynamic import statement.
 */
function getDynamicImportPath(importStr: string): string | null {
  const match = /import\s*\(\s*(['"])(.*?)\1\s*\)/.exec(importStr);
  return match ? match[2] : null;
}

/**
 * Extracts a bare import URL from the given string.
 */
function getBareImportUrl(importStr: string, withFrom = false): string | null {
  const regex = withFrom
    ? /from\s+(['"])(https?:\/\/[^'"]+)\1/
    : /(['"])(https?:\/\/[^'"]+)\1/;
  const match = regex.exec(importStr);
  return match ? match[2] : null;
}

// -------------------------------------------------------------------
// Relative Path Conversions
// -------------------------------------------------------------------

function convertImportPathRelativeToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  return path.resolve(path.dirname(sourceFile), importPath);
}

function convertImportPathRelativeToAlias(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const absolutePath = convertImportPathRelativeToAbsolute(
    importPath,
    sourceFile,
  );
  return convertImportPathAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
}

function convertImportPathRelativeToModule(
  importPath: string,
  sourceFile: string,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!libs) return importPath;
  const absoluteImportPath = path.resolve(path.dirname(sourceFile), importPath);
  const relativeToRoot = path.relative(CWD, absoluteImportPath);
  const libName = matchLibraryImport(relativeToRoot, libs, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting relative import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

// -------------------------------------------------------------------
// Absolute Path Conversions
// -------------------------------------------------------------------

function convertImportPathAbsoluteToRelative(
  importPath: string,
  sourceFile: string,
): string {
  let relativePath = path
    .relative(path.dirname(sourceFile), importPath)
    .replace(/\\/g, "/");
  if (!relativePath.startsWith(".") && !relativePath.startsWith("/")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

function convertImportPathAbsoluteToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const relativePath = path.relative(baseDir, importPath).replace(/\\/g, "/");
  return `${aliasPrefix}${relativePath}`;
}

function convertImportPathAbsoluteToModule(
  importPath: string,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!libs) return importPath;
  const relativeToRoot = path.relative(CWD, importPath);
  const libName = matchLibraryImport(relativeToRoot, libs, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting absolute import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

// -------------------------------------------------------------------
// Alias Path Conversions
// -------------------------------------------------------------------

function convertImportPathAliasToRelative(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) return importPath;
  const subPath = importPath.slice(aliasPrefix.length);
  const targetPath = path.join(baseDir, subPath);
  return convertImportPathAbsoluteToRelative(targetPath, sourceFile);
}

function convertImportPathAliasToAbsolute(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) return importPath;
  const subPath = importPath.slice(aliasPrefix.length);
  return path.join(baseDir, subPath);
}

function convertImportPathAliasToModule(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!importPath.startsWith(aliasPrefix) || !libs) return importPath;
  const absolutePath = convertImportPathAliasToAbsolute(
    importPath,
    baseDir,
    aliasPrefix,
  );
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libs, currentLibName);
  return libName || importPath;
}

function convertImportPathAliasToAlias(
  importPath: string,
  fromBaseDir: string,
  fromAliasPrefix: string,
  toBaseDir: string,
  toAliasPrefix: string,
): string {
  if (!importPath.startsWith(fromAliasPrefix)) return importPath;
  const absolutePath = convertImportPathAliasToAbsolute(
    importPath,
    fromBaseDir,
    fromAliasPrefix,
  );
  return convertImportPathAbsoluteToAlias(
    absolutePath,
    toBaseDir,
    toAliasPrefix,
  );
}

// -------------------------------------------------------------------
// Module Path Conversions
// -------------------------------------------------------------------

function convertImportPathModuleToRelative(
  importPath: string,
  sourceFile: string,
  libs: Record<string, LibConfig>,
): string {
  if (!libs || !extractPackageName(importPath)) return importPath;
  const packageName = extractPackageName(importPath);
  if (!packageName || !libs[packageName]) return importPath;
  const libConfig = libs[packageName];
  const libMainDir = path.dirname(libConfig.main);
  const libMainPath = path.join(CWD, libMainDir);
  return convertImportPathAbsoluteToRelative(libMainPath, sourceFile);
}

function convertImportPathModuleToAbsolute(
  importPath: string,
  libs: Record<string, LibConfig>,
): string {
  if (!libs || !extractPackageName(importPath)) return importPath;
  const packageName = extractPackageName(importPath);
  if (!packageName || !libs[packageName]) return importPath;
  const libConfig = libs[packageName];
  const libMainDir = path.dirname(libConfig.main);
  return path.join(CWD, libMainDir);
}

function convertImportPathModuleToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  libs: Record<string, LibConfig>,
): string {
  if (!libs || !extractPackageName(importPath)) return importPath;
  const absolutePath = convertImportPathModuleToAbsolute(importPath, libs);
  return convertImportPathAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
}

// -------------------------------------------------------------------
// Dynamic Import Conversions
// -------------------------------------------------------------------

function convertImportPathDynamicToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const convertedPath = path.resolve(path.dirname(sourceFile), dynamicPath);
  return importPath.replace(dynamicPath, convertedPath);
}

function convertImportPathDynamicToRelative(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const convertedPath = convertImportPathAbsoluteToRelative(
    absolutePath,
    sourceFile,
  );
  return importPath.replace(dynamicPath, convertedPath);
}

function convertImportPathDynamicToAlias(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const convertedPath = convertImportPathAbsoluteToAlias(
    absolutePath,
    baseDir,
    aliasPrefix,
  );
  return importPath.replace(dynamicPath, convertedPath);
}

function convertImportPathDynamicToModule(
  importPath: string,
  sourceFile: string,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath || !libs) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libs, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting dynamic import to module: ${dynamicPath} -> ${libName}`,
    );
    return importPath.replace(dynamicPath, libName);
  }
  return importPath;
}

// -------------------------------------------------------------------
// Bare Import Conversions
// -------------------------------------------------------------------

function convertImportPathBareToRelative(
  importPath: string,
  sourceFile: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absoluteLocalPath = path.resolve(CWD, localPath);
  const relativePath = convertImportPathAbsoluteToRelative(
    absoluteLocalPath,
    sourceFile,
  );
  return importPath.replace(url, relativePath);
}

function convertImportPathBareToAbsolute(
  importPath: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  return importPath.replace(url, absolutePath);
}

function convertImportPathBareToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  const aliasPath = convertImportPathAbsoluteToAlias(
    absolutePath,
    baseDir,
    aliasPrefix,
  );
  return importPath.replace(url, aliasPath);
}

function convertImportPathBareToModule(
  importPath: string,
  urlMap: Record<string, string>,
  libs: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  const url = getBareImportUrl(importPath);
  if (!url || !libs) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libs, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting bare import to module: ${url} -> ${libName}`,
    );
    return importPath.replace(url, libName);
  }
  return importPath;
}

function convertImportPathBareToDynamic(
  importPath: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath, true);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  return importPath.replace(
    /from\s+(['"])(https?:\/\/[^'"]+)\1/,
    `= await import($1${localPath}$1)`,
  );
}

// -------------------------------------------------------------------
// Conversion Mapping & Main Conversion Function
// -------------------------------------------------------------------

type ConverterFunction = (
  importPath: string,
  opts: ConversionOptions,
) => string;

const conversionMapping: Record<string, ConverterFunction> = {
  "relative:absolute": (ip, opts) =>
    convertImportPathRelativeToAbsolute(ip, opts.sourceFile),
  "relative:alias": (ip, opts) =>
    convertImportPathRelativeToAlias(
      ip,
      opts.sourceFile,
      opts.baseDir,
      opts.aliasPrefix,
    ),
  "relative:module": (ip, opts) =>
    convertImportPathRelativeToModule(
      ip,
      opts.sourceFile,
      opts.libs,
      opts.currentLibName,
    ),
  "absolute:relative": (ip, opts) =>
    convertImportPathAbsoluteToRelative(ip, opts.sourceFile),
  "absolute:alias": (ip, opts) =>
    convertImportPathAbsoluteToAlias(ip, opts.baseDir, opts.aliasPrefix),
  "absolute:module": (ip, opts) =>
    convertImportPathAbsoluteToModule(ip, opts.libs, opts.currentLibName),
  "alias:relative": (ip, opts) =>
    convertImportPathAliasToRelative(
      ip,
      opts.sourceFile,
      opts.baseDir,
      opts.aliasPrefix,
    ),
  "alias:absolute": (ip, opts) =>
    convertImportPathAliasToAbsolute(ip, opts.baseDir, opts.aliasPrefix),
  "alias:alias": (ip, opts) =>
    convertImportPathAliasToAlias(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.baseDir,
      opts.aliasPrefix,
    ),
  "alias:module": (ip, opts) =>
    convertImportPathAliasToModule(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.libs,
      opts.currentLibName,
    ),
  "module:relative": (ip, opts) =>
    convertImportPathModuleToRelative(ip, opts.sourceFile, opts.libs),
  "module:absolute": (ip, opts) =>
    convertImportPathModuleToAbsolute(ip, opts.libs),
  "module:alias": (ip, opts) =>
    convertImportPathModuleToAlias(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.libs,
    ),
  "dynamic:relative": (ip, opts) =>
    convertImportPathDynamicToRelative(ip, opts.sourceFile),
  "dynamic:absolute": (ip, opts) =>
    convertImportPathDynamicToAbsolute(ip, opts.sourceFile),
  "dynamic:alias": (ip, opts) =>
    convertImportPathDynamicToAlias(
      ip,
      opts.sourceFile,
      opts.baseDir,
      opts.aliasPrefix,
    ),
  "dynamic:module": (ip, opts) =>
    convertImportPathDynamicToModule(
      ip,
      opts.sourceFile,
      opts.libs,
      opts.currentLibName,
    ),
  "bare:relative": (ip, opts) =>
    convertImportPathBareToRelative(ip, opts.sourceFile, opts.urlMap || {}),
  "bare:absolute": (ip, opts) =>
    convertImportPathBareToAbsolute(ip, opts.urlMap || {}),
  "bare:alias": (ip, opts) =>
    convertImportPathBareToAlias(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.urlMap || {},
    ),
  "bare:module": (ip, opts) =>
    convertImportPathBareToModule(
      ip,
      opts.urlMap || {},
      opts.libs,
      opts.currentLibName,
    ),
  "bare:dynamic": (ip, opts) =>
    convertImportPathBareToDynamic(ip, opts.urlMap || {}),
};

/**
 * Converts an import path from one type to another.
 */
function convertSingleImportPath(
  fromType: ImportType,
  toType: ImportType,
  importPath: string,
  options: {
    sourceFile?: string;
    baseDir?: string;
    aliasPrefix?: string;
    libs?: Record<string, LibConfig>;
    currentLibName?: string;
    urlMap?: Record<string, string>;
  } = {},
): string {
  const {
    sourceFile = "",
    baseDir = CWD,
    libs,
    currentLibName,
    urlMap = {},
  } = options;
  let normalizedAliasPrefix: string | undefined = options.aliasPrefix;
  if ((fromType === "alias" || toType === "alias") && !normalizedAliasPrefix) {
    throw new Error("aliasPrefix is required for alias path conversions");
  }
  if (normalizedAliasPrefix) {
    normalizedAliasPrefix = normalizeAliasPrefix(normalizedAliasPrefix);
  }
  const key = `${fromType}:${toType}`;
  if (conversionMapping[key]) {
    return conversionMapping[key](importPath, {
      sourceFile,
      baseDir,
      aliasPrefix: normalizedAliasPrefix || "",
      libs,
      currentLibName,
      urlMap,
    });
  }
  relinka(
    "verbose",
    `Conversion from ${fromType} to ${toType} not implemented or not needed`,
  );
  return importPath;
}

// -------------------------------------------------------------------
// File & Directory Processing
// -------------------------------------------------------------------

const STATIC_IMPORT_REGEX = /(import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function convertImportPathsInFile(
  filePath: string,
  options: {
    fromType: ImportType;
    toType: ImportType;
    baseDir?: string;
    aliasPrefix?: string;
    libs: Record<string, LibConfig>;
    currentLibName?: string;
    urlMap?: Record<string, string>;
    dryRun?: boolean;
    generateSourceMap?: boolean;
  },
): Promise<{ success: boolean; message: string }> {
  try {
    const {
      fromType,
      toType,
      baseDir = CWD,
      aliasPrefix,
      libs,
      currentLibName,
      urlMap = {},
      dryRun = false,
      generateSourceMap = false,
    } = options;
    const content = await fs.readFile(filePath, "utf-8");
    const s = new MagicString(content);

    // Process static import/export statements
    for (const match of content.matchAll(STATIC_IMPORT_REGEX)) {
      const fullMatch = match[0];
      const importPath = match[2];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;
      const convertedPath = convertSingleImportPath(
        fromType,
        toType,
        importPath,
        {
          sourceFile: filePath,
          baseDir,
          aliasPrefix,
          libs,
          currentLibName,
          urlMap,
        },
      );
      if (convertedPath !== importPath) {
        s.overwrite(startIndex, endIndex, convertedPath);
      }
    }

    // Process dynamic imports
    for (const match of content.matchAll(DYNAMIC_IMPORT_REGEX)) {
      const fullMatch = match[0];
      const importPath = match[1];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;

      if (fromType === "dynamic") {
        const dynamicConverters: Partial<
          Record<
            "relative" | "absolute" | "alias" | "module",
            (matchStr: string) => string
          >
        > = {
          absolute: (matchStr) =>
            convertImportPathDynamicToAbsolute(matchStr, filePath),
          alias: (matchStr) =>
            convertImportPathDynamicToAlias(
              matchStr,
              filePath,
              baseDir,
              aliasPrefix!,
            ),
          module: (matchStr) =>
            convertImportPathDynamicToModule(
              matchStr,
              filePath,
              libs,
              currentLibName,
            ),
          relative: (matchStr) =>
            convertImportPathDynamicToRelative(matchStr, filePath),
        };
        const converter =
          dynamicConverters[
            toType as "relative" | "absolute" | "alias" | "module"
          ];
        const convertedFullMatch = converter ? converter(fullMatch) : fullMatch;
        if (convertedFullMatch !== fullMatch) {
          s.overwrite(
            match.index,
            match.index + fullMatch.length,
            convertedFullMatch,
          );
        }
      } else {
        const convertedPath = convertSingleImportPath(
          fromType,
          toType,
          importPath,
          {
            sourceFile: filePath,
            baseDir,
            aliasPrefix,
            libs,
            currentLibName,
            urlMap,
          },
        );
        if (convertedPath !== importPath) {
          s.overwrite(startIndex, endIndex, convertedPath);
        }
      }
    }

    const newContent = s.toString();
    let map: string | undefined;
    if (generateSourceMap) {
      const sourcemap = s.generateMap({
        source: filePath,
        file: `${filePath}.map`,
        includeContent: true,
      });
      map = sourcemap.toString();
    }

    if (content !== newContent) {
      if (!dryRun) {
        await fs.writeFile(filePath, newContent, "utf-8");
        if (generateSourceMap && map) {
          await fs.writeFile(`${filePath}.map`, map, "utf-8");
        }
      }
      const message = `Updated import paths in: ${filePath}${dryRun ? " (dry run)" : ""}`;
      if (debug) {
        relinka("verbose", message);
      }
      return { success: true, message };
    }
    return { success: true, message: "No matching import paths found" };
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    return { success: false, message: errorMessage };
  }
}

async function processDirConvertImportPathsInFiles(
  dirPath: string,
  options: {
    fromType: ImportType;
    toType: ImportType;
    baseDir?: string;
    aliasPrefix?: string;
    libs: Record<string, LibConfig>;
    currentLibName?: string;
    urlMap?: Record<string, string>;
    dryRun?: boolean;
    fileExtensions?: string[];
    generateSourceMap?: boolean;
  },
): Promise<{ filePath: string; success: boolean; message: string }[]> {
  const results: { filePath: string; success: boolean; message: string }[] = [];
  const { fileExtensions = [".ts", ".tsx", ".js", ".jsx"] } = options;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const directoryEntries = entries.filter((entry) => entry.isDirectory());
    const fileEntries = entries.filter(
      (entry) =>
        entry.isFile() &&
        fileExtensions.some((ext) =>
          path.join(dirPath, entry.name).endsWith(ext),
        ),
    );
    const subDirResults = await pMap(
      directoryEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        return await processDirConvertImportPathsInFiles(fullPath, options);
      },
      { concurrency: 5 },
    );
    results.push(...subDirResults.flat());
    const fileResults = await pMap(
      fileEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const result = await convertImportPathsInFile(fullPath, options);
        return {
          filePath: fullPath,
          success: result.success,
          message: result.message,
        };
      },
      { concurrency: 5 },
    );
    results.push(...fileResults);
    return results;
  } catch (error) {
    const errorMessage = `Error processing directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    results.push({ filePath: dirPath, success: false, message: errorMessage });
    return results;
  }
}

// -------------------------------------------------------------------
// JS to TS Extension Conversion
// -------------------------------------------------------------------

function replaceJsExtension(importPath: string): string {
  return importPath.endsWith(".js")
    ? `${importPath.slice(0, -3)}.ts`
    : importPath;
}

async function convertImportExtensionsJsToTsInFile(
  filePath: string,
  options?: { dryRun?: boolean; generateSourceMap?: boolean },
): Promise<{ success: boolean; message: string }> {
  try {
    const { dryRun = false, generateSourceMap = false } = options || {};
    const content = await fs.readFile(filePath, "utf-8");
    const s = new MagicString(content);

    for (const match of content.matchAll(STATIC_IMPORT_REGEX)) {
      const fullMatch = match[0];
      const importPath = match[2];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;
      const replaced = replaceJsExtension(importPath);
      if (replaced !== importPath) {
        s.overwrite(startIndex, endIndex, replaced);
      }
    }

    for (const match of content.matchAll(DYNAMIC_IMPORT_REGEX)) {
      const fullMatch = match[0];
      const importPath = match[1];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;
      const replaced = replaceJsExtension(importPath);
      if (replaced !== importPath) {
        s.overwrite(startIndex, endIndex, replaced);
      }
    }

    const newContent = s.toString();
    let map: string | undefined;
    if (generateSourceMap) {
      const sourcemap = s.generateMap({
        source: filePath,
        file: `${filePath}.map`,
        includeContent: true,
      });
      map = sourcemap.toString();
    }

    if (content !== newContent) {
      if (!dryRun) {
        await fs.writeFile(filePath, newContent, "utf-8");
        if (generateSourceMap && map) {
          await fs.writeFile(`${filePath}.map`, map, "utf-8");
        }
      }
      const message = `Replaced .js with .ts in import paths for: ${filePath}${dryRun ? " (dry run)" : ""}`;
      return { success: true, message };
    }
    return {
      success: true,
      message: "No .js extension found in import paths",
    };
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    return { success: false, message: errorMessage };
  }
}

export async function convertImportExtensionsJsToTs(
  dirPath: string,
  options?: {
    dryRun?: boolean;
    generateSourceMap?: boolean;
    fileExtensions?: string[];
  },
): Promise<{ filePath: string; success: boolean; message: string }[]> {
  const results: { filePath: string; success: boolean; message: string }[] = [];
  const { fileExtensions = [".ts", ".tsx", ".js", ".jsx"] } = options || {};
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const directoryEntries = entries.filter((entry) => entry.isDirectory());
    const fileEntries = entries.filter(
      (entry) =>
        entry.isFile() &&
        fileExtensions.some((ext) =>
          path.join(dirPath, entry.name).endsWith(ext),
        ),
    );
    const subDirResults = await pMap(
      directoryEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        return await convertImportExtensionsJsToTs(fullPath, options);
      },
      { concurrency: 5 },
    );
    results.push(...subDirResults.flat());
    const fileResults = await pMap(
      fileEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const result = await convertImportExtensionsJsToTsInFile(
          fullPath,
          options,
        );
        return {
          filePath: fullPath,
          success: result.success,
          message: result.message,
        };
      },
      { concurrency: 5 },
    );
    results.push(...fileResults);
    return results;
  } catch (error) {
    const errorMessage = `Error processing directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    results.push({ filePath: dirPath, success: false, message: errorMessage });
    return results;
  }
}

export async function convertImportPaths(options: {
  baseDir: string;
  fromType: ImportType;
  toType: ImportType;
  aliasPrefix?: string;
  libs: Record<string, LibConfig>;
  currentLibName?: string;
  urlMap?: Record<string, string>;
  dryRun?: boolean;
  fileExtensions?: string[];
  generateSourceMap?: boolean;
}): Promise<{ filePath: string; success: boolean; message: string }[]> {
  const normalizedBaseDirPath = options.baseDir.replace(/\\/g, "/");
  const baseDir = path.isAbsolute(normalizedBaseDirPath)
    ? normalizedBaseDirPath
    : path.join(CWD, normalizedBaseDirPath);

  if (
    (options.fromType === "alias" || options.toType === "alias") &&
    !options.aliasPrefix
  ) {
    throw new Error("aliasPrefix is required for alias path conversions");
  }
  const aliasPrefix = options.aliasPrefix
    ? normalizeAliasPrefix(options.aliasPrefix)
    : undefined;

  try {
    const stats = await fs.stat(baseDir);
    if (!stats.isDirectory()) {
      throw new Error(`Path exists but is not a directory: ${baseDir}`);
    }
  } catch (_error) {
    throw new Error(
      `Directory does not exist or cannot be accessed: ${baseDir}`,
    );
  }

  relinka("info", `Starting path replacement in ${baseDir} folder...`);
  const modifiedOptions = {
    ...options,
    baseDir,
    aliasPrefix,
    libs: options.libs,
  };
  const results = await processDirConvertImportPathsInFiles(
    baseDir,
    modifiedOptions,
  );

  for (const result of results) {
    if (!result.success) {
      relinka("error", result.message);
    }
  }
  return results;
}
