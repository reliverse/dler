// packages/launcher/src/impl/launcher/discovery.ts

import pMap from "@reliverse/dler-mapper";
import { Glob } from "bun";
import { loadMetadataCache, saveMetadataCache } from "./cache";
import { CommandLoadError } from "./errors";
import type { CmdDefinition, CmdMetadata, DiscoveryResult } from "./types";

// Cache for file stats to avoid repeated filesystem calls
const fileStatsCache = new Map<string, { mtime: number; size: number }>();

// Module instance cache to prevent duplicate imports
const moduleCache = new Map<string, CmdDefinition>();

const getFileStats = async (filePath: string) => {
  const cached = fileStatsCache.get(filePath);
  if (cached) return cached;

  const stats = await Bun.file(filePath).stat();
  const result = { mtime: stats.mtime.getTime(), size: stats.size };
  fileStatsCache.set(filePath, result);
  return result;
};

// Lazy metadata loader that only loads when needed
const createLazyMetadataLoader = (filePath: string, cmdName: string) => {
  let cachedMetadata: CmdMetadata | null = null;
  let isLoading = false;
  let loadPromise: Promise<CmdMetadata> | null = null;

  return async (): Promise<CmdMetadata> => {
    if (cachedMetadata) return cachedMetadata;

    if (isLoading && loadPromise) {
      return loadPromise;
    }

    isLoading = true;
    loadPromise = (async () => {
      try {
        // Only load the module to extract metadata, don't execute handler
        const module = await import(filePath);
        const definition = module.default;

        if (!definition || !definition.cfg) {
          throw new Error("Invalid command definition");
        }

        const cmdMetadata: CmdMetadata = {
          name: definition.cfg.name,
          description: definition.cfg.description,
          category: definition.cfg.category,
          aliases: definition.cfg.aliases,
          version: definition.cfg.version,
          examples: definition.cfg.examples,
        };

        cachedMetadata = cmdMetadata;
        return cmdMetadata;
      } catch (error) {
        throw new CommandLoadError(cmdName, error);
      } finally {
        isLoading = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  };
};

export const discoverCommands = async (
  cmdsDir: string,
  baseDir?: string,
): Promise<DiscoveryResult> => {
  const registry = new Map();
  const aliases = new Map();
  const metadata = new Map<string, () => Promise<CmdMetadata>>();
  const fileStats = new Map<string, { mtime: number; size: number }>();
  const filePaths = new Map<string, string>();
  const loadedMetadata = new Map<string, CmdMetadata>();

  // Try to load from cache first
  const cachedMetadata = await loadMetadataCache();
  const cachedMetadataMap = new Map<string, CmdMetadata>();

  if (cachedMetadata) {
    for (const [cmdName, cmdMetadata] of cachedMetadata) {
      cachedMetadataMap.set(cmdName, cmdMetadata);
    }
  }

  const glob = new Glob("*/cmd.ts");
  const cwd = baseDir ? `${baseDir}/${cmdsDir}` : `${process.cwd()}/${cmdsDir}`;

  // Collect all files first, then process in parallel
  const files = await Array.fromAsync(glob.scan(cwd));

  // Process all files in parallel with controlled concurrency
  const fileData = await pMap(
    files,
    async (file) => {
      const cmdName = file.split(/[/\\]/)[0];
      const filePath = `${cwd}/${file}`;
      const stats = await getFileStats(filePath);

      return {
        cmdName: cmdName!,
        filePath,
        stats,
        file,
      };
    },
    { concurrency: 10 }, // Limit concurrency to avoid overwhelming filesystem
  );

  // Process all file data
  for (const { cmdName, filePath, stats } of fileData) {
    const loader = async (): Promise<CmdDefinition> => {
      // Check module cache first
      if (moduleCache.has(filePath)) {
        return moduleCache.get(filePath)!;
      }

      try {
        const module = await import(filePath);
        const definition = module.default;

        if (!definition || typeof definition.handler !== "function") {
          throw new Error("Invalid command definition");
        }

        // Cache the module instance
        moduleCache.set(filePath, definition);
        return definition;
      } catch (error) {
        throw new CommandLoadError(cmdName, error);
      }
    };

    fileStats.set(cmdName, stats);
    filePaths.set(cmdName, filePath);

    // Check if we have valid cached metadata
    const cachedMeta = cachedMetadataMap.get(cmdName);
    if (cachedMeta && (await isCacheValid(filePath, stats))) {
      // Use cached metadata
      const lazyMetadataLoader = () => Promise.resolve(cachedMeta);
      metadata.set(cmdName, lazyMetadataLoader);
      loadedMetadata.set(cmdName, cachedMeta);

      // Register aliases from cached metadata
      if (cachedMeta.aliases) {
        for (const alias of cachedMeta.aliases) {
          aliases.set(alias, cmdName);
        }
      }
    } else {
      // Create lazy metadata loader for uncached commands
      const lazyMetadataLoader = createLazyMetadataLoader(filePath, cmdName);
      metadata.set(cmdName, lazyMetadataLoader);
    }

    registry.set(cmdName, loader);
  }

  // Save updated cache in background (don't await)
  saveMetadataCache(loadedMetadata, fileStats, filePaths).catch(() => {
    // Ignore cache save errors
  });

  return { registry, aliases, metadata };
};

const isCacheValid = async (
  filePath: string,
  stats: { mtime: number; size: number },
): Promise<boolean> => {
  try {
    const file = Bun.file(filePath);
    const fileStats = await file.stat();
    return (
      fileStats.mtime.getTime() === stats.mtime && fileStats.size === stats.size
    );
  } catch {
    return false;
  }
};

export const validateCommandStructure = (
  definition: unknown,
): definition is CmdDefinition => {
  if (typeof definition !== "object" || definition === null) return false;

  const def = definition as Record<string, unknown>;

  return (
    typeof def.handler === "function" &&
    typeof def.args === "object" &&
    def.args !== null &&
    typeof def.cfg === "object" &&
    def.cfg !== null &&
    typeof (def.cfg as Record<string, unknown>).name === "string"
  );
};
