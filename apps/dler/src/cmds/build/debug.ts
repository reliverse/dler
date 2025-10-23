// apps/dler/src/cmds/build/debug.ts

import { logger } from "@reliverse/dler-logger";
import type { BuildOptions, BuildResult, BuildSummary, PackageInfo } from "./types";

export interface DebugInfo {
  configSource: 'cli' | 'reliverse' | 'default';
  configPath?: string;
  resolvedOptions: BuildOptions;
  packageCount: number;
  entryPoints: string[];
  buildTime: number;
  bundleSize: number;
  cacheHits: number;
  errors: string[];
  warnings: string[];
}

export class DebugLogger {
  private enabled: boolean;
  private startTime: number = 0;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  start(): void {
    this.startTime = Date.now();
    if (this.enabled) {
      logger.info("🐛 Debug mode enabled");
    }
  }

  logConfigResolution(pkg: PackageInfo, configSource: string, configPath?: string): void {
    if (!this.enabled) return;

    logger.info(`📋 Config resolution for ${pkg.name}:`);
    logger.info(`   Source: ${configSource}`);
    if (configPath) {
      logger.info(`   Path: ${configPath}`);
    }
  }

  logBuildOptions(options: BuildOptions, pkg: PackageInfo): void {
    if (!this.enabled) return;

    logger.info(`⚙️  Build options for ${pkg.name}:`);
    logger.info(`   Target: ${options.target || 'bun'}`);
    logger.info(`   Format: ${options.format || 'esm'}`);
    logger.info(`   Minify: ${options.minify ? 'enabled' : 'disabled'}`);
    logger.info(`   Sourcemap: ${options.sourcemap || 'none'}`);
    logger.info(`   Splitting: ${options.splitting ? 'enabled' : 'disabled'}`);
    
    if (options.jsx) {
      logger.info(`   JSX Runtime: ${options.jsx.runtime || 'automatic'}`);
      if (options.jsx.importSource) {
        logger.info(`   JSX Import Source: ${options.jsx.importSource}`);
      }
    }

    if (options.external) {
      const externals = Array.isArray(options.external) ? options.external : [options.external];
      logger.info(`   External: ${externals.join(', ')}`);
    }

    if (options.define) {
      logger.info(`   Define: ${JSON.stringify(options.define)}`);
    }
  }

  logEntryPoints(pkg: PackageInfo): void {
    if (!this.enabled) return;

    logger.info(`📁 Entry points for ${pkg.name}:`);
    for (const entryPoint of pkg.entryPoints) {
      logger.info(`   • ${entryPoint}`);
    }
  }

  logBuildStats(summary: BuildSummary): void {
    if (!this.enabled) return;

    const totalTime = Date.now() - this.startTime;
    
    logger.info("📊 Build Statistics:");
    logger.info(`   Total packages: ${summary.totalPackages}`);
    logger.info(`   Successful: ${summary.successfulPackages}`);
    logger.info(`   Failed: ${summary.failedPackages}`);
    logger.info(`   Skipped: ${summary.skippedPackages}`);
    logger.info(`   Cache hits: ${summary.cacheHits}`);
    logger.info(`   Total build time: ${summary.totalBuildTime}ms`);
    logger.info(`   Total bundle size: ${formatBytes(summary.totalBundleSize)}`);
    logger.info(`   Process time: ${totalTime}ms`);
    logger.info(`   Average per package: ${Math.round(summary.totalBuildTime / summary.totalPackages)}ms`);
    
    if (summary.cacheHits > 0) {
      const cacheHitRate = Math.round((summary.cacheHits / summary.totalPackages) * 100);
      logger.info(`   Cache hit rate: ${cacheHitRate}%`);
    }
  }

  logPackageResult(result: BuildResult): void {
    if (!this.enabled) return;

    logger.info(`📦 Build result for ${result.package.name}:`);
    logger.info(`   Success: ${result.success ? '✅' : '❌'}`);
    logger.info(`   Skipped: ${result.skipped ? '⏭️' : '❌'}`);
    logger.info(`   Build time: ${result.buildTime}ms`);
    
    if (result.bundleSize) {
      logger.info(`   Bundle size: ${formatBytes(result.bundleSize)}`);
    }
    
    if (result.cacheHit) {
      logger.info(`   Cache hit: ⚡`);
    }

    if (result.errors.length > 0) {
      logger.info(`   Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        logger.info(`     • ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      logger.info(`   Warnings: ${result.warnings.length}`);
      for (const warning of result.warnings) {
        logger.info(`     • ${warning}`);
      }
    }
  }

  logDependencyGraph(pkg: PackageInfo, dependencies: string[]): void {
    if (!this.enabled) return;

    logger.info(`🔗 Dependencies for ${pkg.name}:`);
    for (const dep of dependencies) {
      logger.info(`   • ${dep}`);
    }
  }

  logCacheInfo(pkg: PackageInfo, cacheHit: boolean, cacheKey?: string): void {
    if (!this.enabled) return;

    if (cacheHit) {
      logger.info(`⚡ Cache hit for ${pkg.name}`);
      if (cacheKey) {
        logger.info(`   Key: ${cacheKey}`);
      }
    } else {
      logger.info(`🔄 Cache miss for ${pkg.name}`);
    }
  }

  logFileWatching(pkg: PackageInfo, watchedFiles: string[]): void {
    if (!this.enabled) return;

    logger.info(`👀 Watching files for ${pkg.name}:`);
    for (const file of watchedFiles) {
      logger.info(`   • ${file}`);
    }
  }

  logAssetProcessing(pkg: PackageInfo, assets: string[]): void {
    if (!this.enabled) return;

    logger.info(`🎨 Asset processing for ${pkg.name}:`);
    for (const asset of assets) {
      logger.info(`   • ${asset}`);
    }
  }

  logError(error: Error, context?: string): void {
    if (!this.enabled) return;

    logger.error(`🐛 Debug error${context ? ` in ${context}` : ''}:`);
    logger.error(`   Message: ${error.message}`);
    if (error.stack) {
      logger.error(`   Stack: ${error.stack}`);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function createDebugLogger(options: BuildOptions): DebugLogger {
  return new DebugLogger(options.debug || false);
}
