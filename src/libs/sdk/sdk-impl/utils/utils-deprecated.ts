import fs from "fs-extra";
import pMap from "p-map";
import path from "pathe";
import { glob } from "tinyglobby";

import type { LibConfig, Replacement } from "~/types.js";

import { CONCURRENCY_DEFAULT, PROJECT_ROOT } from "./utils-consts.js";
import { determineDistName } from "./utils-determine.js";
import { writeFileSafe } from "./utils-fs.js";
import { relinka } from "./utils-logs.js";

/**
 * Type definition for import intranspileFormation.
 */
type ImportInfo = {
  importPath: string;
  importPathIndex: number;
  matchStart: number;
};

/**
 * Applies replacements to file content and writes it back to the file.
 */
export async function applyReplacements(
  filePath: string,
  content: string,
  replacements: (null | Replacement)[],
): Promise<void> {
  // Filter out null values
  const validReplacements = replacements.filter(
    (r): r is Replacement => r !== null,
  );

  if (validReplacements.length === 0) return;

  // Sort replacements in reverse order to avoid offset issues
  validReplacements.sort((a, b) => b.start - a.start);

  // Apply replacements
  let newContent = content;
  for (const { end, replacement, start } of validReplacements) {
    newContent =
      newContent.substring(0, start) + replacement + newContent.substring(end);
  }

  // Write the modified content back to the file
  await writeFileSafe(filePath, newContent, "processFileForExternalImports");
}

/**
 * Detects the current library name based on the baseDir path.
 */
export function detectCurrentLibrary(
  baseDir: string,
  distName: string,
  libsList: Record<string, LibConfig>,
): string | undefined {
  if (!libsList) return undefined;

  // Normalize path for matching (replace Windows backslashes with forward slashes)
  const normalizedBaseDir = baseDir.replace(/\\/g, "/");

  // Extract the dist-libs part from the path
  const distMatch = /dist-libs\/([^/]+)\//.exec(normalizedBaseDir);
  if (!distMatch?.[1]) return undefined;

  const distLibName = distMatch[1];

  for (const [libName, libConfig] of Object.entries(libsList)) {
    // Get the simple name without any scope
    const libNameSimple = libName.split("/").pop() || libName;
    // Get the directory from the lib's main path
    const mainDir = path.dirname(libConfig.libMainFile);
    // Extract just the lib dir name from the main path
    const libDirName = path.basename(mainDir);

    // Check for exact matches (simple cases)
    if (distLibName === libNameSimple || distLibName === libDirName) {
      relinka(
        "verbose",
        `[${distName}] Detected current library (exact match) for import analysis: ${libName} for path: ${baseDir}`,
      );
      return libName;
    }

    // Check for prefixed pattern matches
    // For libraries like "relidler-cfg" where "cfg" is the actual directory name
    const libPartAfterDash = libNameSimple.split("-").pop();
    const distPartAfterDash = distLibName.split("-").pop();

    if (
      // Package name like "relidler-cfg" matches dist folder "relidler-cfg"
      (libNameSimple.includes("-") && distLibName === libNameSimple) ||
      // Main directory like "cfg" matches dist folder "relidler-cfg" after dash
      (libPartAfterDash &&
        distPartAfterDash &&
        (libDirName === distPartAfterDash ||
          libPartAfterDash === distPartAfterDash))
    ) {
      relinka(
        "verbose",
        `[${distName}] Detected current library (with prefix) for import analysis: ${libName} for path: ${baseDir}`,
      );
      return libName;
    }
  }
  return undefined;
}

/**
 * Checks if an import is a local file (not an npm package).
 */
export function isLocalImport(importPath: string): boolean {
  return (
    importPath.startsWith(".") ||
    importPath.startsWith("/") ||
    importPath.startsWith("~")
  );
}

/**
 * Resolves an import path to an actual file on disk.
 */
export async function resolveImportToFile(
  importPath: string,
  filePath: string,
): Promise<null | string> {
  // Resolve the absolute path of the imported file
  let resolvedImportPath: string;
  if (importPath.startsWith("/")) {
    resolvedImportPath = path.join(PROJECT_ROOT, importPath.slice(1));
  } else if (importPath.startsWith("~/")) {
    resolvedImportPath = path.join(PROJECT_ROOT, importPath.slice(2));
  } else {
    resolvedImportPath = path.resolve(path.dirname(filePath), importPath);
  }

  // Inject extension if needed
  let foundFile = false;
  let resolvedFullPath = resolvedImportPath;

  if (!path.extname(resolvedImportPath)) {
    // Try adding various extensions
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".json"]) {
      const withExt = `${resolvedImportPath}${ext}`;
      if (await fs.pathExists(withExt)) {
        resolvedFullPath = withExt;
        foundFile = true;
        break;
      }
    }
  } else if (await fs.pathExists(resolvedImportPath)) {
    foundFile = true;
  }

  // Check for directory with index file
  if (
    !foundFile &&
    (await fs.pathExists(resolvedImportPath)) &&
    (await fs.stat(resolvedImportPath)).isDirectory()
  ) {
    // Try to find a main file in the directory
    const mainFilePath = await findMainFileInDirectory(resolvedImportPath);
    if (mainFilePath) {
      resolvedFullPath = mainFilePath;
      foundFile = true;
    }
  }

  if (!foundFile) {
    relinka("warn", `Could not resolve import: ${importPath} in ${filePath}`);
    return null;
  }

  return resolvedFullPath;
}

/**
 * Copies an external file to the addons directory and processes its imports.
 */
async function copyExternalFile(
  resolvedFullPath: string,
  addonsDir: string,
  copiedExternalFiles: Map<string, string>,
  entryDir: string,
  outDirBin: string,
  processedFiles: Set<string>,
  isDev: boolean,
  isJsr: boolean,
  libsList: Record<string, LibConfig>,
): Promise<string> {
  // Return existing copy if already copied
  if (copiedExternalFiles.has(resolvedFullPath)) {
    return copiedExternalFiles.get(resolvedFullPath)!;
  }

  // Create a path in the addons directory that preserves some structure
  const fileBaseName = path.basename(resolvedFullPath);
  const fileDir = path.dirname(resolvedFullPath);
  const lastDirName = path.basename(fileDir);

  // Use a combination of the last directory name and file name to avoid collisions
  const transpileTargetPath = path.join(
    addonsDir,
    `${lastDirName}_${fileBaseName}`,
  );

  // Copy the file
  await fs.copyFile(resolvedFullPath, transpileTargetPath);
  copiedExternalFiles.set(resolvedFullPath, transpileTargetPath);
  relinka(
    "verbose",
    `Copied external file: ${resolvedFullPath} -> ${transpileTargetPath}`,
  );

  // Process the copied file for its own imports
  await processFileForExternalImports(
    transpileTargetPath,
    entryDir,
    outDirBin,
    addonsDir,
    processedFiles,
    copiedExternalFiles,
    isDev,
    isJsr,
    libsList,
  );

  return transpileTargetPath;
}

/**
 * Extracts all local imports (not npm packages) from file content.
 */
function extractLocalImports(content: string): ImportInfo[] {
  const importRegex =
    /(?:import|export)(?:(?:[\s\S]*?from\s+)|(?:(?:[\s\S]|(?:\n))+?=\s+require\(\s*))["']([^"']+)["']/g;

  const imports: ImportInfo[] = [];
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip npm package imports
    if (!isLocalImport(importPath)) {
      continue;
    }

    imports.push({
      importPath,
      importPathIndex: match[0].indexOf(importPath),
      matchStart: match.index,
    });
  }

  return imports;
}

/**
 * Finds a replacement for cross-library imports.
 */
function findCrossLibraryReplacement(
  importPath: string,
  filePath: string,
  currentLibName: string | undefined,
  isJsr: boolean,
  matchStart: number,
  importPathIndex: number,
  libsList: Record<string, LibConfig>,
): null | Replacement {
  if (
    !libsList ||
    (!importPath.startsWith("~/") && !importPath.startsWith("."))
  ) {
    return null;
  }

  let subPath = importPath;
  let isSymbolPath = false;

  // Handle symbol paths (~/...)
  if (importPath.startsWith("~/")) {
    subPath = importPath.slice(2);
    isSymbolPath = true;
  }

  // For relative paths, resolve to absolute path relative to the current file
  const absolutePath = isSymbolPath
    ? path.join(PROJECT_ROOT, subPath)
    : path.resolve(path.dirname(filePath), importPath);

  // Get the path relative to the project root
  const relativeToRoot = path.relative(PROJECT_ROOT, absolutePath);

  for (const [libName, libConfig] of Object.entries(libsList)) {
    // Skip if this is the current library
    if (currentLibName && libName === currentLibName) {
      continue;
    }

    const libMainPath = libConfig.libMainFile;
    const libDirPath = path.dirname(libMainPath);

    // Check if this import points to a file in another library
    if (
      relativeToRoot.startsWith(libDirPath) ||
      // Also check for imports like "../cfg/cfg-mod.ts" or "libs/cfg/cfg-mod.js"
      (isSymbolPath && subPath.includes(`/${path.basename(libDirPath)}/`)) ||
      (!isSymbolPath &&
        path.basename(path.dirname(relativeToRoot)) ===
          path.basename(libDirPath))
    ) {
      logFoundImport(importPath, libName, isJsr, filePath);

      // Calculate replacement positions
      const importPathStart = matchStart + importPathIndex;
      const importPathEnd = importPathStart + importPath.length;

      return {
        end: importPathEnd,
        replacement: libName,
        start: importPathStart,
      };
    }
  }

  return null;
}

/**
 * Finds a main file in a directory using a flexible pattern-based approach.
 * This replaces the hardcoded list of index file names.
 */
async function findMainFileInDirectory(
  dirPath: string,
): Promise<null | string> {
  // Extract the directory name to look for potential lib-specific main files
  const dirName = path.basename(dirPath);

  relinka("verbose", `Detecting main file in directory: ${dirPath}`);

  // Define patterns for main files in order of priority
  const mainFilePatterns = [
    // Standard index files
    "index.ts",
    "index.js",

    // Generic main files
    "main.ts",
    "main.js",

    // Library-specific main files with transpileFormat: [lib-name]-main.ts/js
    `${dirName}-main.ts`,
    `${dirName}-main.js`,

    // Other common patterns
    "*-main.ts",
    "*-main.js",
    "*.mod.ts",
    "*.mod.js",
  ];

  // Try exact matches first
  for (const pattern of mainFilePatterns) {
    if (!pattern.includes("*")) {
      const filePath = path.join(dirPath, pattern);
      if (await fs.pathExists(filePath)) {
        relinka(
          "verbose",
          `Found main file in directory (exact match): ${filePath}`,
        );
        return filePath;
      }
    }
  }

  // Then try glob patterns
  for (const pattern of mainFilePatterns) {
    if (pattern.includes("*")) {
      const files = await glob(path.join(dirPath, pattern));
      if (files.length > 0) {
        relinka(
          "verbose",
          `Found main file in directory: ${files[0]} (pattern: ${pattern})`,
        );
        return files[0];
      }
    }
  }

  return null;
}

/**
 * Handles external imports by copying them to the addons directory and updating import paths.
 */
async function handleExternalImport(
  resolvedFullPath: string,
  importPath: string,
  filePath: string,
  entryDir: string,
  outDirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  isDev: boolean,
  isJsr: boolean,
  matchStart: number,
  importPathIndex: number,
  _distName: string,
  libsList: Record<string, LibConfig>,
): Promise<null | Replacement> {
  // Check if this is an external import (outside the lib's source directory)
  const normalizedEntryDir = path.resolve(PROJECT_ROOT, entryDir);
  const isExternal = !resolvedFullPath.startsWith(normalizedEntryDir);

  // Check if this is an import from a dist-libs directory (another library's build output)
  const isFromDistLibs = resolvedFullPath.includes("dist-libs");

  // Skip copying files from dist-libs directories to prevent nested dist-libs paths
  if (isExternal && isFromDistLibs) {
    relinka(
      "info",
      `[${_distName}] Skipping external import from dist-libsList: ${importPath} -> ${resolvedFullPath}`,
    );
    return null;
  }

  if (isExternal && !isFromDistLibs) {
    relinka(
      "info",
      `[${_distName}] Found external import: ${importPath} -> ${resolvedFullPath}`,
    );

    // Copy the external file if not already copied
    const transpileTargetPath = await copyExternalFile(
      resolvedFullPath,
      addonsDir,
      copiedExternalFiles,
      entryDir,
      outDirBin,
      processedFiles,
      isDev,
      isJsr,
      libsList,
    );

    // Calculate the relative path from the current file to the copied file
    const relativeImportPath = path
      .relative(path.dirname(filePath), transpileTargetPath)
      .replace(/\\/g, "/");

    // Ensure the path starts with ./ or ../
    const transpileFormattedRelativePath = relativeImportPath.startsWith(".")
      ? relativeImportPath
      : `./${relativeImportPath}`;

    // Calculate replacement positions
    const importPathStart = matchStart + importPathIndex;
    const importPathEnd = importPathStart + importPath.length;

    return {
      end: importPathEnd,
      replacement: transpileFormattedRelativePath,
      start: importPathStart,
    };
  }

  return null;
}

/**
 * Checks if a file is in a subdirectory of a library.
 * This replaces the hardcoded check for "funcs" directory.
 */
function isInSubdirectory(filePath: string): boolean {
  // Check if the file is in a subdirectory structure
  // This generalizes the previous check for "/funcs/" or "\\funcs\\"
  const pathParts = filePath.split(/[/\\]/);

  // Find the "libs" directory index
  const libsIndex = pathParts.findIndex((part) => part === "libs");
  if (libsIndex === -1) return false;

  // Check if there's a subdirectory after the library name
  // Format: libs/[lib-name]/[subdirectory]/...
  return libsIndex + 2 < pathParts.length;
}

function logFoundImport(
  importPath: string,
  libName: string,
  isJsr: boolean,
  processedFilePath: string,
) {
  // Determine the distribution type based on the file path
  const distName = determineDistName(processedFilePath, isJsr, null);
  // Log the import found
  relinka(
    "verbose",
    `[${distName}] Found import from another lib: ${importPath} -> ${libName} (in ${processedFilePath})`,
  );
}

/**
 * Normalizes an import path by removing extensions.
 */
function normalizeImportPath(importPath: string, filePath: string): string {
  let normalizedPath = importPath;

  // Remove .js or .ts extensions
  if (normalizedPath.endsWith(".js") || normalizedPath.endsWith(".ts")) {
    normalizedPath = normalizedPath.replace(/\.(js|ts)$/, "");
  }

  // Extract library name pattern from path
  const libsPattern = /libs\/([^/]+)\//;
  const libMatch = libsPattern.exec(normalizedPath);

  // Check if this is a file in a subdirectory that imports from a library
  if (libMatch && isInSubdirectory(filePath)) {
    // Get the library name from the match
    const libName = libMatch[1];

    // Simplify to just use the filename for imports from libs
    const pathComponents = normalizedPath.split(/[/\\]/);
    const fileName = pathComponents[pathComponents.length - 1];

    // Use a relative path that points to the parent directory
    normalizedPath = `../${fileName}`;

    // Log the normalization for debugging
    relinka(
      "verbose",
      `Normalized library import from ${importPath} to ${normalizedPath} (lib: ${libName})`,
    );
  }

  return normalizedPath;
}

/**
 * Processes a file to handle external imports, replacing them with appropriate paths.
 * This function:
 * 1. Finds all imports in the file
 * 2. Identifies imports from other libs and replaces them with package names
 * 3. Identifies external imports (outside the entry directory) and copies them to the addons directory
 * 4. Updates import paths in the file to point to the correct locations
 */
async function processFileForExternalImports(
  filePath: string,
  entryDir: string,
  outDirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  isDev: boolean,
  isJsr: boolean,
  libsList: Record<string, LibConfig>,
): Promise<void> {
  // Skip already processed files to avoid circular dependencies
  if (processedFiles.has(filePath)) return;
  processedFiles.add(filePath);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const distName = determineDistName(outDirBin, isJsr, libsList);

    // Extract all local imports (not npm packages)
    const imports = extractLocalImports(content);
    if (imports.length === 0) return;

    // Get the config and determine the current library
    const currentLibName = detectCurrentLibrary(outDirBin, distName, libsList);

    // Process each import and generate replacements
    const replacements = await processImports(
      imports,
      filePath,
      entryDir,
      outDirBin,
      addonsDir,
      processedFiles,
      copiedExternalFiles,
      currentLibName,
      isDev,
      isJsr,
      distName,
      libsList,
    );

    // Apply the replacements to the file content
    await applyReplacements(filePath, content, replacements);
  } catch (error) {
    relinka(
      "error",
      `Error processing file for external imports: ${filePath}\n${error}`,
    );
  }
}

/**
 * Processes imports to generate replacement intranspileFormation.
 */
async function processImports(
  imports: ImportInfo[],
  filePath: string,
  entryDir: string,
  outDirBin: string,
  addonsDir: string,
  processedFiles: Set<string>,
  copiedExternalFiles: Map<string, string>,
  currentLibName: string | undefined,
  isDev: boolean,
  isJsr: boolean,
  distName: string,
  libsList: Record<string, LibConfig>,
): Promise<Replacement[]> {
  return pMap(
    imports,
    async (importInfo) => {
      const { importPath, importPathIndex, matchStart } = importInfo;

      // Skip imports that already reference dist-libs to prevent nested paths
      if (importPath.includes("dist-libs")) {
        relinka(
          "verbose",
          `[${distName}] Skipping import that already references dist-libsList: ${importPath}`,
        );
        return null;
      }

      // Check if this is a cross-library import
      const libraryReplacement = findCrossLibraryReplacement(
        importPath,
        filePath,
        currentLibName,
        isJsr,
        matchStart,
        importPathIndex,
        libsList,
      );

      if (libraryReplacement) {
        return libraryReplacement;
      }

      // Normalize the import path
      const normalizedPath = normalizeImportPath(importPath, filePath);

      // Resolve the import path to an actual file
      const resolvedPath = await resolveImportToFile(normalizedPath, filePath);
      if (!resolvedPath) {
        return null;
      }

      // Handle external imports (outside the entry directory)
      return handleExternalImport(
        resolvedPath,
        importPath,
        filePath,
        entryDir,
        outDirBin,
        addonsDir,
        processedFiles,
        copiedExternalFiles,
        isDev,
        isJsr,
        matchStart,
        importPathIndex,
        distName,
        libsList,
      );
    },
    {
      concurrency: CONCURRENCY_DEFAULT,
      stopOnError: false,
    },
  );
}
