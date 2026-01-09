// Performance benchmarks for @reliverse/relinka

import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { benchmarkAsyncLogger } from "./impl/async-logger";
import { benchmarkBoxFormatting } from "./impl/box-formatting";
import { benchmarkConcurrentLogging } from "./impl/concurrent-logging";
import { benchmarkMessageFormatting } from "./impl/message-formatting";
import { benchmarkSyncLogger } from "./impl/sync-logger";

// Constants
const WARMUP_RUNS = 5;
const ITERATIONS = 1000;

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  opsPerSec: number;
}

const formatTime = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms * 1000).toFixed(2)}us`;
};

const calculatePercentile = (sorted: number[], percentile: number): number => {
  const index = Math.ceil((sorted.length * percentile) / 100) - 1;
  return sorted[Math.max(0, index)] ?? 0;
};

// Benchmark helper with detailed statistics
async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterCount = ITERATIONS
): Promise<BenchmarkResult> {
  // Warmup runs
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await fn();
  }

  // Collect individual timings for statistical analysis
  const timings: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterCount; i++) {
    const iterStart = performance.now();
    await fn();
    const iterEnd = performance.now();
    timings.push(iterEnd - iterStart);
  }

  const end = performance.now();
  const totalTime = end - start;

  // Calculate statistics
  const sorted = [...timings].sort((a, b) => a - b);
  const avgTime = totalTime / iterCount;
  const minTime = sorted[0] ?? 0;
  const maxTime = sorted.at(-1) ?? 0;
  const medianTime = calculatePercentile(sorted, 50);
  const p95Time = calculatePercentile(sorted, 95);
  const p99Time = calculatePercentile(sorted, 99);
  const opsPerSec = Math.round((iterCount * 1000) / totalTime);

  return {
    name,
    iterations: iterCount,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    medianTime,
    p95Time,
    p99Time,
    opsPerSec,
  };
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

function suppressOutput(): void {
  // Override stdout/stderr write methods to discard output (no-op)
  // This is more efficient than writing to a null device and avoids
  // creating a "NUL" file on Windows
  process.stdout.write = () => true;
  process.stderr.write = () => true;
}

function restoreOutput(): void {
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

const defaultOutputPath = fileURLToPath(new URL("../baseline.txt", import.meta.url));

const formatBenchmarkResultLine = (result: BenchmarkResult): string => {
  const stats = [
    `avg=${formatTime(result.avgTime)}`,
    `min=${formatTime(result.minTime)}`,
    `max=${formatTime(result.maxTime)}`,
    `p95=${formatTime(result.p95Time)}`,
    `p99=${formatTime(result.p99Time)}`,
    `ops/s=${result.opsPerSec.toLocaleString()}`,
  ];
  return `${result.name} | ${stats.join(" | ")}`;
};

const buildSectionLines = (title: string, results: BenchmarkResult[]): string[] => {
  if (results.length === 0) {
    return [];
  }

  const lines = [title];
  for (const result of results) {
    lines.push(formatBenchmarkResultLine(result));
  }
  lines.push("");
  return lines;
};

// Main benchmark runner
async function runBenchmarks(outputPath: string = defaultOutputPath): Promise<void> {
  const allResults: BenchmarkResult[] = [];
  const sections: Array<{ title: string; results: BenchmarkResult[] }> = [];
  let pendingError: unknown;

  try {
    suppressOutput();

    const syncResults = await benchmarkSyncLogger(benchmark);
    sections.push({
      title: "Sync Logger Performance",
      results: syncResults,
    });
    allResults.push(...syncResults);

    const asyncResults = await benchmarkAsyncLogger(benchmark);
    sections.push({
      title: "Async Logger Performance",
      results: asyncResults,
    });
    allResults.push(...asyncResults);

    const boxResults = await benchmarkBoxFormatting(benchmark);
    sections.push({
      title: "Box Formatting Performance",
      results: boxResults,
    });
    allResults.push(...boxResults);

    const concurrentResults = await benchmarkConcurrentLogging(benchmark);
    sections.push({
      title: "Concurrent Logging Performance",
      results: concurrentResults,
    });
    allResults.push(...concurrentResults);

    const formattingResults = await benchmarkMessageFormatting(benchmark);
    sections.push({
      title: "Message Formatting Performance",
      results: formattingResults,
    });
    allResults.push(...formattingResults);
  } catch (error) {
    pendingError = error;
  } finally {
    restoreOutput();
  }

  if (typeof pendingError !== "undefined") {
    console.error("Benchmark failed:", pendingError);
    throw pendingError;
  }

  const lines: string[] = [];
  for (const section of sections) {
    lines.push(...buildSectionLines(section.title, section.results));
  }

  if (allResults.length > 0) {
    const totalOps = allResults.reduce((sum, result) => sum + result.opsPerSec, 0);
    const averageOps = Math.round(totalOps / allResults.length);
    const totalIterations = allResults.reduce((sum, result) => sum + result.iterations, 0);
    lines.push("Summary:");
    lines.push(`Total benchmarks: ${allResults.length}`);
    lines.push(`Average ops/s: ${averageOps.toLocaleString()}`);
    lines.push(`Total operations: ${totalIterations.toLocaleString()}`);
  }

  const report = `${lines.join("\n")}\n`;
  await writeFile(outputPath, report, "utf8");
  console.log(`Benchmark results written to ${outputPath}`);
}

// Run if executed directly
if (import.meta.main) {
  await runBenchmarks();
}

export { benchmark, type BenchmarkResult };
