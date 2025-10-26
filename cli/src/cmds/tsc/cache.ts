// apps/dler/src/cmds/tsc/cache.ts

import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageInfo } from "./impl";
import type {
  CacheMetadata,
  PackageCacheEntry,
  SourceFileInfo,
  TscCacheOptions,
} from "./types";

const CACHE_VERSION = "1.0.0";
const DEFAULT_CACHE_DIR = "node_modules/.cache/dler-tsc";
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export class TscCache {
  private options: TscCacheOptions;
  private metadata: CacheMetadata | null = null;
  private metadataPath: string;

  constructor(options: Partial<TscCacheOptions> = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      cacheDir: options.cacheDir ?? DEFAULT_CACHE_DIR,
      maxAge: options.maxAge ?? DEFAULT_MAX_AGE,
    };
    this.metadataPath = join(this.options.cacheDir, "metadata.json");
  }

  async initialize(): Promise<void> {
    if (!this.options.enabled) return;

    try {
      await mkdir(this.options.cacheDir, { recursive: true });
      await this.loadMetadata();
    } catch (error) {
      // Cache initialization failed, disable caching
      this.options.enabled = false;
    }
  }

  private async loadMetadata(): Promise<void> {
    if (!existsSync(this.metadataPath)) {
      this.metadata = {
        version: CACHE_VERSION,
        lastUpdated: Date.now(),
        packages: {},
      };
      return;
    }

    try {
      const content = await readFile(this.metadataPath, "utf-8");
      this.metadata = JSON.parse(content) as CacheMetadata;

      // Check if cache is too old
      if (Date.now() - this.metadata.lastUpdated > this.options.maxAge) {
        this.metadata = {
          version: CACHE_VERSION,
          lastUpdated: Date.now(),
          packages: {},
        };
      }
    } catch {
      this.metadata = {
        version: CACHE_VERSION,
        lastUpdated: Date.now(),
        packages: {},
      };
    }
  }

  private async saveMetadata(): Promise<void> {
    if (!this.options.enabled || !this.metadata) return;

    try {
      this.metadata.lastUpdated = Date.now();
      await writeFile(
        this.metadataPath,
        JSON.stringify(this.metadata, null, 2),
        "utf-8",
      );
    } catch {
      // Ignore save errors
    }
  }

  private async getSourceFiles(packagePath: string): Promise<SourceFileInfo[]> {
    const sourceFiles: SourceFileInfo[] = [];
    const tsConfigPath = join(packagePath, "tsconfig.json");

    if (!existsSync(tsConfigPath)) {
      return sourceFiles;
    }

    try {
      // Find all TypeScript files in the package
      const glob = new Bun.Glob("**/*.{ts,tsx}");
      const matches = glob.scanSync({
        cwd: packagePath,
        onlyFiles: true,
      });

      for (const match of matches) {
        const filePath = join(packagePath, match);
        if (existsSync(filePath)) {
          const stats = statSync(filePath);
          sourceFiles.push({
            path: match,
            mtime: stats.mtime.getTime(),
            size: stats.size,
          });
        }
      }
    } catch {
      // Ignore glob errors
    }

    return sourceFiles;
  }

  private hasSourceFilesChanged(
    cached: SourceFileInfo[],
    current: SourceFileInfo[],
  ): boolean {
    if (cached.length !== current.length) return true;

    const currentMap = new Map(current.map((file) => [file.path, file]));

    for (const cachedFile of cached) {
      const currentFile = currentMap.get(cachedFile.path);
      if (
        !currentFile ||
        currentFile.mtime !== cachedFile.mtime ||
        currentFile.size !== cachedFile.size
      ) {
        return true;
      }
    }

    return false;
  }

  async shouldSkipPackage(pkg: PackageInfo): Promise<boolean> {
    if (!this.options.enabled || !this.metadata) return false;

    const cacheEntry = this.metadata.packages[pkg.name];
    if (!cacheEntry || !cacheEntry.lastSuccess) return false;

    // Check if package was successfully checked recently
    const timeSinceLastSuccess = Date.now() - cacheEntry.lastSuccess;
    if (timeSinceLastSuccess > this.options.maxAge) return false;

    // Check if source files have changed
    const currentSourceFiles = await this.getSourceFiles(pkg.path);
    if (
      this.hasSourceFilesChanged(cacheEntry.sourceFiles, currentSourceFiles)
    ) {
      return false;
    }

    return true;
  }

  async getCachedResult(pkg: PackageInfo): Promise<PackageCacheEntry | null> {
    if (!this.options.enabled || !this.metadata) return null;

    const cacheEntry = this.metadata.packages[pkg.name];
    if (!cacheEntry) return null;

    // Check if source files have changed
    const currentSourceFiles = await this.getSourceFiles(pkg.path);
    if (
      this.hasSourceFilesChanged(cacheEntry.sourceFiles, currentSourceFiles)
    ) {
      return null;
    }

    return cacheEntry;
  }

  async updatePackageCache(
    pkg: PackageInfo,
    result: {
      success: boolean;
      errorCount: number;
      warningCount: number;
      output?: string;
      filteredOutput?: string;
    },
  ): Promise<void> {
    if (!this.options.enabled || !this.metadata) return;

    const sourceFiles = await this.getSourceFiles(pkg.path);
    const now = Date.now();

    this.metadata.packages[pkg.name] = {
      lastCheck: now,
      lastSuccess: result.success
        ? now
        : (this.metadata.packages[pkg.name]?.lastSuccess ?? null),
      sourceFiles,
      hasErrors: !result.success,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      output: result.output,
      filteredOutput: result.filteredOutput,
    };

    await this.saveMetadata();
  }

  async clearCache(): Promise<void> {
    if (!this.options.enabled) return;

    this.metadata = {
      version: CACHE_VERSION,
      lastUpdated: Date.now(),
      packages: {},
    };

    await this.saveMetadata();
  }

  getCacheStats(): { totalPackages: number; successfulPackages: number } {
    if (!this.metadata) return { totalPackages: 0, successfulPackages: 0 };

    const totalPackages = Object.keys(this.metadata.packages).length;
    const successfulPackages = Object.values(this.metadata.packages).filter(
      (entry) => entry.lastSuccess !== null,
    ).length;

    return { totalPackages, successfulPackages };
  }
}
