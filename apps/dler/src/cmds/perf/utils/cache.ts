// apps/dler/src/cmds/perf/utils/cache.ts

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CacheEntry, CacheOptions, PerfReport } from "../types";

export class PerfCache {
  private options: CacheOptions;
  private cacheDir: string;

  constructor(options: CacheOptions) {
    this.options = options;
    this.cacheDir = resolve(options.cacheDir);
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private generateHash(report: PerfReport): string {
    const content = JSON.stringify({
      target: report.options.target,
      type: report.options.type,
      // Exclude timestamp and other volatile fields
      benchmark: report.benchmark
        ? {
            command: report.benchmark.command,
            runs: report.benchmark.runs,
            concurrency: report.benchmark.concurrency,
          }
        : undefined,
    });

    return createHash("sha256").update(content).digest("hex").substring(0, 16);
  }

  private getCachePath(hash: string): string {
    return join(this.cacheDir, `${hash}.json`);
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!this.options.enabled) return true;

    const age = Date.now() - entry.timestamp;
    return age > this.options.maxAge;
  }

  async save(report: PerfReport): Promise<void> {
    if (!this.options.enabled) return;

    try {
      const hash = this.generateHash(report);
      const entry: CacheEntry = {
        timestamp: Date.now(),
        report,
        hash,
      };

      const cachePath = this.getCachePath(hash);
      writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      // Silently fail cache operations
      console.warn("Failed to save performance cache:", error);
    }
  }

  async load(target: string, type?: string): Promise<PerfReport | null> {
    if (!this.options.enabled) return null;

    try {
      // Find all cache files
      const cacheFiles = Array.from(
        new Bun.Glob("*.json").scanSync({ cwd: this.cacheDir }),
      );

      for (const file of cacheFiles) {
        const cachePath = join(this.cacheDir, file);

        try {
          const content = readFileSync(cachePath, "utf-8");
          const entry: CacheEntry = JSON.parse(content);

          if (this.isExpired(entry)) {
            continue;
          }

          // Check if this matches our target
          if (
            entry.report.options.target === target &&
            (!type || entry.report.options.type === type)
          ) {
            return entry.report;
          }
        } catch {
          // Skip invalid cache files
          continue;
        }
      }

      return null;
    } catch (error) {
      // Silently fail cache operations
      console.warn("Failed to load performance cache:", error);
      return null;
    }
  }

  async findBaseline(
    target: string,
    type?: string,
  ): Promise<PerfReport | null> {
    return this.load(target, type);
  }

  async listBaselines(): Promise<
    Array<{ target: string; type?: string; timestamp: number; hash: string }>
  > {
    if (!this.options.enabled) return [];

    try {
      const cacheFiles = Array.from(
        new Bun.Glob("*.json").scanSync({ cwd: this.cacheDir }),
      );
      const baselines: Array<{
        target: string;
        type?: string;
        timestamp: number;
        hash: string;
      }> = [];

      for (const file of cacheFiles) {
        const cachePath = join(this.cacheDir, file);

        try {
          const content = readFileSync(cachePath, "utf-8");
          const entry: CacheEntry = JSON.parse(content);

          if (!this.isExpired(entry)) {
            baselines.push({
              target: entry.report.options.target ?? "unknown",
              type: entry.report.options.type,
              timestamp: entry.timestamp,
              hash: entry.hash,
            });
          }
        } catch {
          // Skip invalid cache files
          continue;
        }
      }

      return baselines.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.warn("Failed to list performance baselines:", error);
      return [];
    }
  }

  async clear(): Promise<void> {
    if (!this.options.enabled) return;

    try {
      const cacheFiles = Array.from(
        new Bun.Glob("*.json").scanSync({ cwd: this.cacheDir }),
      );

      for (const file of cacheFiles) {
        const cachePath = join(this.cacheDir, file);
        try {
          Bun.write(cachePath, "");
        } catch {
          // Ignore deletion errors
        }
      }
    } catch (error) {
      console.warn("Failed to clear performance cache:", error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.options.enabled) return;

    try {
      const cacheFiles = Array.from(
        new Bun.Glob("*.json").scanSync({ cwd: this.cacheDir }),
      );

      for (const file of cacheFiles) {
        const cachePath = join(this.cacheDir, file);

        try {
          const content = readFileSync(cachePath, "utf-8");
          const entry: CacheEntry = JSON.parse(content);

          if (this.isExpired(entry)) {
            Bun.write(cachePath, "");
          }
        } catch {
          // Skip invalid cache files
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup performance cache:", error);
    }
  }

  getCacheSize(): number {
    try {
      const cacheFiles = Array.from(
        new Bun.Glob("*.json").scanSync({ cwd: this.cacheDir }),
      );
      return cacheFiles.length;
    } catch {
      return 0;
    }
  }
}

export const createPerfCache = (
  options: Partial<CacheOptions> = {},
): PerfCache => {
  const defaultOptions: CacheOptions = {
    enabled: true,
    cacheDir: ".dler-cache/perf",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  return new PerfCache({ ...defaultOptions, ...options });
};
