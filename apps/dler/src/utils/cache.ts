import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_BASE_DIR = "node_modules/.cache/dler";

/**
 * Get the cache file path for a specific command
 */
export function getCacheFilePath(commandName: string): string {
  return join(CACHE_BASE_DIR, `${commandName}.json`);
}

/**
 * Ensure the cache directory exists
 */
export async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_BASE_DIR, { recursive: true });
  } catch {
    // Ignore directory creation errors
  }
}

/**
 * Load JSON data from cache file
 */
export async function loadCache<T>(commandName: string): Promise<T | null> {
  const cachePath = getCacheFilePath(commandName);

  try {
    if (!existsSync(cachePath)) {
      return null;
    }

    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Save JSON data to cache file
 */
export async function saveCache<T>(commandName: string, data: T): Promise<void> {
  const cachePath = getCacheFilePath(commandName);

  try {
    await ensureCacheDir();
    await writeFile(cachePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore cache save errors
  }
}

/**
 * Check if cache file exists and get its modification time
 */
export function getCacheFileInfo(commandName: string): { exists: boolean; mtime?: number } {
  const cachePath = getCacheFilePath(commandName);

  if (!existsSync(cachePath)) {
    return { exists: false };
  }

  try {
    const stats = statSync(cachePath);
    return { exists: true, mtime: stats.mtime.getTime() };
  } catch {
    return { exists: false };
  }
}

/**
 * Clear cache for a specific command
 */
export async function clearCommandCache(commandName: string): Promise<void> {
  const cachePath = getCacheFilePath(commandName);

  try {
    if (existsSync(cachePath)) {
      await writeFile(cachePath, "{}", "utf-8");
    }
  } catch {
    // Ignore cache clear errors
  }
}

/**
 * Clear all dler caches
 */
export async function clearAllCaches(): Promise<void> {
  try {
    // For now, just ensure the cache directory exists
    // Individual command caches will be cleared as needed
    await ensureCacheDir();
  } catch {
    // Ignore errors
  }
}
