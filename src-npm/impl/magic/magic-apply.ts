/**
 * Spell runner – walks a directory tree, finds
 * magic-comment directives and executes them.
 *
 * Usage example:
 *   await applyMagicSpells(["dist-jsr"]);
 *   await applyMagicSpells(["dist-libs/sdk"]);
 *   await applyMagicSpells(["dist-npm", "dist-jsr", "dist-libs"]);
 *   await applyMagicSpells(["custom-output/my-lib"]); // For custom targets, magic directives are processed directly in the target files
 */

import path, { join } from "@reliverse/pathkit";
import fs, { readdir } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";

import { isBinaryExt } from "~/impl/utils/binary";
import { formatError } from "~/impl/utils/utils-error-cwd";

import {
  evaluateMagicDirective,
  type SpellEvaluationContext,
  type SpellOutcome,
} from "./magic-spells";

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
  /** Custom output paths mapping for non-standard directories */
  customOutputPaths?: Record<string, string>;
}

const DEFAULT_OPTIONS: Required<Omit<ApplyMagicSpellsOptions, "dir" | "customOutputPaths">> = {
  concurrency: 4,
  batchSize: 100,
  stopOnError: false,
  copyFileWithDirectivesFromSrcBeforeProcessing: true,
};

// Default output paths for backward compatibility
const DEFAULT_OUTPUT_PATHS: Record<string, string> = {
  "dist-jsr": "dist-jsr/bin",
  "dist-npm": "dist-npm/bin",
  "dist-libs": "dist-libs",
};

export interface ApplyMagicSpellsResult {
  /** All processed files */
  processedFiles: string[];
  /** Total number of magic spells processed */
  totalSpellsProcessed: number;
}

/**
 * Validates targets for conflicts and duplicates
 * @throws Error if targets contain conflicts or duplicates
 */
function validateTargets(targets: string[], customOutputPaths?: Record<string, string>): void {
  const outputDirs = new Set<string>();
  const specificLibs = new Set<string>();
  const customTargets = new Set<string>();

  // Merge default and custom output paths
  const allOutputPaths = { ...DEFAULT_OUTPUT_PATHS, ...customOutputPaths };

  for (const target of targets) {
    const [outputDir, lib] = target.split("/");

    if (!outputDir) {
      throw new Error(`Invalid output target: ${target}`);
    }

    // Check if this is a custom target (not dist-npm, dist-jsr, or dist-libs)
    const isCustomTarget = !["dist-npm", "dist-jsr", "dist-libs"].includes(outputDir);

    if (isCustomTarget) {
      if (customTargets.has(outputDir)) {
        throw new Error(`Duplicate custom target: ${outputDir}`);
      }
      customTargets.add(outputDir);

      // Only check existence for custom targets
      const outputPath = allOutputPaths[outputDir] || outputDir;
      const fullPath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(process.cwd(), outputPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Output directory does not exist: ${outputPath}`);
      }
      continue;
    }

    if (outputDir === "dist-libs") {
      if (lib) {
        // Check if we already have a specific lib
        if (specificLibs.has(lib)) {
          throw new Error(`Duplicate library target: ${target}`);
        }
        specificLibs.add(lib);
      } else {
        // Check if we already have dist-libs or any specific libs
        if (outputDirs.has("dist-libs") || specificLibs.size > 0) {
          throw new Error("Cannot mix 'dist-libs' with specific library targets");
        }
        outputDirs.add("dist-libs");
      }
    } else {
      // Check if we already have this output target
      if (outputDirs.has(outputDir)) {
        throw new Error(`Duplicate output target: ${outputDir}`);
      }
      outputDirs.add(outputDir);
    }
  }
}

/**
 * Processes files in specified output directories by applying magic directives
 * For dist targets, first scans src directory for files with magic directives, then processes corresponding output files
 * For custom targets, processes magic directives directly in the target files
 *
 * !! Users should call this function manually in their codebase (dler doesn't call it automatically) !!
 * To call it:
 * ```ts
 * // may be useful when your cli is a project bootstrapper tool like @reliverse/rse
 * // so you can apply spells to each bootstrapped by you cli project's file
 * await applyMagicSpells(["my-target-dir"]);
 * ```
 * Or, in dler config's hook:
 * ```ts
 * hooksAfterBuild: [
 *   async () => {
 *     // useful when you want to apply spells right after dler's build
 *     await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
 *   }
 * ]
 * ```
 * Or, use `dler magic` command:
 * ```bash
 * dler magic --targets "my-target-dir"
 * ```
 *
 * @param targets Array of output targets in format "dist-npm", "dist-jsr", "dist-libs" or "dist-libs/lib-name" or any custom path
 * @param options Configuration options for processing
 * @returns Object containing arrays of processed files and processed .d.ts files
 */
export async function applyMagicSpells(
  targets: string[],
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<ApplyMagicSpellsResult> {
  const result: ApplyMagicSpellsResult = {
    processedFiles: [],
    totalSpellsProcessed: 0,
  };

  try {
    validateTargets(targets, options.customOutputPaths);

    // Step 2: Process each target output directory
    await pMap(
      targets,
      async (target) => {
        const [outputDir, lib] = target.split("/");

        // Handle custom targets differently
        if (outputDir && !["dist-npm", "dist-jsr", "dist-libs"].includes(outputDir)) {
          const targetResult = await processCustomTarget(outputDir, options);
          result.processedFiles.push(...targetResult.processedFiles);
          result.totalSpellsProcessed += targetResult.totalSpellsProcessed;
          return;
        }

        // For dist targets, first scan src directory for files with magic directives
        const srcRoot = path.resolve(process.cwd(), "src");
        const sourceFilesWithDirectives = await scanSourceForMagicDirectives(srcRoot, options);

        if (sourceFilesWithDirectives.length === 0) {
          return;
        }

        if (DEBUG_MODE) {
          relinka(
            "verbose",
            `[spells] Found ${sourceFilesWithDirectives.length} source files with magic directives`,
          );
        }

        if (outputDir === "dist-libs") {
          if (!lib) {
            const distLibsPath = DEFAULT_OUTPUT_PATHS["dist-libs"] ?? "dist-libs";
            try {
              if (await fs.pathExists(distLibsPath)) {
                const libDirs = await readdir(distLibsPath, { withFileTypes: true });
                await pMap(
                  libDirs,
                  async (libDir) => {
                    if (libDir.isDirectory()) {
                      const targetResult = await processOutputTarget(
                        sourceFilesWithDirectives,
                        "dist-libs",
                        libDir.name,
                        options,
                      );
                      result.processedFiles.push(...targetResult.processedFiles);
                      result.totalSpellsProcessed += targetResult.totalSpellsProcessed;
                    }
                  },
                  {
                    concurrency: options.concurrency ?? 4,
                    stopOnError: options.stopOnError ?? true,
                  },
                );
              } else if (DEBUG_MODE) {
                relinka("verbose", `[spells] ⊘ skipping non-existent target: ${distLibsPath}`);
              }
            } catch (error) {
              if (DEBUG_MODE) {
                relinka("warn", `Failed to process dist-libs: ${formatError(error)}`);
              }
            }
          } else {
            const targetResult = await processOutputTarget(
              sourceFilesWithDirectives,
              "dist-libs",
              lib,
              options,
            );
            result.processedFiles.push(...targetResult.processedFiles);
            result.totalSpellsProcessed += targetResult.totalSpellsProcessed;
          }
        } else if (outputDir) {
          const targetResult = await processOutputTarget(
            sourceFilesWithDirectives,
            outputDir,
            undefined,
            options,
          );
          result.processedFiles.push(...targetResult.processedFiles);
          result.totalSpellsProcessed += targetResult.totalSpellsProcessed;
        }
      },
      {
        concurrency: options.concurrency ?? 3,
        stopOnError: options.stopOnError ?? true,
      },
    );

    if (DEBUG_MODE) {
      relinka(
        "verbose",
        `[spells] ✓ Processed ${result.totalSpellsProcessed} magic spells in ${result.processedFiles.length} files`,
      );
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to process output files: ${formatError(error)}`);
  }
}

/**
 * Processes a custom target by finding and processing files with magic directives directly in the target directory
 * @param outputDir Custom output directory
 * @param options Processing options
 */
async function processCustomTarget(
  outputDir: string,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<ApplyMagicSpellsResult> {
  const { concurrency = DEFAULT_OPTIONS.concurrency, batchSize = DEFAULT_OPTIONS.batchSize } =
    options;

  const result: ApplyMagicSpellsResult = {
    processedFiles: [],
    totalSpellsProcessed: 0,
  };

  if (DEBUG_MODE) {
    relinka("verbose", `[spells] ⇒ processing custom target: ${outputDir}`);
  }

  const outputFilesToProcess: string[] = [];

  // Get the output path from custom paths or use the outputDir directly
  const outputPath = options.customOutputPaths?.[outputDir] || outputDir;
  const fullOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  // Walk through the target directory to find files with magic directives
  for await (const filePath of walkDirectoryTree(fullOutputPath)) {
    if (await isBinaryExt(filePath)) {
      continue;
    }

    try {
      const content = await fs.readFile(filePath, "utf8");
      if (containsMagicDirectives(content)) {
        outputFilesToProcess.push(filePath);
        if (DEBUG_MODE) {
          relinka(
            "verbose",
            `[spells] ⇒ found directives in ${path.relative(process.cwd(), filePath)}`,
          );
        }
      }
    } catch (error) {
      if (options.stopOnError) {
        throw new Error(`Failed to read file ${filePath}: ${formatError(error)}`);
      }
      relinka("error", `Failed to read file ${filePath}: ${formatError(error)}`);
    }
  }

  if (outputFilesToProcess.length === 0) {
    if (DEBUG_MODE) {
      relinka(
        "verbose",
        `[spells] No files with magic directives found in custom target: ${outputDir}`,
      );
    }
    return result;
  }

  // Process output files in batches
  for (let i = 0; i < outputFilesToProcess.length; i += batchSize) {
    const batch = outputFilesToProcess.slice(i, i + batchSize);
    await pMap(
      batch,
      async (outputFilePath) => {
        try {
          const wasProcessed = await processSingleOutputFile(outputFilePath, options);
          if (wasProcessed) {
            result.processedFiles.push(outputFilePath);
            // Count spells in the processed file
            const content = await fs.readFile(outputFilePath, "utf8");
            const spellCount = (
              content.match(/\/\/\s*(?:@ts-expect-error\s+.*?)?<\s*(dler-[^>\s]+)(.*?)>/gi) || []
            ).length;
            result.totalSpellsProcessed += spellCount;
          }
        } catch (error) {
          const errorMessage = `Error processing ${outputFilePath}: ${formatError(error)}`;
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
 * Scans source directory for files containing magic directives
 * @param srcRoot Source directory root path
 * @param options Processing options
 * @returns Array of source file paths that contain magic directives
 */
async function scanSourceForMagicDirectives(
  srcRoot: string,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<string[]> {
  // if (DEBUG_MODE) {
  //   relinka("verbose", `[spells] ⇒ scanning src: ${srcRoot}`);
  // }

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
              "verbose",
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
 * Processes a specific output target by finding corresponding output files for source files with directives
 * @param sourceFilesWithDirectives Array of source file paths containing magic directives
 * @param outputDir Output directory type
 * @param libName Optional library name for dist-libs
 * @param options Processing options
 */
async function processOutputTarget(
  sourceFilesWithDirectives: string[],
  outputDir: string,
  libName: string | undefined,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<ApplyMagicSpellsResult> {
  const { concurrency = DEFAULT_OPTIONS.concurrency, batchSize = DEFAULT_OPTIONS.batchSize } =
    options;

  const result: ApplyMagicSpellsResult = {
    processedFiles: [],
    totalSpellsProcessed: 0,
  };

  // Get the output path from custom paths or use the outputDir directly
  const outputPath = options.customOutputPaths?.[outputDir] || outputDir;
  const fullOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  // Early return if output directory doesn't exist
  if (!(await fs.pathExists(fullOutputPath))) {
    if (DEBUG_MODE) {
      const targetName =
        outputDir === "dist-libs" && libName ? `${outputDir}/${libName}` : outputDir;
      relinka("verbose", `[spells] ⊘ skipping non-existent target: ${targetName}`);
    }
    return result;
  }

  if (DEBUG_MODE) {
    const targetName = outputDir === "dist-libs" && libName ? `${outputDir}/${libName}` : outputDir;
    relinka("verbose", `[spells] ⇒ processing target: ${targetName}`);
  }

  const outputFilesToProcess: string[] = [];

  // Find corresponding output files for each source file with directives
  for (const sourceFile of sourceFilesWithDirectives) {
    const outputFiles = await findOutputFiles(
      sourceFile,
      outputDir,
      libName,
      options.customOutputPaths,
    );
    outputFilesToProcess.push(...outputFiles);
  }

  if (outputFilesToProcess.length === 0) {
    if (DEBUG_MODE) {
      const targetName =
        outputDir === "dist-libs" && libName ? `${outputDir}/${libName}` : outputDir;
      relinka("verbose", `[spells] No corresponding output files found for target: ${targetName}`);
    }
    return result;
  }

  // Process output files in batches
  for (let i = 0; i < outputFilesToProcess.length; i += batchSize) {
    const batch = outputFilesToProcess.slice(i, i + batchSize);
    await pMap(
      batch,
      async (outputFilePath) => {
        try {
          const wasProcessed = await processSingleOutputFile(outputFilePath, options);
          if (wasProcessed) {
            result.processedFiles.push(outputFilePath);
            // Count spells in the processed file
            const content = await fs.readFile(outputFilePath, "utf8");
            const spellCount = (
              content.match(/\/\/\s*(?:@ts-expect-error\s+.*?)?<\s*(dler-[^>\s]+)(.*?)>/gi) || []
            ).length;
            result.totalSpellsProcessed += spellCount;
          }
        } catch (error) {
          const errorMessage = `Error processing ${outputFilePath}: ${formatError(error)}`;
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

export async function processSingleOutputFile(
  filePath: string,
  options: Partial<ApplyMagicSpellsOptions> = {},
): Promise<boolean> {
  const projectRel = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");

  if (await isBinaryExt(filePath)) {
    if (DEBUG_MODE) relinka("verbose", `[spells] ⊘ binary  ${projectRel}`);
    return false;
  }

  // First phase: Copy operations
  let copiedFromSource = false;
  if (
    options.copyFileWithDirectivesFromSrcBeforeProcessing ??
    DEFAULT_OPTIONS.copyFileWithDirectivesFromSrcBeforeProcessing
  ) {
    const sourceFile = await findSourceFile(filePath);
    if (sourceFile && sourceFile !== filePath) {
      try {
        // Copy the source file to output
        await fs.copyFile(sourceFile, filePath);
        copiedFromSource = true;
        if (DEBUG_MODE)
          relinka("verbose", `[spells] ↳ copied from ${path.relative(process.cwd(), sourceFile)}`);
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
    const allLines = source.split(/\r?\n/);
    const processedLines: string[] = [];

    // Process lines from the end backwards for better performance and consistency
    // This allows early termination if a remove-file directive is found
    // and maintains better line number consistency for future enhancements
    for (let i = allLines.length - 1; i >= 0; i--) {
      const line = allLines[i]!;
      const outcome: SpellOutcome = evaluateMagicDirective(line, ctx);

      if (outcome.removeFile) {
        removeFile = true;
        break;
      }

      if (!outcome.removeLine) {
        // Since we're processing backwards, prepend instead of append
        processedLines.unshift(outcome.replacement ?? line);
      }
    }

    if (removeFile) {
      await fs.unlink(filePath);
      if (DEBUG_MODE) relinka("verbose", `[spells] ✖ removed ${projectRel}`);
      return false;
    }

    const newContent = processedLines.join("\n");
    if (newContent !== source) {
      await fs.writeFile(filePath, newContent, "utf8");
      if (DEBUG_MODE) relinka("verbose", `[spells] ✓ updated ${projectRel}`);
    }

    return true;
  }

  return false;
}

/**
 * Finds corresponding output files for a source file
 * @param sourceFilePath Path to the source file
 * @param outputDir Output directory type
 * @param libName Optional library name for dist-libs
 * @param customOutputPaths Optional custom output paths mapping
 * @returns Array of corresponding output file paths
 */
async function findOutputFiles(
  sourceFilePath: string,
  outputDir: string,
  libName?: string,
  customOutputPaths?: Record<string, string>,
): Promise<string[]> {
  const projectRel = path.relative(process.cwd(), sourceFilePath).replaceAll(path.sep, "/");

  // Remove 'src/' prefix to get the relative path within src
  const srcRelativePath = projectRel.replace(/^src\//, "");

  const ext = path.extname(sourceFilePath);
  const baseName = path.basename(sourceFilePath, ext);
  const dirPath = path.dirname(srcRelativePath);
  const isDts = sourceFilePath.endsWith(".d.ts");

  const outputFiles: string[] = [];

  // Merge default and custom output paths
  const allOutputPaths = { ...DEFAULT_OUTPUT_PATHS, ...customOutputPaths };

  if (outputDir === "dist-libs" && libName) {
    // For dist-libs with specific library - dynamically read available registries
    const targets = await getAvailableRegistries(libName);
    for (const target of targets) {
      const outputPath = join("dist-libs", libName, target, "bin", dirPath === "." ? "" : dirPath);

      // Try different extensions based on file type
      let extensions: string[];
      if (isDts && PROCESS_DTS_FILES) {
        extensions = [".d.ts"];
      } else if (ext === ".ts" && !isDts) {
        extensions = [".js", ".ts"];
      } else {
        extensions = [ext];
      }

      for (const outputExt of extensions) {
        const outputFile = path.isAbsolute(outputPath)
          ? path.join(outputPath, `${baseName}${outputExt}`)
          : path.join(process.cwd(), outputPath, `${baseName}${outputExt}`);
        if (await fs.pathExists(outputFile)) {
          outputFiles.push(outputFile);
        }
      }
    }
  } else {
    // For any output directory
    const basePath = allOutputPaths[outputDir] || outputDir;
    const outputPath = path.join(basePath, dirPath === "." ? "" : dirPath);

    // Try different extensions based on file type
    let extensions: string[];
    if (isDts && PROCESS_DTS_FILES) {
      extensions = [".d.ts"];
    } else if (ext === ".ts" && !isDts) {
      extensions = [".js", ".ts"];
    } else {
      extensions = [ext];
    }

    for (const outputExt of extensions) {
      const outputFile = path.isAbsolute(basePath)
        ? path.join(basePath, dirPath === "." ? "" : dirPath, `${baseName}${outputExt}`)
        : path.join(process.cwd(), outputPath, `${baseName}${outputExt}`);
      if (await fs.pathExists(outputFile)) {
        outputFiles.push(outputFile);
      }
    }
  }

  return outputFiles;
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
    paths.push("/impl/spell/", "/sdk-impl/spell/");
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
  // Check for specific file names
  const fileName = path.basename(projectRelPath);
  if (
    fileName === "magic-apply.ts" ||
    fileName === "magic-apply.js" ||
    fileName === "magic-apply.d.ts" ||
    fileName === "magic-spells.ts" ||
    fileName === "magic-spells.js" ||
    fileName === "magic-spells.d.ts"
  ) {
    return true;
  }

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

/**
 * Information about a file containing magic spells
 */
export interface FileWithSpells {
  /** Absolute path to the file */
  path: string;
  /** Line numbers where spells were found (1-based) */
  spellLines: number[];
}

/**
 * Scans directories for files containing magic spells
 * @param dirs Array of directories to scan (absolute or cwd-relative paths)
 * @param options Configuration options for scanning
 * @returns Array of files containing magic spells with their line numbers
 */
export async function getFilesWithMagicSpells(
  dirs: string[],
  options: {
    /** Whether to stop on first error */
    stopOnError?: boolean;
    /** Whether to exclude spell implementation files */
    excludeSpellImplementation?: boolean;
  } = {},
): Promise<FileWithSpells[]> {
  const { stopOnError = false, excludeSpellImplementation = true } = options;
  const filesWithSpells: FileWithSpells[] = [];

  try {
    await pMap(
      dirs,
      async (dir) => {
        const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
        if (!(await fs.pathExists(fullPath))) {
          const error = `Directory does not exist: ${dir}`;
          if (stopOnError) {
            throw new Error(error);
          }
          relinka("warn", error);
          return;
        }

        for await (const filePath of walkDirectoryTree(fullPath)) {
          if (await isBinaryExt(filePath)) {
            continue;
          }

          const projectRel = path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");

          // Skip spell implementation files if requested
          if (excludeSpellImplementation && (await isSpellImplementationFile(projectRel))) {
            continue;
          }

          try {
            const content = await fs.readFile(filePath, "utf8");
            const lines = content.split(/\r?\n/);
            const spellLines: number[] = [];

            // Find lines with spells
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (
                line &&
                /\/\/\s*(?:@ts-expect-error\s+.*?)?<\s*(dler-[^>\s]+)(.*?)>/i.test(line)
              ) {
                spellLines.push(i + 1); // Convert to 1-based line numbers
              }
            }

            if (spellLines.length > 0) {
              filesWithSpells.push({
                path: filePath,
                spellLines,
              });
              // if (DEBUG_MODE) {
              //   relinka(
              //     "verbose",
              //     `[spells] ⇒ found ${spellLines.length} directive(s) in ${projectRel} at lines: ${spellLines.join(
              //       ", ",
              //     )}`,
              //   );
              // }
            }
          } catch (error) {
            const errorMessage = `Failed to read file ${filePath}: ${formatError(error)}`;
            if (stopOnError) {
              throw new Error(errorMessage);
            }
            relinka("error", errorMessage);
          }
        }
      },
      {
        concurrency: 4,
        stopOnError,
      },
    );

    return filesWithSpells;
  } catch (error) {
    throw new Error(`Failed to scan directories: ${formatError(error)}`);
  }
}
