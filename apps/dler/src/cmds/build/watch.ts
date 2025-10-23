// apps/dler/src/cmds/build/watch.ts

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { BuildOptions, PackageInfo } from "./types";

export interface WatchOptions extends BuildOptions {
  debounceMs?: number;
  ignorePatterns?: string[];
  incremental?: boolean;
}

export class FileWatcher {
  private watchers: Map<string, any> = new Map();
  private rebuildQueue: Set<string> = new Set();
  private rebuildTimeout: NodeJS.Timeout | null = null;
  private options: WatchOptions;
  private packages: PackageInfo[];

  constructor(packages: PackageInfo[], options: WatchOptions) {
    this.packages = packages;
    this.options = {
      debounceMs: options.debounceMs ?? 300,
      ignorePatterns: options.ignorePatterns ?? ['node_modules/**', 'dist/**', '.git/**', '**/*.log', '**/.DS_Store'],
      incremental: options.incremental ?? true,
      ...options,
    };
  }

  async start(): Promise<void> {
    logger.info(`👀 Starting file watcher for ${this.packages.length} packages...`);

    for (const pkg of this.packages) {
      if (pkg.entryPoints.length === 0) continue;

      await this.watchPackage(pkg);
    }

    logger.success("✅ File watching started");
  }

  async stop(): Promise<void> {
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        logger.warn(`Failed to close watcher for ${path}: ${error}`);
      }
    }
    this.watchers.clear();

    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
      this.rebuildTimeout = null;
    }

    logger.info("File watching stopped");
  }

  private async watchPackage(pkg: PackageInfo): Promise<void> {
    // Watch entry point files
    for (const entryPoint of pkg.entryPoints) {
      if (existsSync(entryPoint)) {
        await this.watchFile(entryPoint, pkg);
      }
    }

    // Watch source directory if it exists
    const srcDir = join(pkg.path, 'src');
    if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
      await this.watchDirectory(srcDir, pkg);
    }

    // Watch package.json for config changes
    const packageJsonPath = join(pkg.path, 'package.json');
    if (existsSync(packageJsonPath)) {
      await this.watchFile(packageJsonPath, pkg);
    }

    // Watch tsconfig.json if it exists
    const tsconfigPath = join(pkg.path, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      await this.watchFile(tsconfigPath, pkg);
    }
  }

  private async watchFile(filePath: string, pkg: PackageInfo): Promise<void> {
    if (this.watchers.has(filePath)) return;

    try {
      // Use fs.watch as the primary method
      const { watch } = await import('node:fs');
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange(filePath, pkg);
        }
      });

      watcher.on('error', (error) => {
        logger.warn(`File watcher error for ${filePath}: ${error.message}`);
        this.watchers.delete(filePath);
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      logger.warn(`Failed to watch file ${filePath}: ${error}`);
    }
  }

  private async watchDirectory(dirPath: string, pkg: PackageInfo): Promise<void> {
    if (this.watchers.has(dirPath)) return;

    try {
      const { watch } = await import('node:fs');
      const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (eventType === 'change' && filename) {
          const fullPath = join(dirPath, filename);
          this.handleFileChange(fullPath, pkg);
        }
      });

      watcher.on('error', (error) => {
        logger.warn(`Directory watcher error for ${dirPath}: ${error.message}`);
        this.watchers.delete(dirPath);
      });

      this.watchers.set(dirPath, watcher);
    } catch (error) {
      logger.warn(`Failed to watch directory ${dirPath}: ${error}`);
    }
  }

  private handleFileChange(filePath: string, pkg: PackageInfo): void {
    // Check if file should be ignored
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }

    logger.info(`📝 File changed: ${filePath}`);
    
    // Add package to rebuild queue
    this.rebuildQueue.add(pkg.name);

    // Debounce rebuilds
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
    }

    this.rebuildTimeout = setTimeout(() => {
      this.processRebuildQueue();
    }, this.options.debounceMs);
  }

  private shouldIgnoreFile(filePath: string): boolean {
    if (!this.options.ignorePatterns) return false;

    // Use simple glob matching for common patterns
    for (const pattern of this.options.ignorePatterns) {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')  // ** matches any path
        .replace(/\*/g, '[^/]*') // * matches any chars except /
        .replace(/\?/g, '[^/]')  // ? matches single char except /
        .replace(/\./g, '\\.');  // Escape dots
      
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(filePath) || regex.test(filePath.replace(/\\/g, '/'))) {
        return true;
      }
    }

    return false;
  }

  private async processRebuildQueue(): Promise<void> {
    if (this.rebuildQueue.size === 0) return;

    const packagesToRebuild = Array.from(this.rebuildQueue).map(name => 
      this.packages.find(pkg => pkg.name === name)
    ).filter(Boolean) as PackageInfo[];

    this.rebuildQueue.clear();

    if (this.options.incremental) {
      logger.info(`🔄 Incrementally rebuilding ${packagesToRebuild.length} packages...`);
    } else {
      logger.info(`🔄 Rebuilding ${packagesToRebuild.length} packages...`);
    }

    // Build packages in parallel for better performance
    const buildPromises = packagesToRebuild.map(async (pkg) => {
      try {
        // Import buildPackage dynamically to avoid circular dependency
        const { buildPackage } = await import('./impl');
        const result = await buildPackage(pkg, this.options);
        
        if (result.success) {
          logger.success(`✅ ${pkg.name}: Rebuilt successfully`);
        } else {
          logger.error(`❌ ${pkg.name}: Rebuild failed`);
          for (const error of result.errors) {
            logger.error(`   ${error}`);
          }
        }
        return result;
      } catch (error) {
        logger.error(`❌ ${pkg.name}: Rebuild error - ${error}`);
        return null;
      }
    });

    await Promise.all(buildPromises);
  }
}

export async function startWatchMode(
  packages: PackageInfo[],
  options: WatchOptions,
): Promise<void> {
  const watcher = new FileWatcher(packages, options);
  
  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info("\n🛑 Shutting down watch mode...");
    await watcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await watcher.start();

  // Keep the process alive
  return new Promise(() => {
    // This will keep the process running indefinitely
  });
}
