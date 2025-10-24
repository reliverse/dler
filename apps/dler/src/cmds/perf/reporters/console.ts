// apps/dler/src/cmds/perf/reporters/console.ts

import { logger } from "@reliverse/dler-logger";
import type {
  BenchmarkResult,
  BundleAnalysisResult,
  FileSystemAnalysisResult,
  MonorepoAnalysisResult,
  PerfReport,
} from "../types";
import {
  formatBottleneckType,
  formatBytes,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatRelativeChange,
  formatSeverity,
  formatTable,
  truncatePath,
} from "../utils/formatter";

export class ConsoleReporter {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  report(report: PerfReport): void {
    logger.log("━".repeat(80));
    logger.log("📊 Performance Analysis Report");
    logger.log("━".repeat(80));

    if (report.benchmark) {
      this.reportBenchmark(report.benchmark);
    }

    if (report.bundleAnalysis) {
      this.reportBundleAnalysis(report.bundleAnalysis);
    }

    if (report.fileSystemAnalysis) {
      this.reportFileSystemAnalysis(report.fileSystemAnalysis);
    }

    if (report.monorepoAnalysis) {
      this.reportMonorepoAnalysis(report.monorepoAnalysis);
    }

    if (report.baseline) {
      this.reportBaselineComparison(report.baseline);
    }

    logger.log("━".repeat(80));
  }

  private reportBenchmark(result: BenchmarkResult): void {
    logger.log("\n🚀 Command Benchmark Results");
    logger.log("─".repeat(40));

    // Summary
    logger.log(`Command: ${result.command}`);
    logger.log(`Runs: ${result.runs} (${result.warmup} warmup)`);
    logger.log(`Concurrency: ${result.concurrency}`);
    logger.log(`Success: ${result.success ? "✅" : "❌"}`);

    if (!result.success && result.error) {
      logger.error(`Error: ${result.error}`);
    }

    // Timing statistics
    logger.log("\n⏱️  Timing Statistics:");
    logger.log(`   Mean: ${formatDuration(result.statistics.mean)}`);
    logger.log(`   Median: ${formatDuration(result.statistics.median)}`);
    logger.log(`   Min: ${formatDuration(result.statistics.min)}`);
    logger.log(`   Max: ${formatDuration(result.statistics.max)}`);
    logger.log(`   P95: ${formatDuration(result.statistics.p95)}`);
    logger.log(`   P99: ${formatDuration(result.statistics.p99)}`);
    logger.log(
      `   Std Dev: ${formatDuration(result.statistics.standardDeviation)}`,
    );
    logger.log(
      `   CV: ${(result.statistics.coefficientOfVariation * 100).toFixed(2)}%`,
    );

    // Memory statistics
    logger.log("\n💾 Memory Statistics:");
    logger.log(`   Peak RSS: ${formatBytes(result.memory.peak.rss)}`);
    logger.log(`   Avg RSS: ${formatBytes(result.memory.average.rss)}`);
    logger.log(`   Peak Heap: ${formatBytes(result.memory.peak.heapUsed)}`);
    logger.log(`   Avg Heap: ${formatBytes(result.memory.average.heapUsed)}`);
    logger.log(`   Growth: ${formatBytes(result.memory.growth)}`);

    // Individual runs (if verbose)
    if (this.verbose && result.measurements.length > 0) {
      logger.log("\n📋 Individual Runs:");
      const headers = ["Run", "Duration", "RSS", "Heap", "Status"];
      const rows = result.measurements.map((m, i) => [
        (i + 1).toString(),
        formatDuration(m.duration),
        formatBytes(m.memory.rss),
        formatBytes(m.memory.heapUsed),
        m.success ? "✅" : "❌",
      ]);

      logger.log(formatTable(headers, rows));
    }
  }

  private reportBundleAnalysis(result: BundleAnalysisResult): void {
    logger.log("\n📦 Bundle Analysis Results");
    logger.log("─".repeat(40));

    // Summary
    logger.log(`Target: ${result.target}`);
    logger.log(`Total Size: ${formatBytes(result.totalSize)}`);
    logger.log(`File Count: ${formatNumber(result.fileCount)}`);
    logger.log(
      `Compression Potential: ${result.compressionPotential.toFixed(1)}%`,
    );

    // Largest files
    if (result.largestFiles.length > 0) {
      logger.log("\n📁 Largest Files:");
      const headers = ["File", "Size", "Percentage", "Type"];
      const rows = result.largestFiles.map((file) => [
        truncatePath(file.path, 50),
        formatBytes(file.size),
        formatPercentage(file.percentage, 100),
        file.type,
      ]);

      logger.log(formatTable(headers, rows));
    }

    // Modules (if available)
    if (result.modules.length > 0) {
      logger.log("\n🔗 Top Modules:");
      const headers = ["Module", "Size", "Percentage", "Type"];
      const rows = result.modules.map((module) => [
        truncatePath(module.name, 50),
        formatBytes(module.size),
        formatPercentage(module.percentage, 100),
        module.isExternal ? "External" : "Internal",
      ]);

      logger.log(formatTable(headers, rows));
    }

    // Duplicates (if available)
    if (result.duplicates.length > 0) {
      logger.log("\n🔄 Duplicate Dependencies:");
      const headers = ["Module", "Count", "Total Size", "Locations"];
      const rows = result.duplicates.map((dup) => [
        truncatePath(dup.name, 30),
        dup.count.toString(),
        formatBytes(dup.totalSize),
        dup.locations.length.toString(),
      ]);

      logger.log(formatTable(headers, rows));
    }
  }

  private reportFileSystemAnalysis(result: FileSystemAnalysisResult): void {
    logger.log("\n📁 File System Analysis Results");
    logger.log("─".repeat(40));

    // Summary
    logger.log(`Target: ${result.target}`);
    logger.log(`Total Files: ${formatNumber(result.totalFiles)}`);
    logger.log(`Total Size: ${formatBytes(result.totalSize)}`);
    logger.log(`Directories: ${formatNumber(result.directoryCount)}`);
    logger.log(`Max Depth: ${result.maxDepth}`);
    logger.log(
      `Compression Potential: ${result.compressionPotential.toFixed(1)}%`,
    );

    // Largest files
    if (result.largestFiles.length > 0) {
      logger.log("\n📄 Largest Files:");
      const headers = ["File", "Size", "Percentage", "Type"];
      const rows = result.largestFiles.map((file) => [
        truncatePath(file.path, 50),
        formatBytes(file.size),
        formatPercentage(file.percentage, 100),
        file.type,
      ]);

      logger.log(formatTable(headers, rows));
    }

    // Largest directories
    if (result.largestDirectories.length > 0) {
      logger.log("\n📂 Largest Directories:");
      const headers = ["Directory", "Size", "Files", "Depth"];
      const rows = result.largestDirectories.map((dir) => [
        truncatePath(dir.path, 50),
        formatBytes(dir.size),
        formatNumber(dir.fileCount),
        dir.depth.toString(),
      ]);

      logger.log(formatTable(headers, rows));
    }

    // File types
    if (result.fileTypes.length > 0) {
      logger.log("\n📊 File Type Distribution:");
      const headers = ["Type", "Count", "Size", "Percentage"];
      const rows = result.fileTypes.map((type) => [
        type.extension || "no-extension",
        formatNumber(type.count),
        formatBytes(type.totalSize),
        formatPercentage(type.percentage, 100),
      ]);

      logger.log(formatTable(headers, rows));
    }
  }

  private reportMonorepoAnalysis(result: MonorepoAnalysisResult): void {
    logger.log("\n🏗️  Monorepo Analysis Results");
    logger.log("─".repeat(40));

    // Summary
    logger.log(`Packages: ${formatNumber(result.packages.length)}`);
    logger.log(
      `Dependencies: ${formatNumber(result.dependencies.edges.length)}`,
    );
    logger.log(`Circular Dependencies: ${result.circularDependencies.length}`);
    logger.log(`Suggested Concurrency: ${result.suggestedConcurrency}`);

    // Build order
    if (result.buildOrder.length > 0) {
      logger.log("\n🔄 Build Order:");
      const levels = result.dependencies.levels;
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i]!;
        logger.log(`   Level ${i + 1}: ${level.join(", ")}`);
      }
    }

    // Critical path
    if (result.criticalPath.length > 0) {
      logger.log("\n🎯 Critical Path:");
      logger.log(`   ${result.criticalPath.slice(0, 10).join(" → ")}`);
      if (result.criticalPath.length > 10) {
        logger.log(`   ... and ${result.criticalPath.length - 10} more`);
      }
    }

    // Circular dependencies
    if (result.circularDependencies.length > 0) {
      logger.log("\n🔄 Circular Dependencies:");
      for (const circular of result.circularDependencies) {
        logger.log(
          `   ${formatSeverity(circular.severity)} ${circular.cycle.join(" → ")}`,
        );
      }
    }

    // Bottlenecks
    if (result.bottlenecks.length > 0) {
      logger.log("\n⚠️  Bottlenecks:");
      const headers = ["Package", "Type", "Impact", "Suggestion"];
      const rows = result.bottlenecks.map((bottleneck) => [
        bottleneck.package,
        formatBottleneckType(bottleneck.type),
        bottleneck.impact.toString(),
        bottleneck.suggestion,
      ]);

      logger.log(formatTable(headers, rows));
    }

    // Package details (if verbose)
    if (this.verbose) {
      logger.log("\n📦 Package Details:");
      const headers = ["Package", "Dependencies", "Dependents", "Type"];
      const rows = result.packages.map((pkg) => [
        pkg.name,
        pkg.dependencies.length.toString(),
        pkg.dependents.length.toString(),
        pkg.dependencies.length > 10 ? "Heavy" : "Light",
      ]);

      logger.log(formatTable(headers, rows));
    }
  }

  private reportBaselineComparison(baseline: PerfReport["baseline"]): void {
    if (!baseline?.exists) return;

    logger.log("\n📈 Baseline Comparison");
    logger.log("─".repeat(40));

    if (baseline.improvement !== undefined) {
      logger.log(
        `Performance: ${formatRelativeChange(0, baseline.improvement)}`,
      );
    }

    if (baseline.regression !== undefined) {
      logger.log(
        `Performance: ${formatRelativeChange(0, -baseline.regression)}`,
      );
    }

    if (baseline.changes) {
      const changes = baseline.changes;
      if (changes.duration !== undefined) {
        logger.log(`Duration: ${formatRelativeChange(0, changes.duration)}`);
      }
      if (changes.memory !== undefined) {
        logger.log(`Memory: ${formatRelativeChange(0, changes.memory)}`);
      }
      if (changes.size !== undefined) {
        logger.log(`Size: ${formatRelativeChange(0, changes.size)}`);
      }
      if (changes.files !== undefined) {
        logger.log(`Files: ${formatRelativeChange(0, changes.files)}`);
      }
    }
  }
}

export const createConsoleReporter = (verbose = false): ConsoleReporter => {
  return new ConsoleReporter(verbose);
};
