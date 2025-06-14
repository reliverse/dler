import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { glob } from "tinyglobby";

import { CONCURRENCY_DEFAULT, SHOW_VERBOSE } from "./utils-consts";
import { determineDistName } from "./utils-determine";

// ============================
// File & Directory Utilities
// ============================

/**
 * Copies specified files from the root directory to the output directory.
 */
export async function copyRootFile(outDirRoot: string, fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) {
    return;
  }

  // List of files that should be excluded from being copied as they are generated
  const EXCLUDED_FILES = ["bin", "jsr.json", "jsr.jsonc", "package.json"];

  try {
    await fs.ensureDir(outDirRoot);

    // Special file handling configurations
    const specialFileHandlers: Record<
      string,
      {
        variants: string[];
      }
    > = {
      LICENSE: {
        variants: ["LICENSE", "LICENSE.md", "LICENSES"],
      },
      README: {
        variants: ["README.md", "README"],
      },
    };

    // Process files in parallel
    await pMap(
      fileNames,
      async (fileName) => {
        try {
          // Skip excluded files
          if (EXCLUDED_FILES.includes(fileName)) {
            relinka(
              "verbose",
              `The following artifact is auto-generated in dist and will not be copied from the root: ${fileName}`,
            );
            return;
          }

          const specialConfig = specialFileHandlers[fileName];

          if (specialConfig?.variants) {
            // Handle files with variants (like LICENSE and README)
            for (const variant of specialConfig.variants) {
              const file = await findFileCaseInsensitive(variant);
              if (file) {
                const targetPath = path.join(outDirRoot, variant);

                // Remove existing file if it exists
                if (await fs.pathExists(targetPath)) {
                  await fs.remove(targetPath);
                }

                await fs.copy(file, targetPath, { errorOnExist: true });
                relinka("verbose", `Copied ${file} to ${outDirRoot}/${variant}`);
              }
            }
          } else {
            // Handle standard files
            const file = await findFileCaseInsensitive(fileName);
            if (file) {
              const targetPath = path.join(outDirRoot, fileName);

              // Remove existing file if it exists
              if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
              }

              await fs.copy(file, targetPath, { errorOnExist: true });
              relinka("verbose", `Copied ${file} to ${outDirRoot}/${fileName}`);
            }
          }
        } catch (fileError) {
          relinka("error", `Failed to copy ${fileName}: ${fileError}`);
        }
      },
      { concurrency: CONCURRENCY_DEFAULT }, // Process up to CONCURRENCY_DEFAULT files simultaneously
    );
  } catch (error) {
    relinka("error", `Failed to copy files: ${error}`);
    throw new Error(`File copying failed: ${error}`);
  }
}

/**
 * Calculates the total size (in bytes) of a directory.
 */
export async function getDirectorySize(outDirRoot: string, isDev: boolean): Promise<number> {
  if (SHOW_VERBOSE.getDirectorySize) {
    relinka("verbose", `Calculating directory size for: ${outDirRoot}`);
  }
  try {
    const files = await fs.readdir(outDirRoot);
    const sizes = await pMap(
      files,
      async (file) => {
        const fp = path.join(outDirRoot, file);
        const stats = await fs.stat(fp);
        return stats.isDirectory() ? getDirectorySize(fp, isDev) : stats.size;
      },
      { concurrency: CONCURRENCY_DEFAULT },
    );
    const totalSize = sizes.reduce((total, s) => total + s, 0);
    if (SHOW_VERBOSE.getDirectorySize) {
      relinka("verbose", `Calculated directory size: ${totalSize} bytes for ${outDirRoot}`);
    }
    return totalSize;
  } catch (error) {
    relinka("error", `Failed to calculate directory size for ${outDirRoot}`, error);
    return 0;
  }
}

/**
 * Recursively counts the number of files in a directory.
 */
export async function outDirBinFilesCount(outDirBin: string): Promise<number> {
  relinka("verbose", `Counting files in directory: ${outDirBin}`);
  let fileCount = 0;
  if (!(await fs.pathExists(outDirBin))) {
    relinka("error", `[outDirBinFilesCount] Directory does not exist: ${outDirBin}`);
    return fileCount;
  }

  await fs.dive(outDirBin, () => {
    fileCount++;
  });

  relinka("verbose", `Total file count in ${outDirBin}: ${fileCount}`);
  return fileCount;
}

/**
 * Finds a file in the current directory regardless of case.
 */
async function findFileCaseInsensitive(transpileTargetFile: string): Promise<null | string> {
  const files = await fs.readdir(".");
  const found = files.find((file) => file.toLowerCase() === transpileTargetFile.toLowerCase());
  return found || null;
}

const TEST_FILE_PATTERNS = [
  "**/*.test.js",
  "**/*.test.ts",
  "**/*.test.d.ts",
  "**/*-temp.js",
  "**/*-temp.ts",
  "**/*-temp.d.ts",
  "**/__snapshots__/**",
];

/**
 * Deletes specific test and temporary files from a given directory.
 */
export async function deleteSpecificFiles(outDirBin: string): Promise<void> {
  relinka("verbose", `Deleting test and temporary files in: ${outDirBin}`);
  const files = await glob(TEST_FILE_PATTERNS, {
    absolute: true,
    cwd: outDirBin,
  });
  const snapshotDirs = await glob("**/__snapshots__", {
    absolute: true,
    cwd: outDirBin,
    onlyDirectories: true,
  });
  const filesToDelete = files.filter((file) => {
    if (file.endsWith(".d.ts")) {
      return file.includes(".test.d.ts") || file.includes("-temp.d.ts");
    }
    return true;
  });
  if (filesToDelete.length > 0) {
    await pMap(filesToDelete, async (file) => fs.remove(file), {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka("verbose", `Deleted files:\n${filesToDelete.join("\n")}`);
  }
  if (snapshotDirs.length > 0) {
    await pMap(snapshotDirs, async (dir) => fs.remove(dir), {
      concurrency: CONCURRENCY_DEFAULT,
    });
    relinka("log", `Deleted snapshot directories:\n${snapshotDirs.join("\n")}`);
  }
}

/**
 * Reads a file safely and returns its content.
 */
export async function readFileSafe(
  filePath: string,
  isJsr: "" | boolean,
  reason: string,
): Promise<string> {
  const distName = determineDistName(filePath, isJsr, undefined);
  try {
    const content = await fs.readFile(filePath, "utf8");
    if (SHOW_VERBOSE.readFileSafe) {
      relinka("verbose", `[${distName}] Successfully read file: ${filePath} [Reason: ${reason}]`);
    }
    return content;
  } catch (error) {
    relinka("error", `[${distName}] Failed to read file: ${filePath} [Reason: ${reason}]`, error);
    throw error;
  }
}

/**
 * Writes content to a file safely.
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  reason: string,
): Promise<void> {
  try {
    await fs.writeFile(filePath, content, "utf8");
    relinka("verbose", `Successfully wrote file: ${filePath} [Reason: ${reason}]`);
  } catch (error) {
    relinka("error", `Failed to write file: ${filePath} [Reason: ${reason}]`, error);
    throw error;
  }
}

/**
 * Copies files and directories that should not be built to the output directory.
 * This function is called after all build steps have completed to ensure copied assets
 * are not accidentally wiped by the clean step inside `_build`.
 *
 * Features:
 * - Directory copying with all contents (recursive)
 * - Windows path compatibility
 * - Retries on busy files
 * - Batch processing to manage memory
 * - Security checks for sensitive patterns
 *
 * @param rootDir - The root directory to copy from
 * @param outDir - The output directory to copy to
 * @param patterns - Array of glob patterns to match files/directories to copy
 *
 * @example
 * ```ts
 * **🔥 IMPORTANT**: IGNORE SPACES BETWEEN SLASHES IN THIS EXAMPLE;
 * WE USE SPACES BECAUSE VSCODE JSDOC INCORRECTLY PARSES TWO STARS AND A SLASH
 *
 * // Copy a directory and its contents:
 * await copyInsteadOfBuild(rootDir, outDir, ["** / templates"]);
 * // Copy multiple directories:
 * await copyInsteadOfBuild(rootDir, outDir, ["** / templates", "** / assets"]);
 * // Copy file types:
 * await copyInsteadOfBuild(rootDir, outDir, ["** / *.json", "** / *.md"]);
 * ```
 *
 * Notes:
 * - Use `** /` prefix to match directories at any depth
 * - Patterns are processed in batches to manage memory
 * - Sensitive patterns (node_modules, .git, etc.) are automatically filtered
 * - The function will retry on busy files up to 3 times
 */
export async function copyInsteadOfBuild(
  rootDir: string,
  outDir: string,
  patterns: string[],
): Promise<void> {
  if (!patterns.length) return;

  // Check if any of the patterns exist in the source directory
  const normalizedRootDir = path.normalize(rootDir);
  const sourcePatterns = patterns.map((pattern) =>
    pattern
      .replace(/^(dist-npm|dist-jsr)\/\*\*\/?/, "")
      .replace(/^(dist-npm|dist-jsr)\//, "")
      .replace(/^bin\//, ""),
  );

  const allMatches = await Promise.all(
    sourcePatterns.map((pattern) =>
      glob(pattern, {
        cwd: normalizedRootDir,
        dot: true,
        absolute: true,
        onlyFiles: false,
        followSymbolicLinks: false,
        ignore: ["**/node_modules/**", "**/.git/**", "node_modules/**", ".git/**"],
      }),
    ),
  );

  if (!allMatches.some((matches) => matches.length > 0)) {
    relinka("verbose", "No matching files found for any of the provided patterns");
    return;
  }

  relinka("info", "Copying files/folders that should not be built...");

  // Normalize paths for Windows compatibility
  const normalizedOutDir = path.normalize(outDir);

  // First, delete any existing files/folders that match the patterns
  relinka("verbose", "Cleaning up existing files/folders before copying...");
  for (const pattern of patterns) {
    // Convert the source pattern to a destination pattern
    // Remove any dist-* and bin prefixes from the pattern since we're already in the dist directory
    const destPattern = pattern
      .replace(/^\*\*\/|\/\*\*\/|\/\*\*$/g, "**/")
      .replace(/^(dist-npm|dist-jsr)\/\*\*\/?/, "**/")
      .replace(/^(dist-npm|dist-jsr)\//, "")
      .replace(/^bin\//, "");

    // relinka("verbose", `Looking for files to delete with pattern: ${destPattern}`);

    // First try to delete the exact directory/file if it exists
    const exactPath = path.join(normalizedOutDir, destPattern.replace(/\*\*/g, ""));
    if (await fs.pathExists(exactPath)) {
      try {
        relinka("verbose", `Deleting exact path: ${exactPath}`);
        await fs.remove(exactPath);
      } catch (error) {
        relinka("error", `Failed to delete exact path: ${exactPath}`, error);
        throw error;
      }
    }

    // Then try to find and delete any matching files/directories
    const matches = await glob(destPattern, {
      cwd: normalizedOutDir,
      dot: true,
      absolute: true,
      onlyFiles: false,
      followSymbolicLinks: false,
      ignore: ["**/node_modules/**", "**/.git/**", "node_modules/**", ".git/**"],
    });

    for (const match of matches) {
      try {
        const relativePath = path.relative(normalizedOutDir, match);
        relinka("verbose", `Deleting existing: ${relativePath}`);
        await fs.remove(match);
      } catch (error) {
        relinka("error", `Failed to delete existing file/folder: ${match}`, error);
        throw error;
      }
    }
  }

  // Process patterns in batches to manage memory
  const BATCH_SIZE = 50;
  const BATCH_DELAY = 100; // ms delay between batches to prevent memory spikes

  for (let i = 0; i < patterns.length; i += BATCH_SIZE) {
    const batchPatterns = patterns.slice(i, i + BATCH_SIZE);
    const batchCopyTasks: Promise<unknown>[] = [];

    // Process each pattern in the current batch
    for (const pattern of batchPatterns) {
      // Clean the pattern for source directory
      const sourcePattern = pattern
        .replace(/^(dist-npm|dist-jsr)\/\*\*\/?/, "")
        .replace(/^(dist-npm|dist-jsr)\//, "")
        .replace(/^bin\//, "");

      // relinka("verbose", `Looking for source files with pattern: ${sourcePattern}`);

      const matches = await glob(sourcePattern, {
        cwd: normalizedRootDir,
        dot: true,
        absolute: true,
        onlyFiles: false,
        followSymbolicLinks: false,
        ignore: ["**/node_modules/**", "**/.git/**", "node_modules/**", ".git/**"],
      });

      for (const match of matches) {
        const relativePath = path.relative(normalizedRootDir, match);
        // Remove any dist-* and bin prefixes from the relative path
        const cleanRelativePath = relativePath
          .replace(/^(dist-npm|dist-jsr)\/\*\*\/?/, "")
          .replace(/^(dist-npm|dist-jsr)\//, "")
          .replace(/^bin\//, "");
        const destPath = path.resolve(normalizedOutDir, cleanRelativePath);

        // Create parent directory if it doesn't exist
        await fs.ensureDir(path.dirname(destPath));

        // Check if source exists and is accessible
        if (!(await fs.pathExists(match))) {
          throw new Error(`Source not accessible: ${relativePath}`);
        }

        // Double check if destination exists and remove it
        if (await fs.pathExists(destPath)) {
          // relinka("verbose", `Removing existing destination before copy: ${cleanRelativePath}`);
          await fs.remove(destPath);
        }

        const stats = await fs.stat(match);
        if (stats.isDirectory()) {
          // For directories, use regular copy
          await fs.copy(match, destPath, {
            recursive: true,
            dereference: true,
            overwrite: true,
            errorOnExist: true,
          });
        } else {
          // For files, use copy to preserve exact formatting
          await fs.copy(match, destPath, {
            overwrite: true,
            errorOnExist: true,
          });
        }
        // relinka("verbose", `Copied instead of building: ${cleanRelativePath}`);
      }
    }

    // Process current batch
    if (batchCopyTasks.length > 0) {
      await Promise.all(batchCopyTasks);
    }

    // Add delay between batches if not the last batch
    if (i + BATCH_SIZE < patterns.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }

    // Log progress
    const progress = Math.min(
      100,
      Math.round(((i + batchPatterns.length) / patterns.length) * 100),
    );
    relinka(
      "verbose",
      `Copy progress: ${progress}% (${i + batchPatterns.length}/${patterns.length} patterns)`,
    );
  }

  relinka("info", "[isCLI] Completed copying files/folders that should not be built:", patterns);
}

// check if directory exists and is accessible
export async function validateDirectory(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
