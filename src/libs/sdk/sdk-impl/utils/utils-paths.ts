import fs from "fs-extra";
import MagicString from "magic-string";
import pMap from "p-map";
import path from "pathe";

import type { LibConfig } from "~/libs/sdk/sdk-types.js";

import { relinka } from "~/libs/sdk/sdk-impl/utils/utils-logs.js";

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

type ConversionOptions = {
  aliasPrefix: string;
  baseDir: string;
  currentLibName?: string;
  libsList: Record<string, LibConfig>;
  sourceFile: string;
  urlMap?: Record<string, string>;
};

type ConverterFunction = (
  importPath: string,
  opts: ConversionOptions,
) => string;

// -------------------------------------------------------------------
// Helper Functions & Utilities
// -------------------------------------------------------------------

type fromToName =
  | "absolute:alias"
  | "absolute:bare"
  | "absolute:module"
  | "absolute:relative"
  | "alias:absolute"
  | "alias:alias"
  | "alias:bare"
  | "alias:module"
  | "alias:relative"
  | "bare:absolute"
  | "bare:alias"
  | "bare:dynamic"
  | "bare:module"
  | "bare:relative"
  | "dynamic:absolute"
  | "dynamic:alias"
  | "dynamic:bare"
  | "dynamic:module"
  | "dynamic:relative"
  | "module:absolute"
  | "module:alias"
  | "module:bare"
  | "module:relative"
  | "relative:absolute"
  | "relative:alias"
  | "relative:bare"
  | "relative:module";

type ImportType =
  | "absolute"
  | "alias"
  | "bare"
  | "dynamic"
  | "module"
  | "relative";

/**
 * Extracts the package name from an import path.
 */
export function extractPackageName(
  importPath: string | undefined,
): null | string {
  relinka("commonVerbose", `Extracting package name from: ${importPath}`);
  if (!importPath || importPath.startsWith(".")) return null;
  const parts = importPath.split("/");
  if (importPath.startsWith("@") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] || null;
}

/**
 * Normalizes quotes in a string.
 */
export function normalizeQuotes(str: string): string {
  return str.replace(/['"]/g, '"');
}

function convertAbsoluteToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const relativePath = path.relative(baseDir, importPath).replace(/\\/g, "/");
  return `${aliasPrefix}${relativePath}`;
}

function convertAbsoluteToBare(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const relativePath = path.relative(baseDir, importPath).replace(/\\/g, "/");
  return `${aliasPrefix}${relativePath}`;
}

function convertAbsoluteToModule(
  importPath: string,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!libsList) return importPath;
  const relativeToRoot = path.relative(CWD, importPath);
  const libName = matchLibraryImport(relativeToRoot, libsList, currentLibName);
  if (libName) {
    relinka(
      "commonVerbose",
      `Converting absolute import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

function convertAbsoluteToRelative(
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

// -------------------------------------------------------------------
// Relative Path Conversions
// -------------------------------------------------------------------

function convertAliasToAbsolute(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) return importPath;
  const subPath = importPath.slice(aliasPrefix.length);
  return path.join(baseDir, subPath);
}

function convertAliasToAlias(
  importPath: string,
  fromBaseDir: string,
  fromAliasPrefix: string,
  toBaseDir: string,
  toAliasPrefix: string,
): string {
  if (!importPath.startsWith(fromAliasPrefix)) return importPath;
  const absolutePath = convertAliasToAbsolute(
    importPath,
    fromBaseDir,
    fromAliasPrefix,
  );
  return convertAbsoluteToAlias(absolutePath, toBaseDir, toAliasPrefix);
}

// alias:bare
function convertAliasToBare(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) return importPath;
  const subPath = importPath.slice(aliasPrefix.length);
  const absolutePath = path.join(baseDir, subPath);
  const relativePath = path.relative(CWD, absolutePath).replace(/\\/g, "/");
  return relativePath;
}

function convertAliasToModule(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!importPath.startsWith(aliasPrefix) || !libsList) return importPath;
  const absolutePath = convertAliasToAbsolute(importPath, baseDir, aliasPrefix);
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libsList, currentLibName);
  return libName || importPath;
}

// -------------------------------------------------------------------
// Absolute Path Conversions
// -------------------------------------------------------------------

function convertAliasToRelative(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) return importPath;
  const subPath = importPath.slice(aliasPrefix.length);
  const transpileTargetPath = path.join(baseDir, subPath);
  return convertAbsoluteToRelative(transpileTargetPath, sourceFile);
}

function convertBareToAbsolute(
  importPath: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("commonVerbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  return importPath.replace(url, absolutePath);
}

function convertBareToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("commonVerbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  const aliasPath = convertAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
  return importPath.replace(url, aliasPath);
}

// -------------------------------------------------------------------
// Alias Path Conversions
// -------------------------------------------------------------------

function convertBareToDynamic(
  importPath: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath, true);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("commonVerbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  return importPath.replace(
    /from\s+(['"])(https?:\/\/[^'"]+)\1/,
    `= await import($1${localPath}$1)`,
  );
}

function convertBareToModule(
  importPath: string,
  urlMap: Record<string, string>,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  const url = getBareImportUrl(importPath);
  if (!url || !libsList) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("commonVerbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(CWD, localPath);
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libsList, currentLibName);
  if (libName) {
    relinka(
      "commonVerbose",
      `Converting bare import to module: ${url} -> ${libName}`,
    );
    return importPath.replace(url, libName);
  }
  return importPath;
}

function convertBareToRelative(
  importPath: string,
  sourceFile: string,
  urlMap: Record<string, string>,
): string {
  const url = getBareImportUrl(importPath);
  if (!url) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("commonVerbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absoluteLocalPath = path.resolve(CWD, localPath);
  const relativePath = convertAbsoluteToRelative(absoluteLocalPath, sourceFile);
  return importPath.replace(url, relativePath);
}

function convertDynamicToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const convertedPath = path.resolve(path.dirname(sourceFile), dynamicPath);
  return importPath.replace(dynamicPath, convertedPath);
}

function convertDynamicToAlias(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const convertedPath = convertAbsoluteToAlias(
    absolutePath,
    baseDir,
    aliasPrefix,
  );
  return importPath.replace(dynamicPath, convertedPath);
}

// -------------------------------------------------------------------
// Module Path Conversions
// -------------------------------------------------------------------

// dynamic:bare
function convertDynamicToBare(importPath: string, sourceFile: string): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const relativePath = path.relative(CWD, absolutePath).replace(/\\/g, "/");
  return importPath.replace(dynamicPath, relativePath);
}

function convertDynamicToModule(
  importPath: string,
  sourceFile: string,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath || !libsList) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const relativeToRoot = path.relative(CWD, absolutePath);
  const libName = matchLibraryImport(relativeToRoot, libsList, currentLibName);
  if (libName) {
    relinka(
      "commonVerbose",
      `Converting dynamic import to module: ${dynamicPath} -> ${libName}`,
    );
    return importPath.replace(dynamicPath, libName);
  }
  return importPath;
}

function convertDynamicToRelative(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const convertedPath = convertAbsoluteToRelative(absolutePath, sourceFile);
  return importPath.replace(dynamicPath, convertedPath);
}

// -------------------------------------------------------------------
// Dynamic Import Conversions
// -------------------------------------------------------------------

function convertModuleToAbsolute(
  importPath: string,
  libsList: Record<string, LibConfig>,
): string {
  if (!libsList || !extractPackageName(importPath)) return importPath;
  const packageName = extractPackageName(importPath);
  if (!packageName || !libsList[packageName]) return importPath;
  const libConfig = libsList[packageName];
  const libMainDir = path.dirname(libConfig.libMainFile);
  return path.join(CWD, libMainDir);
}

function convertModuleToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  libsList: Record<string, LibConfig>,
): string {
  if (!libsList || !extractPackageName(importPath)) return importPath;
  const absolutePath = convertModuleToAbsolute(importPath, libsList);
  return convertAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
}

// module:bare
function convertModuleToBare(
  importPath: string,
  libsList: Record<string, LibConfig>,
): string {
  const packageName = extractPackageName(importPath);
  if (!packageName || !libsList[packageName]) return importPath;
  const libConfig = libsList[packageName];
  const libMainDir = path.dirname(libConfig.libMainFile);
  const absolutePath = path.join(CWD, libMainDir);
  const relativePath = path.relative(CWD, absolutePath).replace(/\\/g, "/");
  return relativePath;
}

function convertModuleToRelative(
  importPath: string,
  sourceFile: string,
  libsList: Record<string, LibConfig>,
): string {
  if (!libsList || !extractPackageName(importPath)) return importPath;
  const packageName = extractPackageName(importPath);
  if (!packageName || !libsList[packageName]) return importPath;
  const libConfig = libsList[packageName];
  const libMainDir = path.dirname(libConfig.libMainFile);
  const libMainPath = path.join(CWD, libMainDir);
  return convertAbsoluteToRelative(libMainPath, sourceFile);
}

function convertRelativeToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  return path.resolve(path.dirname(sourceFile), importPath);
}

// -------------------------------------------------------------------
// Bare Import Conversions
// -------------------------------------------------------------------

function convertRelativeToAlias(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const absolutePath = convertRelativeToAbsolute(importPath, sourceFile);
  return convertAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
}

// relative:bare
function convertRelativeToBare(importPath: string, sourceFile: string): string {
  const absolutePath = path.resolve(path.dirname(sourceFile), importPath);
  const relativePath = path.relative(CWD, absolutePath).replace(/\\/g, "/");
  return relativePath;
}

// relative:module
function convertRelativeToModule(
  importPath: string,
  sourceFile: string,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): string {
  if (!libsList) return importPath;
  const absoluteImportPath = path.resolve(path.dirname(sourceFile), importPath);
  const relativeToRoot = path.relative(CWD, absoluteImportPath);
  const libName = matchLibraryImport(relativeToRoot, libsList, currentLibName);
  if (libName) {
    relinka(
      "commonVerbose",
      `Converting relative import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

/**
 * Extracts a bare import URL from the given string.
 */
function getBareImportUrl(importStr: string, withFrom = false): null | string {
  const regex = withFrom
    ? /from\s+(['"])(https?:\/\/[^'"]+)\1/
    : /(['"])(https?:\/\/[^'"]+)\1/;
  const match = regex.exec(importStr);
  return match ? match[2] : null;
}

/**
 * Extracts the inner path from a dynamic import statement.
 */
function getDynamicImportPath(importStr: string): null | string {
  const match = /import\s*\(\s*(['"])(.*?)\1\s*\)/.exec(importStr);
  return match ? match[2] : null;
}

/**
 * Checks if an import path belongs to a library.
 */
function isLibraryImport(
  importPath: string,
  libName: string,
  libConfig: { libMainFile: string },
  currentLibName?: string,
): boolean {
  if (currentLibName && libName === currentLibName) {
    return false;
  }
  const libDirPath = path.dirname(libConfig.libMainFile);
  return (
    importPath.startsWith(libDirPath) ||
    importPath.includes(`/${path.basename(libDirPath)}/`) ||
    path.basename(path.dirname(importPath)) === path.basename(libDirPath)
  );
}

// -------------------------------------------------------------------
// Conversion Mapping & Main Conversion Function
// -------------------------------------------------------------------

/**
 * Matches a relative path to a library from the config.
 */
function matchLibraryImport(
  relativeToRoot: string,
  libsList: Record<string, LibConfig>,
  currentLibName?: string,
): null | string {
  for (const [libName, libConfig] of Object.entries(libsList)) {
    if (isLibraryImport(relativeToRoot, libName, libConfig, currentLibName)) {
      return libName;
    }
  }
  return null;
}

/**
 * Normalizes the alias prefix so that it always ends with a "/".
 */
function normalizeAliasPrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

const conversionMapping: Record<fromToName, ConverterFunction> = {
  "absolute:alias": (ip, opts) =>
    convertAbsoluteToAlias(ip, opts.baseDir, opts.aliasPrefix),
  "absolute:bare": (ip, opts) =>
    convertAbsoluteToBare(ip, opts.baseDir, opts.aliasPrefix),
  "absolute:module": (ip, opts) =>
    convertAbsoluteToModule(ip, opts.libsList, opts.currentLibName),
  "absolute:relative": (ip, opts) =>
    convertAbsoluteToRelative(ip, opts.sourceFile),
  "alias:absolute": (ip, opts) =>
    convertAliasToAbsolute(ip, opts.baseDir, opts.aliasPrefix),
  "alias:alias": (ip, opts) =>
    convertAliasToAlias(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.baseDir,
      opts.aliasPrefix,
    ),
  "alias:bare": (ip, opts) =>
    convertAliasToBare(ip, opts.baseDir, opts.aliasPrefix),
  "alias:module": (ip, opts) =>
    convertAliasToModule(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.libsList,
      opts.currentLibName,
    ),
  "alias:relative": (ip, opts) =>
    convertAliasToRelative(ip, opts.sourceFile, opts.baseDir, opts.aliasPrefix),
  "bare:absolute": (ip, opts) => convertBareToAbsolute(ip, opts.urlMap || {}),
  "bare:alias": (ip, opts) =>
    convertBareToAlias(ip, opts.baseDir, opts.aliasPrefix, opts.urlMap || {}),
  "bare:dynamic": (ip, opts) => convertBareToDynamic(ip, opts.urlMap || {}),
  "bare:module": (ip, opts) =>
    convertBareToModule(
      ip,
      opts.urlMap || {},
      opts.libsList,
      opts.currentLibName,
    ),
  "bare:relative": (ip, opts) =>
    convertBareToRelative(ip, opts.sourceFile, opts.urlMap || {}),
  "dynamic:absolute": (ip, opts) =>
    convertDynamicToAbsolute(ip, opts.sourceFile),
  "dynamic:alias": (ip, opts) =>
    convertDynamicToAlias(ip, opts.sourceFile, opts.baseDir, opts.aliasPrefix),
  "dynamic:bare": (ip, opts) => convertDynamicToBare(ip, opts.sourceFile),
  "dynamic:module": (ip, opts) =>
    convertDynamicToModule(
      ip,
      opts.sourceFile,
      opts.libsList,
      opts.currentLibName,
    ),
  "dynamic:relative": (ip, opts) =>
    convertDynamicToRelative(ip, opts.sourceFile),
  "module:absolute": (ip, opts) => convertModuleToAbsolute(ip, opts.libsList),
  "module:alias": (ip, opts) =>
    convertModuleToAlias(ip, opts.baseDir, opts.aliasPrefix, opts.libsList),
  "module:bare": (ip, opts) => convertModuleToBare(ip, opts.libsList),
  "module:relative": (ip, opts) =>
    convertModuleToRelative(ip, opts.sourceFile, opts.libsList),
  "relative:absolute": (ip, opts) =>
    convertRelativeToAbsolute(ip, opts.sourceFile),
  "relative:alias": (ip, opts) =>
    convertRelativeToAlias(ip, opts.sourceFile, opts.baseDir, opts.aliasPrefix),
  "relative:bare": (ip, opts) => convertRelativeToBare(ip, opts.sourceFile),
  "relative:module": (ip, opts) =>
    convertRelativeToModule(
      ip,
      opts.sourceFile,
      opts.libsList,
      opts.currentLibName,
    ),
};

/**
 * Converts an import path from one type to another.
 */
function convertSingleImportPath(
  fromType: ImportType,
  toType: ImportType,
  importPath: string,
  options: {
    aliasPrefix?: string;
    baseDir?: string;
    currentLibName?: string;
    libsList?: Record<string, LibConfig>;
    sourceFile?: string;
    urlMap?: Record<string, string>;
  } = {},
): string {
  const {
    baseDir = CWD,
    currentLibName,
    libsList,
    sourceFile = "",
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
      aliasPrefix: normalizedAliasPrefix || "",
      baseDir,
      currentLibName,
      libsList,
      sourceFile,
      urlMap,
    });
  }
  relinka(
    "commonVerbose",
    `Conversion from ${fromType} to ${toType} not implemented or not needed`,
  );
  return importPath;
}

// -------------------------------------------------------------------
// File & Directory Processing
// -------------------------------------------------------------------

const STATIC_IMPORT_REGEX = /(import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export async function convertImportExtensionsJsToTs(
  dirPath: string,
  options?: {
    distJsrDryRun?: boolean;
    fileExtensions?: string[];
    generateSourceMap?: boolean;
  },
): Promise<{ filePath: string; message: string; success: boolean }[]> {
  const results: { filePath: string; message: string; success: boolean }[] = [];
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
          message: result.message,
          success: result.success,
        };
      },
      { concurrency: 5 },
    );
    results.push(...fileResults);
    return results;
  } catch (error) {
    const errorMessage = `Error processing directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    results.push({ filePath: dirPath, message: errorMessage, success: false });
    return results;
  }
}

export async function convertImportPaths(options: {
  aliasPrefix?: string;
  baseDir: string;
  currentLibName?: string;
  distJsrDryRun?: boolean;
  fileExtensions?: string[];
  fromType: ImportType;
  generateSourceMap?: boolean;
  libsList: Record<string, LibConfig>;
  toType: ImportType;
  urlMap?: Record<string, string>;
}): Promise<{ filePath: string; message: string; success: boolean }[]> {
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
    aliasPrefix,
    baseDir,
    libsList: options.libsList,
  };
  const results = await processDirconvertsInFiles(baseDir, modifiedOptions);

  for (const result of results) {
    if (!result.success) {
      relinka("error", result.message);
    }
  }
  return results;
}

// -------------------------------------------------------------------
// JS to TS Extension Conversion
// -------------------------------------------------------------------

async function convertImportExtensionsJsToTsInFile(
  filePath: string,
  options?: { distJsrDryRun?: boolean; generateSourceMap?: boolean },
): Promise<{ message: string; success: boolean }> {
  try {
    const { distJsrDryRun = false, generateSourceMap = false } = options || {};
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
      const transpileSourcemap = s.generateMap({
        file: `${filePath}.map`,
        includeContent: true,
        source: filePath,
      });
      map = transpileSourcemap.toString();
    }

    if (content !== newContent) {
      if (!distJsrDryRun) {
        await fs.writeFile(filePath, newContent, "utf-8");
        if (generateSourceMap && map) {
          await fs.writeFile(`${filePath}.map`, map, "utf-8");
        }
      }
      const message = `Replaced .js with .ts in import paths for: ${filePath}${distJsrDryRun ? " (dry run)" : ""}`;
      return { message, success: true };
    }
    return {
      message: "No .js extension found in import paths",
      success: true,
    };
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    return { message: errorMessage, success: false };
  }
}

async function convertsInFile(
  filePath: string,
  options: {
    aliasPrefix?: string;
    baseDir?: string;
    currentLibName?: string;
    distJsrDryRun?: boolean;
    fromType: ImportType;
    generateSourceMap?: boolean;
    libsList: Record<string, LibConfig>;
    toType: ImportType;
    urlMap?: Record<string, string>;
  },
): Promise<{ message: string; success: boolean }> {
  try {
    const {
      aliasPrefix,
      baseDir = CWD,
      currentLibName,
      distJsrDryRun = false,
      fromType,
      generateSourceMap = false,
      libsList,
      toType,
      urlMap = {},
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
          aliasPrefix,
          baseDir,
          currentLibName,
          libsList,
          sourceFile: filePath,
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
            "absolute" | "alias" | "module" | "relative",
            (matchStr: string) => string
          >
        > = {
          absolute: (matchStr) => convertDynamicToAbsolute(matchStr, filePath),
          alias: (matchStr) =>
            convertDynamicToAlias(matchStr, filePath, baseDir, aliasPrefix!),
          module: (matchStr) =>
            convertDynamicToModule(
              matchStr,
              filePath,
              libsList,
              currentLibName,
            ),
          relative: (matchStr) => convertDynamicToRelative(matchStr, filePath),
        };
        const converter =
          dynamicConverters[
            toType as "absolute" | "alias" | "module" | "relative"
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
            aliasPrefix,
            baseDir,
            currentLibName,
            libsList,
            sourceFile: filePath,
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
      const transpileSourcemap = s.generateMap({
        file: `${filePath}.map`,
        includeContent: true,
        source: filePath,
      });
      map = transpileSourcemap.toString();
    }

    if (content !== newContent) {
      if (!distJsrDryRun) {
        await fs.writeFile(filePath, newContent, "utf-8");
        if (generateSourceMap && map) {
          await fs.writeFile(`${filePath}.map`, map, "utf-8");
        }
      }
      const message = `Updated import paths in: ${filePath}${distJsrDryRun ? " (dry run)" : ""}`;
      if (debug) {
        relinka("commonVerbose", message);
      }
      return { message, success: true };
    }
    return { message: "No matching import paths found", success: true };
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    return { message: errorMessage, success: false };
  }
}

async function processDirconvertsInFiles(
  dirPath: string,
  options: {
    aliasPrefix?: string;
    baseDir?: string;
    currentLibName?: string;
    distJsrDryRun?: boolean;
    fileExtensions?: string[];
    fromType: ImportType;
    generateSourceMap?: boolean;
    libsList: Record<string, LibConfig>;
    toType: ImportType;
    urlMap?: Record<string, string>;
  },
): Promise<{ filePath: string; message: string; success: boolean }[]> {
  const results: { filePath: string; message: string; success: boolean }[] = [];
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
        return await processDirconvertsInFiles(fullPath, options);
      },
      { concurrency: 5 },
    );
    results.push(...subDirResults.flat());
    const fileResults = await pMap(
      fileEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const result = await convertsInFile(fullPath, options);
        return {
          filePath: fullPath,
          message: result.message,
          success: result.success,
        };
      },
      { concurrency: 5 },
    );
    results.push(...fileResults);
    return results;
  } catch (error) {
    const errorMessage = `Error processing directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    results.push({ filePath: dirPath, message: errorMessage, success: false });
    return results;
  }
}

function replaceJsExtension(importPath: string): string {
  return importPath.endsWith(".js")
    ? `${importPath.slice(0, -3)}.ts`
    : importPath;
}
