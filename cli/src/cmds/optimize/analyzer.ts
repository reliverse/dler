// cli/src/cmds/optimize/analyzer.ts

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdirRecursive } from "@reliverse/relifso";
import { logger } from "@reliverse/relinka";
import type { BaselineMetrics } from "./types";

export interface OptimizationOpportunity {
  type: "build" | "performance" | "DX" | "type-safety" | "bundle-size";
  description: string;
  file?: string;
  line?: number;
  priority: "high" | "medium" | "low";
}

export async function analyzePackage(
  packagePath: string,
): Promise<OptimizationOpportunity[]> {
  const opportunities: OptimizationOpportunity[] = [];

  try {
    // Analyze source files
    const srcPath = resolve(packagePath, "src");
    if (existsSync(srcPath)) {
      const srcOpportunities = await analyzeSourceFiles(srcPath);
      opportunities.push(...srcOpportunities);
    }

    // Check for benchmark setup
    const benchPath = resolve(packagePath, "bench");
    if (!existsSync(benchPath)) {
      opportunities.push({
        type: "performance",
        description: "Missing benchmark setup - consider adding bench/ directory",
        priority: "medium",
      });
    }

    // Check package.json for optimization opportunities
    const packageJsonPath = resolve(packagePath, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf-8"),
      ) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      if (!packageJson.scripts?.perf) {
        opportunities.push({
          type: "performance",
          description: "Missing perf script in package.json",
          priority: "low",
        });
      }
    }

    // Check for TypeScript config optimizations
    const tsconfigPath = resolve(packagePath, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(
        readFileSync(tsconfigPath, "utf-8"),
      ) as {
        compilerOptions?: {
          incremental?: boolean;
          skipLibCheck?: boolean;
        };
      };

      if (tsconfig.compilerOptions?.incremental !== true) {
        opportunities.push({
          type: "build",
          description: "Consider enabling incremental compilation in tsconfig.json",
          priority: "medium",
        });
      }
    }
  } catch (error) {
    logger.warn(`Failed to analyze package ${packagePath}: ${error}`);
  }

  return opportunities;
}

async function analyzeSourceFiles(
  srcPath: string,
): Promise<OptimizationOpportunity[]> {
  const opportunities: OptimizationOpportunity[] = [];

  try {
    const files = await readdirRecursive(srcPath);
    const tsFiles = files.filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"),
    );

    for (const file of tsFiles) {
      const fullPath = resolve(srcPath, file);
      if (!existsSync(fullPath)) {
        continue;
      }

      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      // Check for common optimization opportunities
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for Array.forEach (should use for...of)
        if (line.includes(".forEach(") && !line.includes("//")) {
          opportunities.push({
            type: "performance",
            description: "Consider using for...of instead of Array.forEach",
            file,
            line: i + 1,
            priority: "low",
          });
        }

        // Check for unnecessary async/await
        if (
          line.includes("async") &&
          !content.includes("await") &&
          !content.includes("Promise")
        ) {
          opportunities.push({
            type: "performance",
            description: "Unnecessary async function - consider removing async",
            file,
            line: i + 1,
            priority: "low",
          });
        }

        // Check for console usage
        if (line.includes("console.") && !line.includes("//")) {
          opportunities.push({
            type: "DX",
            description: "Consider using @reliverse/relinka logger instead of console",
            file,
            line: i + 1,
            priority: "medium",
          });
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to analyze source files: ${error}`);
  }

  return opportunities;
}

export async function collectBaselineMetrics(
  packagePath: string,
): Promise<BaselineMetrics> {
  const metrics: BaselineMetrics = {};

  try {
    // Try to run benchmarks if available
    const packageJsonPath = resolve(packagePath, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf-8"),
      ) as { scripts?: Record<string, string> };

      if (packageJson.scripts?.perf) {
        // Baseline will be collected by running benchmarks
        // This is a placeholder - actual implementation would run the perf script
      }
    }
  } catch (error) {
    logger.warn(`Failed to collect baseline metrics: ${error}`);
  }

  return metrics;
}

