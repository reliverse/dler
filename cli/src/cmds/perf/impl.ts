// apps/dler/src/cmds/perf/impl.ts

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import { analyzeBundle } from "./analysis/bundle";
import { analyzeFileSystem } from "./analysis/filesystem";
import { analyzeMonorepo } from "./analysis/monorepo";
import { runBenchmark } from "./benchmarks/runner";
import type {
  BenchmarkResult,
  BundleAnalysisResult,
  FileSystemAnalysisResult,
  MonorepoAnalysisResult,
  PerfOptions,
  PerfReport,
} from "./types";
import { createPerfCache } from "./utils/cache";
import { calculateImprovement, calculateRegression } from "./utils/stats";

export interface PerfAnalysisResult {
  report: PerfReport;
  success: boolean;
  error?: string;
}

export class PerfAnalyzer {
  private options: PerfOptions;
  private cache = createPerfCache();

  constructor(options: PerfOptions) {
    this.options = options;
  }

  async analyze(): Promise<PerfAnalysisResult> {
    try {
      const startTime = Date.now();

      // Auto-detect type if not specified
      const analysisType = this.options.type ?? (await this.detectType());

      if (this.options.verbose) {
        logger.info(`🔍 Starting performance analysis (type: ${analysisType})`);
      }

      // Run analysis based on type
      let benchmark: BenchmarkResult | undefined;
      let bundleAnalysis: BundleAnalysisResult | undefined;
      let fileSystemAnalysis: FileSystemAnalysisResult | undefined;
      let monorepoAnalysis: MonorepoAnalysisResult | undefined;

      switch (analysisType) {
        case "command":
          benchmark = await this.runCommandBenchmark();
          break;
        case "bundle":
          bundleAnalysis = await this.runBundleAnalysis();
          break;
        case "file":
          fileSystemAnalysis = await this.runFileSystemAnalysis();
          break;
        case "monorepo":
          monorepoAnalysis = await this.runMonorepoAnalysis();
          break;
        case "auto":
          // Run all analyses
          if (this.options.target) {
            const targetType = await this.detectTargetType(this.options.target);
            switch (targetType) {
              case "command":
                benchmark = await this.runCommandBenchmark();
                break;
              case "bundle":
                bundleAnalysis = await this.runBundleAnalysis();
                break;
              case "file":
                fileSystemAnalysis = await this.runFileSystemAnalysis();
                break;
            }
          } else {
            monorepoAnalysis = await this.runMonorepoAnalysis();
          }
          break;
      }

      // Create report
      const report: PerfReport = {
        timestamp: Date.now(),
        options: this.options,
        benchmark,
        bundleAnalysis,
        fileSystemAnalysis,
        monorepoAnalysis,
      };

      // Compare with baseline if requested
      if (this.options.compare) {
        const baseline = await this.cache.findBaseline(
          this.options.target ?? "unknown",
          this.options.type,
        );

        if (baseline) {
          report.baseline = this.compareWithBaseline(report, baseline);
        }
      }

      // Save baseline if requested
      if (this.options.save) {
        await this.cache.save(report);
        if (this.options.verbose) {
          logger.info("💾 Baseline saved");
        }
      }

      const executionTime = Date.now() - startTime;

      if (this.options.verbose) {
        logger.info(`✅ Analysis completed in ${executionTime}ms`);
      }

      return {
        report,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (this.options.verbose) {
        logger.error(`❌ Analysis failed: ${errorMessage}`);
      }

      return {
        report: {
          timestamp: Date.now(),
          options: this.options,
        },
        success: false,
        error: errorMessage,
      };
    }
  }

  private async detectType(): Promise<PerfOptions["type"]> {
    if (this.options.target) {
      return await this.detectTargetType(this.options.target);
    }

    // Default to monorepo analysis if no target specified
    return "monorepo";
  }

  private async detectTargetType(target: string): Promise<PerfOptions["type"]> {
    // Check if it's a command
    if (this.isCommand(target)) {
      return "command";
    }

    // Check if target exists as file/directory
    const targetPath = resolve(target);
    if (!existsSync(targetPath)) {
      throw new Error(`Target not found: ${target}`);
    }

    const stat = statSync(targetPath);

    if (stat.isFile()) {
      // Check if it's a bundle file
      if (this.isBundleFile(target)) {
        return "bundle";
      }
      return "file";
    }

    if (stat.isDirectory()) {
      // Check if it contains bundle files
      if (await this.containsBundleFiles(targetPath)) {
        return "bundle";
      }
      return "file";
    }

    return "file";
  }

  private isCommand(target: string): boolean {
    // Simple heuristic: if it contains spaces or starts with common command prefixes
    return (
      target.includes(" ") ||
      target.startsWith("dler ") ||
      target.startsWith("bun ") ||
      target.startsWith("node ") ||
      target.startsWith("npm ") ||
      target.startsWith("yarn ") ||
      target.startsWith("pnpm ")
    );
  }

  private isBundleFile(target: string): boolean {
    const bundleExtensions = [".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx"];
    const ext = target.split(".").pop()?.toLowerCase();
    return ext ? bundleExtensions.includes(`.${ext}`) : false;
  }

  private async containsBundleFiles(dirPath: string): Promise<boolean> {
    try {
      const glob = new Bun.Glob("**/*.{js,mjs,cjs,ts,jsx,tsx}");
      const matches = glob.scanSync({ cwd: dirPath, onlyFiles: true });
      // Check if there's at least one match
      for (const _ of matches) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async runCommandBenchmark(): Promise<BenchmarkResult> {
    if (!this.options.target) {
      throw new Error("Target is required for command benchmarking");
    }

    const {
      target,
      runs = 10,
      warmup = 2,
      concurrency = 1,
      cwd,
      verbose,
    } = this.options;

    if (verbose) {
      logger.info(`🚀 Benchmarking command: ${target}`);
    }

    return runBenchmark({
      command: target,
      runs,
      warmup,
      concurrency,
      cwd,
      verbose,
    });
  }

  private async runBundleAnalysis(): Promise<BundleAnalysisResult> {
    if (!this.options.target) {
      throw new Error("Target is required for bundle analysis");
    }

    const { target, verbose } = this.options;

    if (verbose) {
      logger.info(`📦 Analyzing bundle: ${target}`);
    }

    return analyzeBundle({
      target,
      verbose,
      includeSourceMaps: true,
      analyzeDependencies: true,
    });
  }

  private async runFileSystemAnalysis(): Promise<FileSystemAnalysisResult> {
    if (!this.options.target) {
      throw new Error("Target is required for file system analysis");
    }

    const { target, verbose } = this.options;

    if (verbose) {
      logger.info(`📁 Analyzing file system: ${target}`);
    }

    return analyzeFileSystem({
      target,
      verbose,
      maxDepth: 10,
      includeHidden: false,
      excludePatterns: [
        "node_modules",
        ".git",
        ".next",
        "dist",
        "build",
      ],
    });
  }

  private async runMonorepoAnalysis(): Promise<MonorepoAnalysisResult> {
    const { cwd, ignore, verbose } = this.options;

    if (verbose) {
      logger.info("🏗️ Analyzing monorepo structure");
    }

    return analyzeMonorepo({
      cwd,
      ignore,
      verbose,
      includeDevDependencies: true,
      analyzeBuildOrder: true,
    });
  }

  private compareWithBaseline(
    current: PerfReport,
    baseline: PerfReport,
  ): PerfReport["baseline"] {
    const changes: NonNullable<PerfReport["baseline"]>["changes"] = {};

    // Compare benchmark results
    if (current.benchmark && baseline.benchmark) {
      const currentDuration = current.benchmark.statistics.mean;
      const baselineDuration = baseline.benchmark.statistics.mean;

      if (currentDuration < baselineDuration) {
        changes.duration = calculateImprovement(
          baselineDuration,
          currentDuration,
        );
      } else {
        changes.duration = calculateRegression(
          baselineDuration,
          currentDuration,
        );
      }

      const currentMemory = current.benchmark.memory.average.rss;
      const baselineMemory = baseline.benchmark.memory.average.rss;

      if (currentMemory < baselineMemory) {
        changes.memory = calculateImprovement(baselineMemory, currentMemory);
      } else {
        changes.memory = calculateRegression(baselineMemory, currentMemory);
      }
    }

    // Compare bundle analysis
    if (current.bundleAnalysis && baseline.bundleAnalysis) {
      const currentSize = current.bundleAnalysis.totalSize;
      const baselineSize = baseline.bundleAnalysis.totalSize;

      if (currentSize < baselineSize) {
        changes.size = calculateImprovement(baselineSize, currentSize);
      } else {
        changes.size = calculateRegression(baselineSize, currentSize);
      }

      const currentFiles = current.bundleAnalysis.fileCount;
      const baselineFiles = baseline.bundleAnalysis.fileCount;

      if (currentFiles !== baselineFiles) {
        changes.files = calculateRegression(baselineFiles, currentFiles);
      }
    }

    // Compare file system analysis
    if (current.fileSystemAnalysis && baseline.fileSystemAnalysis) {
      const currentSize = current.fileSystemAnalysis.totalSize;
      const baselineSize = baseline.fileSystemAnalysis.totalSize;

      if (currentSize < baselineSize) {
        changes.size = calculateImprovement(baselineSize, currentSize);
      } else {
        changes.size = calculateRegression(baselineSize, currentSize);
      }

      const currentFiles = current.fileSystemAnalysis.totalFiles;
      const baselineFiles = baseline.fileSystemAnalysis.totalFiles;

      if (currentFiles !== baselineFiles) {
        changes.files = calculateRegression(baselineFiles, currentFiles);
      }
    }

    // Calculate overall improvement/regression
    let improvement: number | undefined;
    let regression: number | undefined;

    if (changes.duration !== undefined) {
      if (changes.duration > 0) {
        improvement = changes.duration;
      } else {
        regression = Math.abs(changes.duration);
      }
    }

    return {
      exists: true,
      improvement,
      regression,
      changes,
    };
  }
}

export const runPerfAnalysis = async (
  options: PerfOptions,
): Promise<PerfAnalysisResult> => {
  const analyzer = new PerfAnalyzer(options);
  return analyzer.analyze();
};

export const createPerfAnalyzer = (options: PerfOptions): PerfAnalyzer => {
  return new PerfAnalyzer(options);
};
