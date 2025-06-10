/**
 * Spell runner – walks a directory tree, finds
 * magic-comment directives and executes them.
 *
 * Usage example:
 *   await applyMagicSpells(["dist-jsr"]);
 *   await applyMagicSpells(["dist-libs/sdk"]);
 *   await applyMagicSpells(["dist-npm", "dist-jsr", "dist-libs"]);
 */

import path, { join } from "@reliverse/pathkit";
import fs, { readdir } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";

import type { DistDirs } from "~/libs/sdk/sdk-types";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { formatError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";

import { evaluateMagicDirective, type SpellEvaluationContext, type SpellOutcome } from "./spells";

const DEBUG_MODE = true;
const PROCESS_DTS_FILES = true;

export interface ApplyMagicSpellsOptions {
  /** Absolute or cwd-relative root directory to process */
  dir: string;
  /** Number of files to process in parallel */
  concurrency?: number;
  /** Number of files to process in each batch */
  batchSize?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Whether to copy files from src before processing */
  copyFileWithDirectivesFromSrcBeforeProcessing?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<ApplyMagicSpellsOptions, "dir">> = {
  concurrency: 4,
  batchSize: 100,
  stopOnError: false,
  copyFileWithDirectivesFromSrcBeforeProcessing: true,
};

const DIST_PATHS: Record<DistDirs, string> = {
  "dist-jsr": "dist-jsr/bin",
  "dist-npm": "dist-npm/bin",
  "dist-libs": "dist-libs",
};

export interface ApplyMagicSpellsResult {
  /** All processed files */
  processedFiles: string[];
}

/**
 * Validates targets for conflicts and duplicates
 * @throws Error if targets contain conflicts or duplicates
 */
function validateTargets(targets: string[]): void {
  const distLibs = new Set<string>();
  const specificLibs = new Set<string>();

  for (const target of targets) {
    const [dist, lib] = target.split("/");

    if (!dist || !Object.keys(DIST_PATHS).includes(dist)) {
      throw new Error(`Invalid distribution target: ${dist}`);
    }

    if (dist === "dist-libs") {
      if (lib) {
        // Check if we already have a specific lib
        if (specificLibs.has(lib)) {
          throw new Error(`Duplicate library target: ${target}`);
        }
        specificLibs.add(lib);
      } else {
        // Check if we already have dist-libs or any specific libs
        if (distLibs.has("dist-libs") || specificLibs.size > 0) {
          throw new Error("Cannot mix 'dist-libs' with specific library targets");
        }
        distLibs.add("dist-libs");
      }
    } else {
      // Check if we already have this dist target
      if (distLibs.has(dist)) {
        throw new Error(`Duplicate distribution target: ${dist}`);
      }
      distLibs.add(dist);
    }
  }
}

/**
 * Processes files in specified distribution directories by applying magic directives
 * First scans src directory for files with magic directives, then processes corresponding dist files
 * @param targets Array of distribution targets in format "dist-npm", "dist-jsr", "dist-libs" or "dist-libs/lib-name"
 * @param options Configuration options for processing
 * @returns Object containing arrays of processed files and processed .d.ts files
 */
export async function applyMagicSpells(
  targets: string[],
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<ApplyMagicSpellsResult> {
  const result: ApplyMagicSpellsResult = {
    processedFiles: [],
  };

  try {
    validateTargets(targets);

    // Step 1: Scan src directory for files with magic directives
    const srcRoot = path.resolve(process.cwd(), "src");
    const sourceFilesWithDirectives = await scanSourceForMagicDirectives(srcRoot, options);

    if (sourceFilesWithDirectives.length === 0) {
      if (DEBUG_MODE) relinka("log", "[spells] No source files with magic directives found");
      return result;
    }

    if (DEBUG_MODE) {
      relinka(
        "log",
        `[spells] Found ${sourceFilesWithDirectives.length} source files with magic directives`,
      );
    }

    // Step 2: Process each target distribution
    await pMap(
      targets,
      async (target) => {
        const [dist, lib] = target.split("/");

        if (dist === "dist-libs") {
          if (!lib) {
            const libDirs = await readdir(DIST_PATHS["dist-libs"]);
            await pMap(
              libDirs,
              async (libDir) => {
                const targetResult = await processDistributionTarget(
                  sourceFilesWithDirectives,
                  "dist-libs",
                  libDir,
                  options,
                );
                result.processedFiles.push(...targetResult.processedFiles);
              },
              {
                concurrency: options.concurrency ?? 4,
                stopOnError: options.stopOnError ?? true,
              },
            );
          } else {
            const targetResult = await processDistributionTarget(
              sourceFilesWithDirectives,
              "dist-libs",
              lib,
              options,
            );
            result.processedFiles.push(...targetResult.processedFiles);
          }
        } else {
          const targetResult = await processDistributionTarget(
            sourceFilesWithDirectives,
            dist as DistDirs,
            undefined,
            options,
          );
          result.processedFiles.push(...targetResult.processedFiles);
        }
      },
      {
        concurrency: options.concurrency ?? 3,
        stopOnError: options.stopOnError ?? true,
      },
    );

    return result;
  } catch (error) {
    throw new Error(`Failed to process distribution files: ${formatError(error)}`);
  }
}

/**
 * Scans source directory for files containing magic directives
 * @param srcRoot Source directory root path
 * @param options Processing options
 * @returns Array of source file paths that contain magic directives
 */
async function scanSourceForMagicDirectives(
  srcRoot: string,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<string[]> {
  if (DEBUG_MODE) {
    relinka("log", `[spells] ⇒ scanning src: ${srcRoot}`);
  }

  const sourceFilesWithDirectives: string[] = [];

  try {
    for await (const filePath of walkDirectoryTree(srcRoot)) {
      if (await isBinaryExt(filePath)) {
        continue;
      }

      // Skip spell implementation files
      const projectRel = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
      if (await isSpellImplementationFile(projectRel)) {
        continue;
      }

      try {
        const content = await fs.readFile(filePath, "utf8");
        if (containsMagicDirectives(content)) {
          sourceFilesWithDirectives.push(filePath);
          if (DEBUG_MODE) {
            relinka(
              "log",
              `[spells] ⇒ found directives in ${path.relative(process.cwd(), filePath)}`,
            );
          }
        }
      } catch (error) {
        if (options.stopOnError) {
          throw new Error(`Failed to read source file ${filePath}: ${formatError(error)}`);
        }
        relinka("error", `Failed to read source file ${filePath}: ${formatError(error)}`);
      }
    }
  } catch (error) {
    if (options.stopOnError) {
      throw new Error(`Failed to scan source directory: ${formatError(error)}`);
    }
    relinka("error", `Failed to scan source directory: ${formatError(error)}`);
  }

  return sourceFilesWithDirectives;
}

/**
 * Processes a specific distribution target by finding corresponding dist files for source files with directives
 * @param sourceFilesWithDirectives Array of source file paths containing magic directives
 * @param dist Distribution type (dist-jsr, dist-npm, dist-libs)
 * @param libName Optional library name for dist-libs
 * @param options Processing options
 */
async function processDistributionTarget(
  sourceFilesWithDirectives: string[],
  dist: DistDirs,
  libName: string | undefined,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<ApplyMagicSpellsResult> {
  const { concurrency = DEFAULT_OPTIONS.concurrency, batchSize = DEFAULT_OPTIONS.batchSize } =
    options;

  const result: ApplyMagicSpellsResult = {
    processedFiles: [],
  };

  if (DEBUG_MODE) {
    const targetName = dist === "dist-libs" && libName ? `${dist}/${libName}` : dist;
    relinka("log", `[spells] ⇒ processing target: ${targetName}`);
  }

  const distFilesToProcess: string[] = [];

  // Find corresponding dist files for each source file with directives
  for (const sourceFile of sourceFilesWithDirectives) {
    const distFiles = await findDistributionFiles(sourceFile, dist, libName);
    distFilesToProcess.push(...distFiles);
  }

  if (distFilesToProcess.length === 0) {
    if (DEBUG_MODE) {
      const targetName = dist === "dist-libs" && libName ? `${dist}/${libName}` : dist;
      relinka("log", `[spells] No corresponding dist files found for target: ${targetName}`);
    }
    return result;
  }

  // Process dist files in batches
  for (let i = 0; i < distFilesToProcess.length; i += batchSize) {
    const batch = distFilesToProcess.slice(i, i + batchSize);
    await pMap(
      batch,
      async (distFilePath) => {
        try {
          const wasProcessed = await processSingleDistFile(distFilePath, options);
          if (wasProcessed) {
            result.processedFiles.push(distFilePath);
          }
        } catch (error) {
          const errorMessage = `Error processing ${distFilePath}: ${formatError(error)}`;
          if (options.stopOnError) {
            throw new Error(errorMessage);
          }
          relinka("error", errorMessage);
        }
      },
      { concurrency },
    );
  }

  return result;
}

/**
 * Finds the corresponding source file for a distribution file
 * @param distFilePath Path to the distribution file
 * @returns Path to the source file or null if not found
 */
async function findSourceFile(distFilePath: string): Promise<string | null> {
  const projectRel = path.relative(process.cwd(), distFilePath).replaceAll(path.sep, "/");
  const ext = path.extname(distFilePath);
  const baseName = path.basename(distFilePath, ext);
  const dirName = path.dirname(projectRel);

  let sourcePath: string;

  // Handle different distribution patterns
  if (dirName.startsWith("dist-libs/")) {
    // For dist-libs: dist-libs/sdk/npm/bin -> src/libs/sdk
    // Extract library name from the path
    const match = dirName.match(/^dist-libs\/([^/]+)(?:\/(?:npm|jsr))?(?:\/bin)?\/?(.*)$/);
    if (match) {
      const [, libName, remainingPath] = match;
      sourcePath = `src/libs/${libName}${remainingPath ? `/${remainingPath}` : ""}`;
    } else {
      // Fallback if pattern doesn't match
      sourcePath = dirName.replace(/^dist-libs\//, "src/libs/");
    }
  } else {
    // For dist-npm and dist-jsr: dist-npm/bin -> src, dist-jsr/bin -> src
    sourcePath = dirName.replace(/^dist-(?:jsr|npm)(?:\/bin)?\/?/, "src/");
  }

  const sourceDir = path.join(process.cwd(), sourcePath);

  // For .js files, try .ts first, then .js
  if (ext === ".js") {
    // Try .ts file first (skip .d.ts)
    const tsFile = path.join(sourceDir, `${baseName}.ts`);
    if (await fs.pathExists(tsFile)) {
      // Make sure it's not a .d.ts file
      const isDts = tsFile.endsWith(".d.ts");
      if (!isDts) {
        return tsFile;
      }
    }
    // Try .js file if .ts not found
    const jsFile = path.join(sourceDir, `${baseName}.js`);
    if (await fs.pathExists(jsFile)) {
      return jsFile;
    }
  } else if (ext === ".ts") {
    // For .ts files, check if it's a .d.ts file
    const isDts = path.basename(distFilePath).endsWith(".d.ts");
    if (isDts && !PROCESS_DTS_FILES) {
      return null; // Skip .d.ts files if not processing them
    }
    // Try the same extension
    const sourceFile = path.join(sourceDir, `${baseName}${ext}`);
    if (await fs.pathExists(sourceFile)) {
      return sourceFile;
    }
  } else {
    // For other extensions, try the same extension
    const sourceFile = path.join(sourceDir, `${baseName}${ext}`);
    if (await fs.pathExists(sourceFile)) {
      return sourceFile;
    }
  }

  return null;
}

async function processSingleDistFile(
  filePath: string,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<boolean> {
  const projectRel = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");

  if (await isBinaryExt(filePath)) {
    if (DEBUG_MODE) relinka("log", `[spells] ⊘ binary  ${projectRel}`);
    return false;
  }

  // First phase: Copy operations
  let copiedFromSource = false;
  if (
    options.copyFileWithDirectivesFromSrcBeforeProcessing ??
    DEFAULT_OPTIONS.copyFileWithDirectivesFromSrcBeforeProcessing
  ) {
    const sourceFile = await findSourceFile(filePath);
    if (sourceFile) {
      try {
        // Copy the source file to dist
        await fs.copyFile(sourceFile, filePath);
        copiedFromSource = true;
        if (DEBUG_MODE)
          relinka("log", `[spells] ↳ copied from ${path.relative(process.cwd(), sourceFile)}`);
      } catch (error) {
        relinka("error", `Failed to copy from source: ${formatError(error)}`);
      }
    }
  }

  // Second phase: Process magic directives and other transformations
  // Only proceed if we either copied from source or the file already exists
  if (copiedFromSource || (await fs.pathExists(filePath))) {
    // Read the file content
    const source = await fs.readFile(filePath, "utf8");
    const ctx: SpellEvaluationContext = { filePath: projectRel };

    let removeFile = false;
    const processedLines: string[] = [];

    for (const line of source.split(/\r?\n/)) {
      const outcome: SpellOutcome = evaluateMagicDirective(line, ctx);

      if (outcome.removeFile) {
        removeFile = true;
        break;
      }

      if (!outcome.removeLine) {
        processedLines.push(outcome.replacement ?? line);
      }
    }

    if (removeFile) {
      await fs.unlink(filePath);
      if (DEBUG_MODE) relinka("log", `[spells] ✖ removed ${projectRel}`);
      return false;
    }

    const newContent = processedLines.join("\n");
    if (newContent !== source) {
      await fs.writeFile(filePath, newContent, "utf8");
      if (DEBUG_MODE) relinka("log", `[spells] ✓ updated ${projectRel}`);
    }

    return true;
  }

  return false;
}

/**
 * Finds corresponding distribution files for a source file
 * @param sourceFilePath Path to the source file
 * @param dist Distribution type
 * @param libName Optional library name for dist-libs
 * @returns Array of corresponding distribution file paths
 */
async function findDistributionFiles(
  sourceFilePath: string,
  dist: DistDirs,
  libName?: string,
): Promise<string[]> {
  const projectRel = path.relative(process.cwd(), sourceFilePath).replaceAll(path.sep, "/");

  // Remove 'src/' prefix to get the relative path within src
  const srcRelativePath = projectRel.replace(/^src\//, "");

  const ext = path.extname(sourceFilePath);
  const baseName = path.basename(sourceFilePath, ext);
  const dirPath = path.dirname(srcRelativePath);
  const isDts = sourceFilePath.endsWith(".d.ts");

  const distFiles: string[] = [];

  if (dist === "dist-libs" && libName) {
    // For dist-libs with specific library - dynamically read available registries
    const targets = await getAvailableRegistries(libName);
    for (const target of targets) {
      const distPath = join("dist-libs", libName, target, "bin", dirPath === "." ? "" : dirPath);

      // Try different extensions based on file type
      let extensions: string[];
      if (isDts && PROCESS_DTS_FILES) {
        extensions = [".d.ts"];
      } else if (ext === ".ts" && !isDts) {
        extensions = [".js", ".ts"];
      } else {
        extensions = [ext];
      }

      for (const distExt of extensions) {
        const distFile = path.join(process.cwd(), distPath, `${baseName}${distExt}`);
        if (await fs.pathExists(distFile)) {
          distFiles.push(distFile);
        }
      }
    }
  } else {
    // For dist-jsr or dist-npm
    const basePath = DIST_PATHS[dist];
    const distPath = path.join(basePath, dirPath === "." ? "" : dirPath);

    // Try different extensions based on file type
    let extensions: string[];
    if (isDts && PROCESS_DTS_FILES) {
      extensions = [".d.ts"];
    } else if (ext === ".ts" && !isDts) {
      extensions = [".js", ".ts"];
    } else {
      extensions = [ext];
    }

    for (const distExt of extensions) {
      const distFile = path.join(process.cwd(), distPath, `${baseName}${distExt}`);
      if (await fs.pathExists(distFile)) {
        distFiles.push(distFile);
      }
    }
  }

  return distFiles;
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------- */

// Magic directive detection regex (same as in spells.ts)
const SPELL_REGEX = /\/\/\s*(?:@ts-expect-error\s+.*?)?<\s*(dler-[^>\s]+)(.*?)>/i;

// Cache for spell implementation paths
let spellImplementationPaths: string[] | null = null;

/**
 * Builds spell implementation paths dynamically by reading dist-libs structure
 * @returns Array of spell implementation paths to exclude
 */
async function getSpellImplementationPaths(): Promise<string[]> {
  if (spellImplementationPaths !== null) {
    return spellImplementationPaths;
  }

  const paths: string[] = [];
  const distLibsPath = path.join(process.cwd(), "dist-libs");

  try {
    if (await fs.pathExists(distLibsPath)) {
      const libDirs = await fs.readdir(distLibsPath, { withFileTypes: true });

      for (const libDir of libDirs) {
        if (libDir.isDirectory()) {
          const libName = libDir.name;

          // Add paths in the format: /libs/{libName}/sdk-impl/spell/ and /{libName}/sdk-impl/spell/
          paths.push(`/libs/${libName}/sdk-impl/spell/`);
          paths.push(`/${libName}/sdk-impl/spell/`);

          // Check what registry directories exist for this lib
          const libPath = path.join(distLibsPath, libName);
          try {
            const registryDirs = await fs.readdir(libPath, { withFileTypes: true });

            for (const registryDir of registryDirs) {
              if (
                registryDir.isDirectory() &&
                (registryDir.name === "npm" || registryDir.name === "jsr")
              ) {
                const registryName = registryDir.name;
                // Add more specific paths if needed
                paths.push(`/libs/${libName}/${registryName}/sdk-impl/spell/`);
                paths.push(`/${libName}/${registryName}/sdk-impl/spell/`);
              }
            }
          } catch (error) {
            if (DEBUG_MODE) {
              relinka("warn", `Failed to read library directory ${libPath}: ${formatError(error)}`);
            }
          }
        }
      }
    }
  } catch (error) {
    if (DEBUG_MODE) {
      relinka("warn", `Failed to read dist-libs directory: ${formatError(error)}`);
    }
  }

  // Fallback to hardcoded paths if no dynamic paths found
  if (paths.length === 0) {
    paths.push("/libs/sdk/sdk-impl/spell/", "/sdk-impl/spell/");
  }

  spellImplementationPaths = paths;
  return paths;
}

/**
 * Checks if a file path is a spell implementation file that should be skipped
 * @param projectRelPath Project-relative path
 * @returns true if the file should be skipped
 */
async function isSpellImplementationFile(projectRelPath: string): Promise<boolean> {
  const spellPaths = await getSpellImplementationPaths();
  return spellPaths.some((spellPath) => projectRelPath.includes(spellPath));
}

// Cache for available registries per library
const libraryRegistriesCache = new Map<string, string[]>();

/**
 * Gets available registries for a specific library by reading its directory structure
 * @param libName Library name
 * @returns Array of available registry names (e.g., ["npm", "jsr"])
 */
async function getAvailableRegistries(libName: string): Promise<string[]> {
  const cached = libraryRegistriesCache.get(libName);
  if (cached) {
    return cached;
  }

  const registries: string[] = [];
  const libPath = path.join(process.cwd(), "dist-libs", libName);

  try {
    if (await fs.pathExists(libPath)) {
      const entries = await fs.readdir(libPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && (entry.name === "npm" || entry.name === "jsr")) {
          registries.push(entry.name);
        }
      }
    }
  } catch (error) {
    if (DEBUG_MODE) {
      relinka("warn", `Failed to read library registries for ${libName}: ${formatError(error)}`);
    }
  }

  // Fallback to default registries if none found
  if (registries.length === 0) {
    registries.push("npm", "jsr");
  }

  libraryRegistriesCache.set(libName, registries);
  return registries;
}

// Cache for all available registries across all libraries
let allAvailableRegistriesCache: string[] | null = null;

/**
 * Gets all available registries across all libraries
 * @returns Array of unique registry names found across all libraries
 */
export async function getAllAvailableRegistries(): Promise<string[]> {
  if (allAvailableRegistriesCache !== null) {
    return allAvailableRegistriesCache;
  }

  const allRegistries = new Set<string>();
  const distLibsPath = path.join(process.cwd(), "dist-libs");

  try {
    if (await fs.pathExists(distLibsPath)) {
      const libDirs = await fs.readdir(distLibsPath, { withFileTypes: true });

      for (const libDir of libDirs) {
        if (libDir.isDirectory()) {
          const registries = await getAvailableRegistries(libDir.name);
          for (const registry of registries) {
            allRegistries.add(registry);
          }
        }
      }
    }
  } catch (error) {
    if (DEBUG_MODE) {
      relinka("warn", `Failed to scan all registries: ${formatError(error)}`);
    }
  }

  // Fallback to default registries if none found
  if (allRegistries.size === 0) {
    allRegistries.add("npm");
    allRegistries.add("jsr");
  }

  allAvailableRegistriesCache = Array.from(allRegistries);
  return allAvailableRegistriesCache;
}

/**
 * Checks if a file content contains magic directives
 * @param content File content to check
 * @returns true if magic directives are found
 */
function containsMagicDirectives(content: string): boolean {
  const lines = content.split(/\r?\n/);
  return lines.some((line) => SPELL_REGEX.test(line));
}

/** Async recursive directory walker (DFS) */
async function* walkDirectoryTree(dir: string): AsyncGenerator<string> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDirectoryTree(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  } catch (error) {
    const errorMessage = `Error walking directory ${dir}: ${formatError(error)}`;
    relinka("error", errorMessage);
    throw new Error(errorMessage);
  }
}
