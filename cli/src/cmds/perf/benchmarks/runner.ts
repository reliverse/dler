// apps/dler/src/cmds/perf/benchmarks/runner.ts

import { logger } from "@reliverse/dler-logger";
import pMap from "@reliverse/dler-mapper";
import type { BenchmarkResult, Measurement, MemoryStats } from "../types";
import { formatProgress } from "../utils/formatter";

import {
  calculateMemoryAverage,
  calculateStatistics,
  findPeakMemory,
} from "../utils/stats";
import { executeCommandWithMemoryTracking } from "./command";

export interface BenchmarkRunnerOptions {
  command: string;
  runs: number;
  warmup: number;
  concurrency: number;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  verbose?: boolean;
}

export class BenchmarkRunner {
  private options: BenchmarkRunnerOptions;

  constructor(options: BenchmarkRunnerOptions) {
    this.options = options;
  }

  async run(): Promise<BenchmarkResult> {
    const { command, runs, warmup, concurrency, verbose } = this.options;
    const startTime = Date.now();

    if (verbose) {
      logger.info(`🚀 Starting benchmark for: ${command}`);
      logger.info(
        `   Runs: ${runs}, Warmup: ${warmup}, Concurrency: ${concurrency}`,
      );
    }

    // Run warmup iterations
    if (warmup > 0) {
      if (verbose) {
        logger.info(`🔥 Running ${warmup} warmup iterations...`);
      }

      await this.runWarmup();
    }

    // Run actual benchmark iterations
    if (verbose) {
      logger.info(`📊 Running ${runs} benchmark iterations...`);
    }

    const measurements = await this.runBenchmark();
    const statistics = this.calculateStatistics(measurements);
    const memory = this.calculateMemoryStats(measurements);
    const executionTime = Date.now() - startTime;

    // Check for failures
    const failures = measurements.filter((m) => !m.success);
    const success = failures.length === 0;

    if (verbose && failures.length > 0) {
      logger.warn(`⚠️  ${failures.length} out of ${runs} runs failed`);
    }

    return {
      command,
      runs,
      warmup,
      concurrency,
      measurements,
      statistics,
      memory,
      executionTime,
      success,
      error: failures.length > 0 ? `${failures.length} runs failed` : undefined,
    };
  }

  private async runWarmup(): Promise<void> {
    const { command, warmup, cwd, timeout, env } = this.options;

    // Run warmup iterations sequentially to avoid interference
    for (let i = 0; i < warmup; i++) {
      try {
        await executeCommandWithMemoryTracking(command, {
          cwd,
          timeout,
          env,
        });
      } catch {
        // Ignore warmup failures
      }
    }
  }

  private async runBenchmark(): Promise<Measurement[]> {
    const { command, runs, concurrency, cwd, timeout, env, verbose } =
      this.options;

    const runIndices = Array.from({ length: runs }, (_, i) => i);

    const measurements = await pMap(
      runIndices,
      async (runIndex) => {
        if (verbose) {
          logger.info(formatProgress(runIndex + 1, runs));
        }

        const measurement = await executeCommandWithMemoryTracking(command, {
          cwd,
          timeout,
          env,
        });

        measurement.run = runIndex + 1;
        return measurement;
      },
      {
        concurrency,
        stopOnError: false,
      },
    );

    return measurements;
  }

  private calculateStatistics(
    measurements: Measurement[],
  ): ReturnType<typeof calculateStatistics> {
    const durations = measurements
      .filter((m) => m.success)
      .map((m) => m.duration);

    if (durations.length === 0) {
      return calculateStatistics([]);
    }

    return calculateStatistics(durations);
  }

  private calculateMemoryStats(measurements: Measurement[]): MemoryStats {
    const successfulMeasurements = measurements.filter((m) => m.success);

    if (successfulMeasurements.length === 0) {
      return {
        peak: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0,
        },
        average: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0,
        },
        growth: 0,
      };
    }

    const rssValues = successfulMeasurements.map((m) => m.memory.rss);
    const heapTotalValues = successfulMeasurements.map(
      (m) => m.memory.heapTotal,
    );
    const heapUsedValues = successfulMeasurements.map((m) => m.memory.heapUsed);
    const externalValues = successfulMeasurements.map((m) => m.memory.external);
    const arrayBuffersValues = successfulMeasurements.map(
      (m) => m.memory.arrayBuffers,
    );

    const peak: MemoryStats["peak"] = {
      rss: findPeakMemory(rssValues),
      heapTotal: findPeakMemory(heapTotalValues),
      heapUsed: findPeakMemory(heapUsedValues),
      external: findPeakMemory(externalValues),
      arrayBuffers: findPeakMemory(arrayBuffersValues),
    };

    const average: MemoryStats["average"] = {
      rss: calculateMemoryAverage(rssValues),
      heapTotal: calculateMemoryAverage(heapTotalValues),
      heapUsed: calculateMemoryAverage(heapUsedValues),
      external: calculateMemoryAverage(externalValues),
      arrayBuffers: calculateMemoryAverage(arrayBuffersValues),
    };

    const growth =
      rssValues.length > 1
        ? rssValues[rssValues.length - 1]! - rssValues[0]!
        : 0;

    return {
      peak,
      average,
      growth,
    };
  }
}

export const runBenchmark = async (
  options: BenchmarkRunnerOptions,
): Promise<BenchmarkResult> => {
  const runner = new BenchmarkRunner(options);
  return runner.run();
};

export const createBenchmarkRunner = (
  options: BenchmarkRunnerOptions,
): BenchmarkRunner => {
  return new BenchmarkRunner(options);
};
