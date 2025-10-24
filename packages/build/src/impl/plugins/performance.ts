// packages/build/src/impl/plugins/performance.ts

import { logger } from "@reliverse/dler-logger";
import type { BuildResult, DlerPlugin } from "../types";

export const PerformancePlugin: DlerPlugin = {
  name: "performance",
  setup: () => {
    logger.debug("Performance monitoring plugin registered");
  },
  onBuildEnd: async (result: BuildResult) => {
    if (!result.success || result.skipped) {
      return;
    }

    try {
      await checkPerformanceBudgets(result);
    } catch (error) {
      logger.warn(`Failed to check performance budgets for ${result.package.name}: ${error}`);
    }
  },
};

async function checkPerformanceBudgets(result: BuildResult): Promise<void> {
  const pkg = result.package;
  const budget = pkg.buildConfig?.performanceBudget;
  
  if (!budget) {
    return;
  }

  const bundleSize = result.bundleSize || 0;
  const warnings: string[] = [];

  // Check bundle size limits
  if (budget.maxBundleSize && bundleSize > budget.maxBundleSize) {
    warnings.push(`Bundle size ${formatBytes(bundleSize)} exceeds limit of ${formatBytes(budget.maxBundleSize)}`);
  }

  if (budget.maxChunkSize && bundleSize > budget.maxChunkSize) {
    warnings.push(`Chunk size ${formatBytes(bundleSize)} exceeds limit of ${formatBytes(budget.maxChunkSize)}`);
  }

  if (budget.maxAssetSize && bundleSize > budget.maxAssetSize) {
    warnings.push(`Asset size ${formatBytes(bundleSize)} exceeds limit of ${formatBytes(budget.maxAssetSize)}`);
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn(`⚠️  Performance budget exceeded for ${pkg.name}:`);
    for (const warning of warnings) {
      logger.warn(`   ${warning}`);
    }
  } else {
    logger.info(`✅ Performance budget met for ${pkg.name} (${formatBytes(bundleSize)})`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
