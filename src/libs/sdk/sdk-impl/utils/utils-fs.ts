import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import pMap from "p-map";
import path from "pathe";
import { glob } from "tinyglobby";

import { CONCURRENCY_DEFAULT, SHOW_VERBOSE } from "./utils-consts.js";
import { determineDistName } from "./utils-determine.js";

// ============================
// File & Directory Utilities
// ============================

/**
 * Copies specified files from the root directory to the output directory.
 */
export async function copyRootFile(
  outDirRoot: string,
  fileNames: string[],
): Promise<void> {
  if (fileNames.length === 0) {
    return;
  }

  try {
    // Ensure output directory exists
    await fs.ensureDir(outDirRoot);

    // Define special file handling configurations
    const specialFileHandlers: Record<
      string,
      {
        outputName?: string;
        variants?: string[];
      }
    > = {
      LICENSE: {
        outputName: "LICENSE",
        variants: ["LICENSE", "LICENSE.md"],
      },
      "README.md": {},
    };

    // Process files in parallel
    await pMap(
      fileNames,
      async (fileName) => {
        try {
          const specialConfig = specialFileHandlers[fileName];

          if (specialConfig?.variants) {
            // Handle files with variants (like LICENSE)
            for (const variant of specialConfig.variants) {
              const file = await findFileCaseInsensitive(variant);
              if (file) {
                const outputName = specialConfig.outputName || fileName;
                await fs.copy(file, path.join(outDirRoot, outputName));
                relinka(
                  "verbose",
                  `Copied ${file} to ${outDirRoot}/${outputName}`,
                );
                break;
              }
            }
          } else {
            // Handle standard files
            const file = await findFileCaseInsensitive(fileName);
            if (file) {
              await fs.copy(file, path.join(outDirRoot, fileName));
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
export async function getDirectorySize(
  outDirRoot: string,
  isDev: boolean,
): Promise<number> {
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
      relinka(
        "verbose",
        `Calculated directory size: ${totalSize} bytes for ${outDirRoot}`,
      );
    }
    return totalSize;
  } catch (error) {
    relinka(
      "error",
      `Failed to calculate directory size for ${outDirRoot}`,
      error,
    );
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
    relinka(
      "error",
      `[outDirBinFilesCount] Directory does not exist: ${outDirBin}`,
    );
    return fileCount;
  }
  async function traverse(dir: string) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await traverse(fullPath);
      } else if (stats.isFile()) {
        fileCount++;
      }
    }
  }
  await traverse(outDirBin);
  relinka("verbose", `Total file count in ${outDirBin}: ${fileCount}`);
  return fileCount;
}

/**
 * Finds a file in the current directory regardless of case.
 */
async function findFileCaseInsensitive(
  transpileTargetFile: string,
): Promise<null | string> {
  const files = await fs.readdir(".");
  const found = files.find(
    (file) => file.toLowerCase() === transpileTargetFile.toLowerCase(),
  );
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
    relinka(
      "info",
      `Deleted snapshot directories:\n${snapshotDirs.join("\n")}`,
    );
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
      relinka(
        "verbose",
        `[${distName}] Successfully read file: ${filePath} [Reason: ${reason}]`,
      );
    }
    return content;
  } catch (error) {
    relinka(
      "error",
      `[${distName}] Failed to read file: ${filePath} [Reason: ${reason}]`,
      error,
    );
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
    relinka(
      "verbose",
      `Successfully wrote file: ${filePath} [Reason: ${reason}]`,
    );
  } catch (error) {
    relinka(
      "error",
      `Failed to write file: ${filePath} [Reason: ${reason}]`,
      error,
    );
    throw error;
  }
}
