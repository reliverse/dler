// packages/launcher/src/impl/launcher/cache.ts

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pMap from "@reliverse/dler-mapper";
import type { CmdMetadata } from "./types";

interface CacheEntry {
  metadata: CmdMetadata;
  filePath: string;
  mtime: number;
  size: number;
}

interface CacheData {
  entries: Record<string, CacheEntry>;
  version: string;
}

const CACHE_VERSION = "1.0.0";
const CACHE_DIR = ".reliverse/dler/cache/launcher";
const CACHE_FILE = "metadata.json";

const getCachePath = (): string => {
  const homeDir = homedir();
  const cacheDir = join(homeDir, CACHE_DIR);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  return join(cacheDir, CACHE_FILE);
};

const isCacheValid = async (entry: CacheEntry): Promise<boolean> => {
  try {
    const file = Bun.file(entry.filePath);
    const stats = await file.stat();
    return entry.mtime === stats.mtime.getTime() && entry.size === stats.size;
  } catch {
    return false;
  }
};

export const loadMetadataCache = async (): Promise<Map<
  string,
  CmdMetadata
> | null> => {
  const cachePath = getCachePath();

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const cacheFile = Bun.file(cachePath);
    const cacheData: CacheData = await cacheFile.json();

    if (cacheData.version !== CACHE_VERSION) {
      return null;
    }

    // Validate all cache entries in parallel with controlled concurrency
    const results = await pMap(
      Object.entries(cacheData.entries),
      async ([cmdName, entry]) => ({
        cmdName,
        metadata: (await isCacheValid(entry)) ? entry.metadata : null,
      }),
      { concurrency: 20 }, // Higher concurrency for cache validation
    );

    const metadataMap = new Map<string, CmdMetadata>();
    for (const { cmdName, metadata } of results) {
      if (metadata) {
        metadataMap.set(cmdName, metadata);
      }
    }

    return metadataMap.size > 0 ? metadataMap : null;
  } catch {
    return null;
  }
};

export const saveMetadataCache = async (
  metadata: Map<string, CmdMetadata>,
  fileStats: Map<string, { mtime: number; size: number }>,
  filePaths: Map<string, string>,
): Promise<void> => {
  const cachePath = getCachePath();
  const entries: Record<string, CacheEntry> = {};

  for (const [cmdName, cmdMetadata] of metadata) {
    const stats = fileStats.get(cmdName);
    const filePath = filePaths.get(cmdName);
    if (stats && filePath) {
      entries[cmdName] = {
        metadata: cmdMetadata,
        filePath,
        mtime: stats.mtime,
        size: stats.size,
      };
    }
  }

  const cacheData: CacheData = {
    entries,
    version: CACHE_VERSION,
  };

  await Bun.write(cachePath, JSON.stringify(cacheData, null, 2));
};

export const clearMetadataCache = (): void => {
  const cachePath = getCachePath();
  if (existsSync(cachePath)) {
    Bun.write(cachePath, "{}");
  }
};
