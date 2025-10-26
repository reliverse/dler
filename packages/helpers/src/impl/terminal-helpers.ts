import { cwd } from "node:process";
import { normalize } from "path";
import fs from "fs/promises";

export async function ensuredir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export const handleError = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

/**
 * Changes the current working directory to the specified path.
 * Logs a warning if the target directory does not exist.
 */
export async function cd(dir: string): Promise<void> {
  try {
    await ensuredir(dir);
    await fs.access(dir);
    process.chdir(dir);
    console.log(`Changed directory to: ${process.cwd()}`);
  } catch (error) {
    console.warn(`Directory does not exist: ${dir}`, handleError(error));
  }
}

/**
 * Returns the current working directory.
 */
export function pwd() {
  // Re-check the current working directory
  const cwd = getCurrentWorkingDirectory();
  console.log(`Current working directory: ${cwd}`);
}

/**
 * Removes a file or directory (recursively, if it's a directory).
 * Logs an error if removal fails.
 */
export async function rm(target: string): Promise<void> {
  try {
    await fs.rm(target, { recursive: true, force: true });
    console.log(`Removed: ${target}`);
  } catch (error) {
    console.error(`Failed to remove: ${target}`, handleError(error));
  }
}

/**
 * Returns the current working directory.
 */
export function getCurrentWorkingDirectory(useCache = true): string {
  let cachedCWD: null | string = null;
  if (useCache && cachedCWD) {
    return cachedCWD;
  }
  try {
    const currentDirectory = normalize(cwd());
    if (useCache) {
      cachedCWD = currentDirectory;
    }
    return currentDirectory;
  } catch (error) {
    console.error(
      "Error getting current working directory:",
      handleError(error),
    );
    throw error;
  }
}
