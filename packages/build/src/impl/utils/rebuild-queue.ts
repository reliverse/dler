// packages/build/src/impl/utils/rebuild-queue.ts

import { relinka } from "@reliverse/relinka";
import { DEFAULT_DEBOUNCE_MS } from "../constants";
import type { BuildOptions, BuildResult, PackageInfo } from "../types";

interface RebuildQueueOptions {
  debounceMs?: number;
  incremental?: boolean;
  buildOptions?: BuildOptions;
  onRebuildComplete?: (result: BuildResult) => void | Promise<void>;
}

/**
 * Shared rebuild queue processor for watch mode and dev server
 */
export class RebuildQueueProcessor {
  private rebuildQueue: Set<string> = new Set();
  private rebuildTimeout: NodeJS.Timeout | null = null;
  private readonly options: RebuildQueueOptions;
  private readonly packages: PackageInfo[];

  constructor(packages: PackageInfo[], options: RebuildQueueOptions = {}) {
    this.packages = packages;
    this.options = {
      debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      incremental: options.incremental ?? false,
      buildOptions: options.buildOptions,
      onRebuildComplete: options.onRebuildComplete,
    };
  }

  /**
   * Add a package to the rebuild queue
   */
  add(packageName: string): void {
    this.rebuildQueue.add(packageName);
    this.scheduleRebuild();
  }

  /**
   * Clear the rebuild queue
   */
  clear(): void {
    this.rebuildQueue.clear();
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
      this.rebuildTimeout = null;
    }
  }

  /**
   * Schedule a rebuild with debouncing
   */
  private scheduleRebuild(): void {
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
    }

    this.rebuildTimeout = setTimeout(() => {
      void this.processQueue();
    }, this.options.debounceMs);
  }

  /**
   * Process the rebuild queue
   */
  private async processQueue(): Promise<void> {
    if (this.rebuildQueue.size === 0) return;

    const packagesToRebuild = Array.from(this.rebuildQueue)
      .map((name) => this.packages.find((pkg) => pkg.name === name))
      .filter((pkg): pkg is PackageInfo => pkg !== undefined);

    this.rebuildQueue.clear();

    const rebuildMessage = this.options.incremental
      ? `🔄 Incrementally rebuilding ${packagesToRebuild.length} packages...`
      : `🔄 Rebuilding ${packagesToRebuild.length} packages...`;

    await relinka.info(rebuildMessage);

    // Import buildPackage dynamically to avoid circular dependency
    const { buildPackage } = await import("../../mod");

    // Build packages in parallel for better performance
    const buildOptions = this.options.buildOptions ?? {};
    const buildPromises = packagesToRebuild.map(async (pkg) => {
      try {
        const result = await buildPackage(pkg, buildOptions);

        if (result.success) {
          await relinka.success(`✅ ${pkg.name}: Rebuilt successfully`);
        } else {
          await relinka.error(`❌ ${pkg.name}: Rebuild failed`);
          for (const error of result.errors) {
            await relinka.error(`   ${error}`);
          }
        }

        if (this.options.onRebuildComplete) {
          await this.options.onRebuildComplete(result);
        }

        return result;
      } catch (error) {
        await relinka.error(
          `❌ ${pkg.name}: Rebuild error - ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    });

    await Promise.all(buildPromises);
  }

  /**
   * Process rebuild queue with custom build options
   */
  async processWithOptions(options: BuildOptions): Promise<void> {
    if (this.rebuildQueue.size === 0) return;

    const packagesToRebuild = Array.from(this.rebuildQueue)
      .map((name) => this.packages.find((pkg) => pkg.name === name))
      .filter((pkg): pkg is PackageInfo => pkg !== undefined);

    this.rebuildQueue.clear();

    await relinka.info(`🔄 Rebuilding ${packagesToRebuild.length} packages...`);

    // Import buildPackage dynamically to avoid circular dependency
    const { buildPackage } = await import("../../mod");

    for (const pkg of packagesToRebuild) {
      try {
        const result = await buildPackage(pkg, options);

        if (result.success) {
          await relinka.success(`✅ ${pkg.name}: Rebuilt successfully`);
        } else {
          await relinka.error(`❌ ${pkg.name}: Rebuild failed`);
          for (const error of result.errors) {
            await relinka.error(`   ${error}`);
          }
        }

        if (this.options.onRebuildComplete) {
          await this.options.onRebuildComplete(result);
        }
      } catch (error) {
        await relinka.error(
          `❌ ${pkg.name}: Rebuild error - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
