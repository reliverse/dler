// packages/build/src/impl/watch.ts

import type { FSWatcher } from "node:fs";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { relinka } from "@reliverse/relinka";
import { DEFAULT_DEBOUNCE_MS, DEFAULT_IGNORE_PATTERNS } from "./constants";
import type { BuildOptions, PackageInfo } from "./types";
import { RebuildQueueProcessor } from "./utils/rebuild-queue";

export interface WatchOptions extends BuildOptions {
  debounceMs?: number;
  ignorePatterns?: string[];
  incremental?: boolean;
}

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private rebuildQueue: RebuildQueueProcessor;
  private options: WatchOptions;
  private packages: PackageInfo[];

  constructor(packages: PackageInfo[], options: WatchOptions) {
    this.packages = packages;
    this.options = {
      debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      ignorePatterns: options.ignorePatterns ?? [...DEFAULT_IGNORE_PATTERNS],
      incremental: options.incremental ?? true,
      ...options,
    };
    this.rebuildQueue = new RebuildQueueProcessor(packages, {
      debounceMs: this.options.debounceMs,
      incremental: this.options.incremental,
      buildOptions: this.options,
    });
  }

  async start(): Promise<void> {
    await relinka.info(`👀 Starting file watcher for ${this.packages.length} packages...`);

    for (const pkg of this.packages) {
      if (pkg.entryPoints.length === 0) continue;

      await this.watchPackage(pkg);
    }

    await relinka.success("✅ File watching started");
  }

  async stop(): Promise<void> {
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        await relinka.warn(
          `Failed to close watcher for ${path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.watchers.clear();

    this.rebuildQueue.clear();

    await relinka.info("File watching stopped");
  }

  private async watchPackage(pkg: PackageInfo): Promise<void> {
    // Watch entry point files
    for (const entryPoint of pkg.entryPoints) {
      if (existsSync(entryPoint)) {
        await this.watchFile(entryPoint, pkg);
      }
    }

    // Watch source directory if it exists
    const srcDir = join(pkg.path, "src");
    if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
      await this.watchDirectory(srcDir, pkg);
    }

    // Watch package.json for config changes
    const packageJsonPath = join(pkg.path, "package.json");
    if (existsSync(packageJsonPath)) {
      await this.watchFile(packageJsonPath, pkg);
    }

    // Watch tsconfig.json if it exists
    const tsconfigPath = join(pkg.path, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      await this.watchFile(tsconfigPath, pkg);
    }
  }

  private async watchFile(filePath: string, pkg: PackageInfo): Promise<void> {
    if (this.watchers.has(filePath)) return;

    try {
      // Use fs.watch as the primary method
      const { watch } = await import("node:fs");
      const watcher = watch(filePath, (eventType) => {
        if (eventType === "change") {
          this.handleFileChange(filePath, pkg);
        }
      });

      watcher.on("error", (error) => {
        void relinka.warn(`File watcher error for ${filePath}: ${error.message}`);
        this.watchers.delete(filePath);
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      void relinka.warn(`Failed to watch file ${filePath}: ${error}`);
    }
  }

  private async watchDirectory(dirPath: string, pkg: PackageInfo): Promise<void> {
    if (this.watchers.has(dirPath)) return;

    try {
      const { watch } = await import("node:fs");
      const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (eventType === "change" && filename) {
          const fullPath = join(dirPath, filename);
          this.handleFileChange(fullPath, pkg);
        }
      });

      watcher.on("error", (error) => {
        void relinka.warn(`Directory watcher error for ${dirPath}: ${error.message}`);
        this.watchers.delete(dirPath);
      });

      this.watchers.set(dirPath, watcher);
    } catch (error) {
      void relinka.warn(`Failed to watch directory ${dirPath}: ${error}`);
    }
  }

  private handleFileChange(filePath: string, pkg: PackageInfo): void {
    // Check if file should be ignored
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }

    // Fire-and-forget logging for concurrent file changes
    void relinka.info(`📝 File changed: ${filePath}`);

    // Add package to rebuild queue
    this.rebuildQueue.add(pkg.name);
  }

  private shouldIgnoreFile(filePath: string): boolean {
    if (!this.options.ignorePatterns) return false;

    // Use simple glob matching for common patterns
    for (const pattern of this.options.ignorePatterns) {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, ".*") // ** matches any path
        .replace(/\*/g, "[^/]*") // * matches any chars except /
        .replace(/\?/g, "[^/]") // ? matches single char except /
        .replace(/\./g, "\\."); // Escape dots

      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(filePath) || regex.test(filePath.replace(/\\/g, "/"))) {
        return true;
      }
    }

    return false;
  }
}

export async function startWatchMode(
  packages: PackageInfo[],
  options: WatchOptions,
): Promise<void> {
  const watcher = new FileWatcher(packages, options);

  // Handle graceful shutdown
  const shutdown = async () => {
    await relinka.info("\n🛑 Shutting down watch mode...");
    await watcher.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await watcher.start();

  // Keep the process alive
  return new Promise(() => {
    // This will keep the process running indefinitely
  });
}
