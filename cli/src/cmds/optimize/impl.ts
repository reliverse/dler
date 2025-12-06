// cli/src/cmds/optimize/impl.ts

import { resolve } from "node:path";
import { logger } from "@reliverse/relinka";
import { findMostRecentlyModifiedPackage } from "./finder";
import { analyzePackage, collectBaselineMetrics } from "./analyzer";
import {
  applyOptimizations,
  checkForRegressions,
} from "./optimizer";
import {
  getCurrentTimestamp,
  updateDocumentation,
} from "./documentation";
import type { OptimizeOptions, OptimizationResult } from "./types";

export interface OptimizeResult {
  success: boolean;
  package?: string;
  improvements: string[];
  regressions: string[];
  reverted: boolean;
  message: string;
}

export async function optimizePackage(
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const rootDir = options.cwd ?? process.cwd();
  const tolerance = options.tolerance ?? 0.1; // 10% tolerance

  try {
    // Step 1: Find most recently modified package
    logger.info("🔍 Finding most recently modified package...");
    const targetPackage = await findMostRecentlyModifiedPackage(rootDir);

    if (!targetPackage) {
      return {
        success: false,
        improvements: [],
        regressions: [],
        reverted: false,
        message: "No packages found to optimize",
      };
    }

    logger.info(`📦 Target package: ${targetPackage.name}`);

    // Step 2: Analyze package for optimization opportunities
    logger.info("🔬 Analyzing package for optimization opportunities...");
    const opportunities = await analyzePackage(targetPackage.path);

    if (opportunities.length === 0) {
      return {
        success: true,
        package: targetPackage.name,
        improvements: [],
        regressions: [],
        reverted: false,
        message: "No optimization opportunities found",
      };
    }

    logger.info(`✨ Found ${opportunities.length} optimization opportunities`);

    // Step 3: Collect baseline metrics
    logger.info("📊 Collecting baseline metrics...");
    const baseline = await collectBaselineMetrics(targetPackage.path);

    // Step 4: Apply optimizations
    logger.info("⚡ Applying optimizations...");
    const result = await applyOptimizations(
      targetPackage.path,
      opportunities,
      baseline,
      options,
    );

    // Step 5: Check for regressions
    if (result.after && result.baseline) {
      const hasRegression = checkForRegressions(
        result.baseline,
        result.after,
        tolerance,
      );

      if (hasRegression) {
        logger.warn("⚠️  Regression detected - reverting changes");
        result.reverted = true;
        result.success = false;
      }
    }

    // Step 6: Update documentation
    if (result.success && !result.reverted) {
      const timestamp = await getCurrentTimestamp();
      const improvementType = opportunities[0]?.type ?? "performance";
      const description = result.improvements.join("; ") || "Various optimizations";
      const outcome = result.improvements.length > 0
        ? `Applied ${result.improvements.length} optimization(s)`
        : "No changes applied";
      const regressionNotes = result.regressions.length > 0
        ? `Regressions: ${result.regressions.join(", ")}`
        : "No regression detected";

      await updateDocumentation(
        targetPackage.name,
        {
          last_updated: timestamp,
          improvement_type: improvementType,
          description,
          outcome,
          regression_notes: regressionNotes,
        },
        `${timestamp}: ${description}`,
      );

      logger.success(`✅ Optimizations applied and documented for ${targetPackage.name}`);
    }

    return {
      success: result.success && !result.reverted,
      package: targetPackage.name,
      improvements: result.improvements,
      regressions: result.regressions,
      reverted: result.reverted,
      message: result.reverted
        ? "Optimizations reverted due to regression"
        : result.success
          ? `Successfully applied ${result.improvements.length} optimization(s)`
          : "Failed to apply optimizations",
    };
  } catch (error) {
    logger.error(`Failed to optimize package: ${error}`);
    return {
      success: false,
      improvements: [],
      regressions: [],
      reverted: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

