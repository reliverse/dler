// apps/dler/src/cmds/build/cache.ts

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DependencyTracker } from "./dependency-tracker";
import type { BuildOptions, CacheEntry, CacheOptions, PackageInfo } from "./types";

const DEFAULT_CACHE_DIR = join(".reliverse", "dler", "cache", "build");
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class BuildCache {
  private options: CacheOptions;
  private dependencyTracker: DependencyTracker;
  private hits = 0;
  private misses = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    const homeDir = homedir();
    const cacheDir = options.directory ?? join(homeDir, DEFAULT_CACHE_DIR);
    
    this.options = {
      enabled: options.enabled ?? true,
      directory: cacheDir,
      ttl: options.ttl ?? DEFAULT_TTL,
    };

    this.dependencyTracker = new DependencyTracker();

    if (this.options.enabled) {
      this.ensureCacheDirectory();
    }
  }

  private ensureCacheDirectory(): void {
    if (!existsSync(this.options.directory)) {
      mkdirSync(this.options.directory, { recursive: true });
    }
  }

  private getCacheKey(pkg: PackageInfo, options: BuildOptions): string {
    const buildConfig = {
      entryPoints: pkg.entryPoints,
      outputDir: pkg.outputDir,
      target: options.target,
      format: options.format,
      minify: options.minify,
      sourcemap: options.sourcemap,
      splitting: options.splitting,
      external: options.external,
      bytecode: options.bytecode,
      drop: options.drop,
      packages: options.packages,
      publicPath: options.publicPath,
      root: options.root,
      define: options.define,
      naming: options.naming,
      env: options.env,
      banner: options.banner,
      footer: options.footer,
      conditions: options.conditions,
      loader: options.loader,
      ignoreDCEAnnotations: options.ignoreDCEAnnotations,
      emitDCEAnnotations: options.emitDCEAnnotations,
    };

    const configString = JSON.stringify(buildConfig, Object.keys(buildConfig).sort());
    const configHash = createHash('sha256').update(configString).digest('hex');
    
    // Include project path in hash to avoid collisions between different projects
    const projectHash = createHash('sha256').update(pkg.path).digest('hex').substring(0, 8);
    
    return `${pkg.name}-${projectHash}-${configHash}`;
  }

  private getCacheFilePath(key: string): string {
    return join(this.options.directory, `${key}.json`);
  }

  private async getSourceHash(pkg: PackageInfo): Promise<string> {
    const hashes: string[] = [];
    
    // Track dependencies for all entry points
    await this.dependencyTracker.trackDependencies(pkg.entryPoints);
    
    // Hash all tracked files (entry points + dependencies)
    const graph = this.dependencyTracker.getGraph();
    for (const filePath of Object.keys(graph)) {
      const fileHash = this.dependencyTracker.getFileHash(filePath);
      if (fileHash) {
        hashes.push(fileHash);
      }
    }

    // Hash package.json for build config changes
    const packageJsonPath = join(pkg.path, 'package.json');
    if (existsSync(packageJsonPath)) {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      hashes.push(hash);
    }

    // Hash tsconfig.json if it exists
    const tsconfigPath = join(pkg.path, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      const content = readFileSync(tsconfigPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      hashes.push(hash);
    }

    return createHash('sha256').update(hashes.join('')).digest('hex');
  }

  async get(pkg: PackageInfo, options: BuildOptions): Promise<CacheEntry | null> {
    if (!this.options.enabled) {
      this.misses++;
      return null;
    }

    try {
      const key = this.getCacheKey(pkg, options);
      const cacheFilePath = this.getCacheFilePath(key);
      
      if (!existsSync(cacheFilePath)) {
        this.misses++;
        return null;
      }

      const cacheData = JSON.parse(readFileSync(cacheFilePath, 'utf-8'));
      const entry: CacheEntry = cacheData;

      // Check if cache is expired
      const now = Date.now();
      if (now - entry.timestamp > this.options.ttl) {
        this.delete(key);
        this.misses++;
        return null;
      }

      // Check if source files or dependencies have changed
      const currentSourceHash = await this.getSourceHash(pkg);
      if (entry.hash !== currentSourceHash) {
        this.delete(key);
        this.misses++;
        return null;
      }

      // Verify output files still exist
      for (const outputFile of entry.outputFiles) {
        if (!existsSync(outputFile)) {
          this.delete(key);
          this.misses++;
          return null;
        }
      }

      this.hits++;
      return entry;
    } catch (error) {
      // If cache is corrupted, ignore it
      this.misses++;
      return null;
    }
  }

  async set(pkg: PackageInfo, options: BuildOptions, result: {
    buildTime: number;
    bundleSize: number;
    outputFiles: string[];
  }): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    try {
      const key = this.getCacheKey(pkg, options);
      const sourceHash = await this.getSourceHash(pkg);
      
      const entry: CacheEntry = {
        hash: sourceHash,
        timestamp: Date.now(),
        buildTime: result.buildTime,
        bundleSize: result.bundleSize,
        outputFiles: result.outputFiles,
      };

      const cacheFilePath = this.getCacheFilePath(key);
      writeFileSync(cacheFilePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      // Silently fail cache writes
    }
  }

  delete(key: string): void {
    if (!this.options.enabled) {
      return;
    }

    try {
      const cacheFilePath = this.getCacheFilePath(key);
      if (existsSync(cacheFilePath)) {
        const fs = require('node:fs');
        fs.unlinkSync(cacheFilePath);
      }
    } catch (error) {
      // Silently fail cache deletion
    }
  }

  clear(): void {
    if (!this.options.enabled) {
      return;
    }

    try {
      const fs = require('node:fs');
      const path = require('node:path');
      
      if (existsSync(this.options.directory)) {
        const files = fs.readdirSync(this.options.directory);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.options.directory, file));
          }
        }
      }
    } catch (error) {
      // Silently fail cache clearing
    }
  }

  getStats(): { hits: number; misses: number; size: number } {
    if (!this.options.enabled) {
      return { hits: 0, misses: 0, size: 0 };
    }

    try {
      const fs = require('node:fs');
      const path = require('node:path');
      
      if (!existsSync(this.options.directory)) {
        return { hits: this.hits, misses: this.misses, size: 0 };
      }

      const files = fs.readdirSync(this.options.directory);
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
      
      let totalSize = 0;
      for (const file of jsonFiles) {
        const filePath = path.join(this.options.directory, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        hits: this.hits,
        misses: this.misses,
        size: totalSize,
      };
    } catch (error) {
      return { hits: this.hits, misses: this.misses, size: 0 };
    }
  }
}
