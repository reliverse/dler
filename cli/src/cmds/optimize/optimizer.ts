// cli/src/cmds/optimize/optimizer.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "@reliverse/relinka";
import type { OptimizationOpportunity } from "./analyzer";
import type {
  BaselineMetrics,
  OptimizationResult,
  OptimizeOptions,
} from "./types";

export async function applyOptimizations(
  packagePath: string,
  opportunities: OptimizationOpportunity[],
  baseline: BaselineMetrics,
  options: OptimizeOptions,
): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    success: false,
    package: packagePath,
    improvements: [],
    regressions: [],
    baseline,
    reverted: false,
  };

  if (options.dryRun) {
    logger.info("Dry run mode - no changes will be applied");
    return result;
  }

  const appliedChanges: Array<{
    file: string;
    change: string;
    revert: () => void;
  }> = [];

  try {
    // Apply high-priority optimizations first
    const highPriority = opportunities.filter((o) => o.priority === "high");
    const mediumPriority = opportunities.filter((o) => o.priority === "medium");
    const lowPriority = opportunities.filter((o) => o.priority === "low");

    const sortedOpportunities = [
      ...highPriority,
      ...mediumPriority,
      ...lowPriority,
    ];

    for (const opportunity of sortedOpportunities.slice(0, 3)) {
      // Limit to 3 optimizations per run
      try {
        const change = await applyOptimization(packagePath, opportunity);
        if (change) {
          appliedChanges.push(change);
          result.improvements.push(opportunity.description);
        }
      } catch {
        logger.warn(`Failed to apply optimization: ${opportunity.description}`);
      }
    }

    // Collect metrics after changes
    if (appliedChanges.length > 0) {
      result.after = await collectMetricsAfter();
      result.success = true;
    }
  } catch (error) {
    logger.error(`Failed to apply optimizations: ${error}`);

    // Revert all changes on error
    for (const change of appliedChanges.reverse()) {
      try {
        change.revert();
      } catch (revertError) {
        logger.error(`Failed to revert change: ${revertError}`);
      }
    }

    result.reverted = true;
  }

  return result;
}

async function applyOptimization(
  packagePath: string,
  opportunity: OptimizationOpportunity,
): Promise<{ file: string; change: string; revert: () => void } | null> {
  if (!opportunity.file) {
    // Handle non-file-specific optimizations
    if (
      opportunity.type === "build" &&
      opportunity.description.includes("incremental")
    ) {
      return await enableIncrementalCompilation(packagePath);
    }
    return null;
  }

  const filePath = resolve(packagePath, "src", opportunity.file);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, "utf-8");
  const originalContent = content;
  let modifiedContent = content;

  // Apply specific optimizations
  if (opportunity.description.includes("forEach")) {
    // This is a placeholder - actual implementation would need AST parsing
    // For now, we'll skip complex transformations
    return null;
  }

  if (opportunity.description.includes("console")) {
    // Replace console with logger
    modifiedContent = modifiedContent.replace(
      /console\.(log|info|warn|error|debug)/g,
      (_match, method) => {
        const loggerMethod = method === "log" ? "info" : method;
        return `logger.${loggerMethod}`;
      },
    );

    // Add import if not present
    if (!modifiedContent.includes('from "@reliverse/relinka"')) {
      const importLine = 'import { logger } from "@reliverse/relinka";\n';
      modifiedContent = importLine + modifiedContent;
    }
  }

  if (modifiedContent !== originalContent) {
    writeFileSync(filePath, modifiedContent, "utf-8");
    return {
      file: filePath,
      change: opportunity.description,
      revert: () => {
        writeFileSync(filePath, originalContent, "utf-8");
      },
    };
  }

  return null;
}

async function enableIncrementalCompilation(
  packagePath: string,
): Promise<{ file: string; change: string; revert: () => void } | null> {
  const tsconfigPath = resolve(packagePath, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    return null;
  }

  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8")) as {
    compilerOptions?: Record<string, unknown>;
  };

  if (tsconfig.compilerOptions?.incremental === true) {
    return null; // Already enabled
  }

  const originalContent = readFileSync(tsconfigPath, "utf-8");

  if (!tsconfig.compilerOptions) {
    tsconfig.compilerOptions = {};
  }

  tsconfig.compilerOptions.incremental = true;

  const modifiedContent = JSON.stringify(tsconfig, null, 2);
  writeFileSync(tsconfigPath, modifiedContent, "utf-8");

  return {
    file: tsconfigPath,
    change: "Enabled incremental compilation",
    revert: () => {
      writeFileSync(tsconfigPath, originalContent, "utf-8");
    },
  };
}

async function collectMetricsAfter(): Promise<BaselineMetrics> {
  // Placeholder - actual implementation would run benchmarks
  return {};
}

export function checkForRegressions(
  baseline: BaselineMetrics,
  after: BaselineMetrics,
  tolerance: number = 0.1,
): boolean {
  for (const [key, baselineValue] of Object.entries(baseline)) {
    if (baselineValue === undefined) {
      continue;
    }

    const afterValue = after[key];
    if (afterValue === undefined) {
      continue;
    }

    // Check for regression (increase in time/size is bad)
    if (key.includes("Time") || key.includes("Size")) {
      const regression = (afterValue - baselineValue) / baselineValue;
      if (regression > tolerance) {
        return true;
      }
    }

    // Check for regression (decrease in coverage is bad)
    if (key.includes("Coverage")) {
      const regression = (baselineValue - afterValue) / baselineValue;
      if (regression > tolerance) {
        return true;
      }
    }
  }

  return false;
}
