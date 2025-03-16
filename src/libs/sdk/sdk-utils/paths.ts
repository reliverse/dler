import fs from "fs-extra";
import MagicString from "magic-string";
import pMap from "p-map";
import path from "pathe";

import type { BuildPublishConfig } from "~/types.js";

import { relinka } from "~/utils.js";

/* =======================================================================
   Helper Interfaces & Functions
   ======================================================================= */

type ConversionOptions = {
  sourceFile: string;
  baseDir: string;
  aliasPrefix: string;
  config?: BuildPublishConfig;
  currentLibName?: string;
  urlMap?: Record<string, string>;
};

/**
 * Normalizes the alias prefix so that it always ends with a "/".
 * @example
 * normalizeAliasPrefix("~") // returns "~/"
 * normalizeAliasPrefix("~/") // returns "~/"
 */
function normalizeAliasPrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : prefix + "/";
}

/**
 * Normalizes quotes in a string.
 * @example
 * normalizeQuotes("'foo'") // returns '"foo"'
 * normalizeQuotes('"foo"') // returns '"foo"'
 */
export function normalizeQuotes(str: string): string {
  return str.replace(/['"]/g, '"');
}

/**
 * Extracts the package name from an import path.
 * @example
 * // Returns "react"
 * extractPackageName("react");
 *
 * // Returns "@babel/core"
 * extractPackageName("@babel/core");
 *
 * // Returns null for relative paths
 * extractPackageName("./localModule");
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
 * Helper function to check if an import path belongs to a library.
 * @example
 * // Assuming libConfig.main is "lib/index.js"
 * // Returns true if importPath starts with the library directory.
 * isLibraryImport("lib/foo", "lib", { main: "lib/index.js" });
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
 * Checks the provided relative path against all libraries in the config.
 * Returns the matching library name or null if none match.
 * @example
 * // If config.libs contains a key "ui" and the relativeToRoot matches it,
 * // matchLibraryImport("./ui/button", config) might return "ui".
 * matchLibraryImport("./ui/button", config);
 */
function matchLibraryImport(
  relativeToRoot: string,
  config: BuildPublishConfig,
  currentLibName?: string,
): string | null {
  for (const [libName, libConfig] of Object.entries(config.libs)) {
    if (isLibraryImport(relativeToRoot, libName, libConfig, currentLibName)) {
      return libName;
    }
  }
  return null;
}

/**
 * Extracts the inner path from a dynamic import statement.
 * Example: given 'import("./myPath")', returns './myPath'.
 * Also handles 'await import("./myPath")' syntax.
 * @example
 * getDynamicImportPath('import("./module")'); // returns "./module"
 */
function getDynamicImportPath(importStr: string): string | null {
  const match = /import\s*\(\s*(['"])(.*?)\1\s*\)/.exec(importStr);
  return match ? match[2] : null;
}

/**
 * Extracts a bare import URL from the given string.
 * If withFrom is true, uses the regex that matches the "from" syntax.
 * @example
 * // Returns "https://example.com/script.js"
 * getBareImportUrl('"https://example.com/script.js"');
 *
 * // Returns "https://example.com/script.js" when using "from" syntax
 * getBareImportUrl("from 'https://example.com/script.js'", true);
 */
function getBareImportUrl(importStr: string, withFrom = false): string | null {
  const regex = withFrom
    ? /from\s+(['"])(https?:\/\/[^'"]+)\1/
    : /(['"])(https?:\/\/[^'"]+)\1/;
  const match = regex.exec(importStr);
  return match ? match[2] : null;
}

/* =======================================================================
   Relative Path Conversions
   ======================================================================= */

/**
 * Converts a relative import path to an absolute path.
 * @example
 * // If sourceFile is "C:/project/src/app.js", then "./foo" might resolve to "C:/project/src/foo"
 * convertImportPathRelativeToAbsolute("./foo", "C:/project/src/app.js");
 */
function convertImportPathRelativeToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  return path.resolve(path.dirname(sourceFile), importPath);
}

/**
 * Converts a relative import path to an alias path.
 * @example
 * // If sourceFile is "src/app.js", baseDir is "src", and aliasPrefix is "~/",
 * // then "./utils" becomes "~/utils"
 * convertImportPathRelativeToAlias("./utils", "src/app.js", "src", "~/");
 */
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

/**
 * Converts a relative import path to a module import.
 * @example
 * // If a relative import in "src/app.js" matches a library defined in config.libs,
 * // this function might convert "./components/Button" to "ui"
 * convertImportPathRelativeToModule("./components/Button", "src/app.js", config);
 */
function convertImportPathRelativeToModule(
  importPath: string,
  sourceFile: string,
  config?: BuildPublishConfig,
  currentLibName?: string,
): string {
  if (!config?.libs) {
    return importPath;
  }
  const absoluteImportPath = path.resolve(path.dirname(sourceFile), importPath);
  const relativeToRoot = path.relative(process.cwd(), absoluteImportPath);
  const libName = matchLibraryImport(relativeToRoot, config, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting relative import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

/* =======================================================================
   Absolute Path Conversions
   ======================================================================= */

/**
 * Converts an absolute import path to a relative path.
 * @example
 * // Given absolute import "C:/project/src/utils" and sourceFile "C:/project/src/app.js",
 * // this might return "./utils"
 * convertImportPathAbsoluteToRelative("C:/project/src/utils", "C:/project/src/app.js");
 */
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

/**
 * Converts an absolute import path to an alias path.
 * @example
 * // With baseDir "src" and aliasPrefix "~/", "src/utils" becomes "~/utils"
 * convertImportPathAbsoluteToAlias("src/utils", "src", "~/");
 */
function convertImportPathAbsoluteToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  const relativePath = path.relative(baseDir, importPath).replace(/\\/g, "/");
  return `${aliasPrefix}${relativePath}`;
}

/**
 * Converts an absolute import path to a module import.
 * @example
 * // If the absolute path "src/ui" matches a library in config, it might be converted to "ui"
 * convertImportPathAbsoluteToModule("src/ui", config);
 */
function convertImportPathAbsoluteToModule(
  importPath: string,
  config?: BuildPublishConfig,
  currentLibName?: string,
): string {
  if (!config?.libs) {
    return importPath;
  }
  const relativeToRoot = path.relative(process.cwd(), importPath);
  const libName = matchLibraryImport(relativeToRoot, config, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting absolute import to module: ${importPath} -> ${libName}`,
    );
    return libName;
  }
  return importPath;
}

/* =======================================================================
   Alias Path Conversions
   ======================================================================= */

/**
 * Converts an alias import path to a relative path.
 * @example
 * // If file "src/app.js" contains import "~/utils", with baseDir "src" and aliasPrefix "~/",
 * // it converts to "./utils"
 * convertImportPathAliasToRelative("~/utils", "src/app.js", "src", "~/");
 */
function convertImportPathAliasToRelative(
  importPath: string,
  sourceFile: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) {
    return importPath;
  }
  const subPath = importPath.slice(aliasPrefix.length);
  const targetPath = path.join(baseDir, subPath);
  return convertImportPathAbsoluteToRelative(targetPath, sourceFile);
}

/**
 * Converts an alias import path to an absolute path.
 * @example
 * // Converts "~/utils" to "src/utils" if baseDir is "src" and aliasPrefix is "~/"
 * convertImportPathAliasToAbsolute("~/utils", "src", "~/");
 */
function convertImportPathAliasToAbsolute(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
): string {
  if (!importPath.startsWith(aliasPrefix)) {
    return importPath;
  }
  const subPath = importPath.slice(aliasPrefix.length);
  return path.join(baseDir, subPath);
}

/**
 * Converts an alias import path to a module import.
 * @example
 * // If "~/ui" should be converted to a module name based on config, it returns the module name.
 * convertImportPathAliasToModule("~/ui", "src", "~/", config);
 */
function convertImportPathAliasToModule(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  config?: BuildPublishConfig,
  currentLibName?: string,
): string {
  if (!importPath.startsWith(aliasPrefix) || !config?.libs) {
    return importPath;
  }
  const absolutePath = convertImportPathAliasToAbsolute(
    importPath,
    baseDir,
    aliasPrefix,
  );
  const relativeToRoot = path.relative(process.cwd(), absolutePath);
  const libName = matchLibraryImport(relativeToRoot, config, currentLibName);
  if (libName) {
    return libName;
  }
  return importPath;
}

/**
 * Converts an alias import path to a different alias format.
 * @example
 * // Converts "~/utils" from one alias format to another; here both formats are the same.
 * convertImportPathAliasToAlias("~/utils", "src", "~/", "src", "~/");
 */
function convertImportPathAliasToAlias(
  importPath: string,
  fromBaseDir: string,
  fromAliasPrefix: string,
  toBaseDir: string,
  toAliasPrefix: string,
): string {
  if (!importPath.startsWith(fromAliasPrefix)) {
    return importPath;
  }
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

/* =======================================================================
   Module Path Conversions
   ======================================================================= */

/**
 * Converts a module import path to a relative path.
 * @example
 * // If "ui" is defined in config.libs and its main is in "src/ui/index.js",
 * // this converts "ui" to a relative path like "./ui"
 * convertImportPathModuleToRelative("ui", "src/app.js", config);
 */
function convertImportPathModuleToRelative(
  importPath: string,
  sourceFile: string,
  config?: BuildPublishConfig,
): string {
  if (!config?.libs || !extractPackageName(importPath)) {
    return importPath;
  }
  const packageName = extractPackageName(importPath);
  if (!packageName || !config.libs[packageName]) {
    return importPath;
  }
  const libConfig = config.libs[packageName];
  const libMainDir = path.dirname(libConfig.main);
  const libMainPath = path.join(process.cwd(), libMainDir);
  return convertImportPathAbsoluteToRelative(libMainPath, sourceFile);
}

/**
 * Converts a module import path to an absolute path.
 * @example
 * // Converts "ui" to an absolute path if config.libs contains it.
 * convertImportPathModuleToAbsolute("ui", config);
 */
function convertImportPathModuleToAbsolute(
  importPath: string,
  config?: BuildPublishConfig,
): string {
  if (!config?.libs || !extractPackageName(importPath)) {
    return importPath;
  }
  const packageName = extractPackageName(importPath);
  if (!packageName || !config.libs[packageName]) {
    return importPath;
  }
  const libConfig = config.libs[packageName];
  const libMainDir = path.dirname(libConfig.main);
  return path.join(process.cwd(), libMainDir);
}

/**
 * Converts a module import path to an alias path.
 * @example
 * // Converts "ui" to an alias path like "~/ui" using config.
 * convertImportPathModuleToAlias("ui", "src", "~/", config);
 */
function convertImportPathModuleToAlias(
  importPath: string,
  baseDir: string,
  aliasPrefix: string,
  config?: BuildPublishConfig,
): string {
  if (!config?.libs || !extractPackageName(importPath)) {
    return importPath;
  }
  const absolutePath = convertImportPathModuleToAbsolute(importPath, config);
  return convertImportPathAbsoluteToAlias(absolutePath, baseDir, aliasPrefix);
}

/* =======================================================================
   Dynamic Import Conversions
   ======================================================================= */

/**
 * Converts a dynamic import path from relative to absolute.
 * @example
 * // Given file "src/app.js" and dynamic import "./module", returns the absolute path.
 * convertImportPathDynamicToAbsolute('import("./module")', "src/app.js");
 */
function convertImportPathDynamicToRelative(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const convertedPath = convertImportPathAbsoluteToRelative(
    path.resolve(path.dirname(sourceFile), dynamicPath),
    sourceFile,
  );
  return importPath.replace(dynamicPath, convertedPath);
}

/**
 * Converts a dynamic import path from relative to absolute.
 * @example
 * // Converts 'import("./module")' into an absolute path import based on the file location.
 * convertImportPathDynamicToAbsolute('import("./module")', "src/app.js");
 */
function convertImportPathDynamicToAbsolute(
  importPath: string,
  sourceFile: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath) return importPath;
  const convertedPath = path.resolve(path.dirname(sourceFile), dynamicPath);
  return importPath.replace(dynamicPath, convertedPath);
}

/**
 * Converts a dynamic import path from relative to alias.
 * @example
 * // If baseDir is "src" and aliasPrefix is "~/", converts dynamic import to use the alias.
 * convertImportPathDynamicToAlias('import("./module")', "src/app.js", "src", "~/");
 */
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

/**
 * Converts a dynamic import path from relative to module.
 * @example
 * // Converts a dynamic import like 'import("./module")' to a module name if config matches.
 * convertImportPathDynamicToModule('import("./module")', "src/app.js", config);
 */
function convertImportPathDynamicToModule(
  importPath: string,
  sourceFile: string,
  config?: BuildPublishConfig,
  currentLibName?: string,
): string {
  const dynamicPath = getDynamicImportPath(importPath);
  if (!dynamicPath || !config?.libs) return importPath;
  const absolutePath = path.resolve(path.dirname(sourceFile), dynamicPath);
  const relativeToRoot = path.relative(process.cwd(), absolutePath);
  const libName = matchLibraryImport(relativeToRoot, config, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting dynamic import to module: ${dynamicPath} -> ${libName}`,
    );
    return importPath.replace(dynamicPath, libName);
  }
  return importPath;
}

/* =======================================================================
   Bare Import Conversions
   ======================================================================= */

/**
 * Converts a bare import path to a relative path.
 * Bare imports are URL-based imports like those used in Deno.
 * @example
 * // Given import '"https://cdn.example.com/lib.js"', with a urlMap,
 * // this function returns a relative local path if a mapping exists.
 * convertImportPathBareToRelative('"https://cdn.example.com/lib.js"', "src/app.js", { "https://cdn.example.com/lib.js": "src/lib.js" });
 */
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
  const relativePath = convertImportPathAbsoluteToRelative(
    path.resolve(process.cwd(), localPath),
    sourceFile,
  );
  return importPath.replace(url, relativePath);
}

/**
 * Converts a bare import path to an absolute path.
 * @example
 * // Converts a bare URL import into an absolute local path if mapping exists.
 * convertImportPathBareToAbsolute('"https://cdn.example.com/lib.js"', { "https://cdn.example.com/lib.js": "src/lib.js" });
 */
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
  const absolutePath = path.resolve(process.cwd(), localPath);
  return importPath.replace(url, absolutePath);
}

/**
 * Converts a bare import path to an alias path.
 * @example
 * // Converts a bare import URL to an alias path given a mapping.
 * convertImportPathBareToAlias('"https://cdn.example.com/lib.js"', "src", "~/", { "https://cdn.example.com/lib.js": "src/lib.js" });
 */
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
  const absolutePath = path.resolve(process.cwd(), localPath);
  const aliasPath = convertImportPathAbsoluteToAlias(
    absolutePath,
    baseDir,
    aliasPrefix,
  );
  return importPath.replace(url, aliasPath);
}

/**
 * Converts a bare import path to a module import.
 * @example
 * // Converts a bare URL import to a module name if config mapping exists.
 * convertImportPathBareToModule('"https://cdn.example.com/lib.js"', { "https://cdn.example.com/lib.js": "src/lib.js" }, config);
 */
function convertImportPathBareToModule(
  importPath: string,
  urlMap: Record<string, string>,
  config?: BuildPublishConfig,
  currentLibName?: string,
): string {
  const url = getBareImportUrl(importPath);
  if (!url || !config?.libs) return importPath;
  const localPath = urlMap[url];
  if (!localPath) {
    relinka("verbose", `No local mapping found for URL: ${url}`);
    return importPath;
  }
  const absolutePath = path.resolve(process.cwd(), localPath);
  const relativeToRoot = path.relative(process.cwd(), absolutePath);
  const libName = matchLibraryImport(relativeToRoot, config, currentLibName);
  if (libName) {
    relinka(
      "verbose",
      `Converting bare import to module: ${url} -> ${libName}`,
    );
    return importPath.replace(url, libName);
  }
  return importPath;
}

/**
 * Converts a bare import path to a dynamic import.
 * @example
 * // Converts a bare import with "from" syntax into a dynamic import statement.
 * convertImportPathBareToDynamic("from 'https://cdn.example.com/lib.js'", { "https://cdn.example.com/lib.js": "src/lib.js" });
 */
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

/* =======================================================================
   Conversion Mapping & Main Conversion Function
   ======================================================================= */

// Mapping from a "fromType:toType" key to the conversion function
const conversionMapping: Record<
  string,
  (importPath: string, opts: ConversionOptions) => string
> = {
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
      opts.config,
      opts.currentLibName,
    ),
  "absolute:relative": (ip, opts) =>
    convertImportPathAbsoluteToRelative(ip, opts.sourceFile),
  "absolute:alias": (ip, opts) =>
    convertImportPathAbsoluteToAlias(ip, opts.baseDir, opts.aliasPrefix),
  "absolute:module": (ip, opts) =>
    convertImportPathAbsoluteToModule(ip, opts.config, opts.currentLibName),
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
      opts.config,
      opts.currentLibName,
    ),
  "module:relative": (ip, opts) =>
    convertImportPathModuleToRelative(ip, opts.sourceFile, opts.config),
  "module:absolute": (ip, opts) =>
    convertImportPathModuleToAbsolute(ip, opts.config),
  "module:alias": (ip, opts) =>
    convertImportPathModuleToAlias(
      ip,
      opts.baseDir,
      opts.aliasPrefix,
      opts.config,
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
      opts.config,
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
      opts.config,
      opts.currentLibName,
    ),
  "bare:dynamic": (ip, opts) =>
    convertImportPathBareToDynamic(ip, opts.urlMap || {}),
};

/**
 * Converts an import path from one type to another.
 * @example
 * // Convert a relative import to an absolute path:
 * // Given file "src/app.js", converting "./utils" to absolute might yield "src/utils"
 * convertImportPath("relative", "absolute", "./utils", { sourceFile: "src/app.js" });
 *
 * // Convert a relative import to an alias:
 * // With baseDir "src" and aliasPrefix "~/", "./utils" becomes "~/utils"
 * convertImportPath("relative", "alias", "./utils", { sourceFile: "src/app.js", baseDir: "src", aliasPrefix: "~/" });
 *
 * @param fromType The type of import path to convert from
 * @param toType The type to convert to
 * @param importPath The import path to convert
 * @param options Additional options for the conversion
 * @returns The converted import path
 */
function convertImportPath(
  fromType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare",
  toType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare",
  importPath: string,
  options: {
    sourceFile?: string;
    baseDir?: string;
    aliasPrefix?: string;
    config?: BuildPublishConfig;
    currentLibName?: string;
    urlMap?: Record<string, string>;
  } = {},
): string {
  const {
    sourceFile,
    baseDir = process.cwd(),
    config,
    currentLibName,
    urlMap = {},
  } = options;
  let normalizedAliasPrefix: string | undefined = options.aliasPrefix;

  // For any conversion that involves alias paths, ensure aliasPrefix is provided
  if ((fromType === "alias" || toType === "alias") && !normalizedAliasPrefix) {
    throw new Error("aliasPrefix is required for alias path conversions");
  }
  if (normalizedAliasPrefix) {
    normalizedAliasPrefix = normalizeAliasPrefix(normalizedAliasPrefix);
  }

  const key = `${fromType}:${toType}`;
  if (conversionMapping[key]) {
    return conversionMapping[key](importPath, {
      sourceFile: sourceFile || "",
      baseDir,
      aliasPrefix: normalizedAliasPrefix || "",
      config,
      currentLibName,
      urlMap,
    });
  } else {
    relinka(
      "verbose",
      `Conversion from ${fromType} to ${toType} not implemented or not needed`,
    );
    return importPath;
  }
}

/* =======================================================================
   File & Directory Processing
   ======================================================================= */

/**
 * Processes a file to convert import paths from one type to another.
 * Uses magic-string to perform replacements and optional sourcemap generation.
 * @example
 * // Processes "src/app.js" converting relative imports to absolute ones.
 * processFile("src/app.js", { fromType: "relative", toType: "absolute", aliasPrefix: "~/" });
 *
 * @param filePath Path to the file to process
 * @param options Configuration options for the conversion
 * @returns Object containing success status and message
 */
async function processFile(
  filePath: string,
  options: {
    fromType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
    toType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
    baseDir?: string;
    aliasPrefix?: string;
    config?: BuildPublishConfig;
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
      baseDir = process.cwd(),
      aliasPrefix,
      config,
      currentLibName,
      urlMap = {},
      dryRun = false,
      generateSourceMap = false,
    } = options;

    const content = await fs.readFile(filePath, "utf-8");
    const s = new MagicString(content);

    // Process static import/export statements
    const importRegex = /(import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    for (const match of content.matchAll(importRegex)) {
      const fullMatch = match[0];
      const importPath = match[2];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;
      const convertedPath = convertImportPath(fromType, toType, importPath, {
        sourceFile: filePath,
        baseDir,
        aliasPrefix,
        config,
        currentLibName,
        urlMap,
      });
      if (convertedPath !== importPath) {
        s.overwrite(startIndex, endIndex, convertedPath);
      }
    }

    // Process dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const match of content.matchAll(dynamicImportRegex)) {
      const fullMatch = match[0];
      const importPath = match[1];
      if (typeof match.index !== "number") continue;
      const groupIndex = fullMatch.indexOf(importPath);
      const startIndex = match.index + groupIndex;
      const endIndex = startIndex + importPath.length;

      // If fromType is "dynamic", we're converting the entire dynamic import statement
      if (fromType === "dynamic") {
        let convertedFullMatch;
        if (toType === "absolute") {
          convertedFullMatch = convertImportPathDynamicToAbsolute(
            fullMatch,
            filePath,
          );
        } else if (toType === "alias") {
          convertedFullMatch = convertImportPathDynamicToAlias(
            fullMatch,
            filePath,
            baseDir,
            aliasPrefix!,
          );
        } else if (toType === "module") {
          convertedFullMatch = convertImportPathDynamicToModule(
            fullMatch,
            filePath,
            config,
            currentLibName,
          );
        } else if (toType === "relative") {
          convertedFullMatch = convertImportPathDynamicToRelative(
            fullMatch,
            filePath,
          );
        } else {
          convertedFullMatch = fullMatch;
        }

        if (convertedFullMatch !== fullMatch) {
          s.overwrite(
            match.index,
            match.index + fullMatch.length,
            convertedFullMatch,
          );
        }
      } else {
        // For other fromTypes, we're just converting the path inside the dynamic import
        const convertedPath = convertImportPath(fromType, toType, importPath, {
          sourceFile: filePath,
          baseDir,
          aliasPrefix,
          config,
          currentLibName,
          urlMap,
        });
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
        file: filePath + ".map",
        includeContent: true,
      });
      map = sourcemap.toString();
    }

    if (content !== newContent) {
      if (!dryRun) {
        await fs.writeFile(filePath, newContent, "utf-8");
        if (generateSourceMap && map) {
          await fs.writeFile(filePath + ".map", map, "utf-8");
        }
      }
      const message = `Updated import paths in: ${filePath}${dryRun ? " (dry run)" : ""}`;
      relinka("verbose", message);
      return {
        success: true,
        message,
      };
    } else {
      return {
        success: true,
        message: "No matching import paths found",
      };
    }
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    relinka("error", errorMessage);
    return {
      success: false,
      message: errorMessage,
    };
  }
}

/**
 * Recursively processes a directory to convert import paths in all TypeScript and JavaScript files.
 * Uses p-map to process subdirectories and files concurrently.
 * @example
 * // Processes all files in "src" converting relative imports to alias imports.
 * processDirectory("src", { fromType: "relative", toType: "alias", aliasPrefix: "~/" });
 *
 * @param dirPath Path to the directory to process
 * @param options Configuration options for the conversion
 * @returns Array of result objects for each processed file
 */
async function processDirectory(
  dirPath: string,
  options: {
    fromType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
    toType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
    baseDir?: string;
    aliasPrefix?: string;
    config?: BuildPublishConfig;
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

    // Process subdirectories concurrently
    const subDirResults = await pMap(
      directoryEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        return await processDirectory(fullPath, options);
      },
      { concurrency: 5 },
    );
    results.push(...subDirResults.flat());

    // Process files concurrently
    const fileResults = await pMap(
      fileEntries,
      async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const result = await processFile(fullPath, options);
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
    const errorMessage = `Error processing directory ${dirPath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    relinka("error", errorMessage);
    results.push({
      filePath: dirPath,
      success: false,
      message: errorMessage,
    });
    return results;
  }
}

/**
 * Converts import paths in files from one type to another.
 * @example
 * // Convert all relative imports in the "src" directory to absolute paths.
 * convertImportPaths({
 *   baseDir: "src",
 *   fromType: "relative",
 *   toType: "absolute",
 *   aliasPrefix: "~/" ,
 *   dryRun: false,
 * });
 *
 * @param options Configuration options for the conversion
 * @returns Array of result objects for each processed file
 */
export async function convertImportPaths(options: {
  baseDir: string;
  fromType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
  toType: "relative" | "absolute" | "alias" | "module" | "dynamic" | "bare";
  aliasPrefix?: string;
  config?: BuildPublishConfig;
  currentLibName?: string;
  urlMap?: Record<string, string>;
  dryRun?: boolean;
  fileExtensions?: string[];
  generateSourceMap?: boolean;
}): Promise<{ filePath: string; success: boolean; message: string }[]> {
  const normalizedBaseDirPath = options.baseDir.replace(/\\/g, "/");
  const baseDir = path.isAbsolute(normalizedBaseDirPath)
    ? normalizedBaseDirPath
    : path.join(process.cwd(), normalizedBaseDirPath);

  // If the conversion involves alias paths, ensure aliasPrefix is provided
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
  const modifiedOptions = { ...options, baseDir, aliasPrefix };
  const results = await processDirectory(baseDir, modifiedOptions);

  for (const result of results) {
    if (result.success && result.message) {
      // No need to log here as we're already using relinka("success", ...) in processFile
    } else if (!result.success) {
      relinka("error", result.message);
    }
  }
  return results;
}
