// Performance benchmarks for @reliverse/datetime

import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { benchmarkDuration } from "./impl/duration";
import { benchmarkFormatting } from "./impl/formatting";
import { benchmarkParsing } from "./impl/parsing";
import { benchmarkRelativeTime } from "./impl/relative-time";
import { benchmarkTimezone } from "./impl/timezone";

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
  iterCount = ITERATIONS,
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
  const maxTime = sorted[sorted.length - 1] ?? 0;
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
  // Note: Bun.write() calls may still output, but process.stdout/stderr are suppressed
  process.stdout.write = () => true;
  process.stderr.write = () => true;
}

function restoreOutput(): void {
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

const defaultOutputPath = fileURLToPath(
  new URL("../baseline.txt", import.meta.url),
);

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

const buildSectionLines = (
  title: string,
  results: BenchmarkResult[],
): string[] => {
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
async function runBenchmarks(
  outputPath: string = defaultOutputPath,
): Promise<void> {
  const allResults: BenchmarkResult[] = [];
  const sections: Array<{ title: string; results: BenchmarkResult[] }> = [];
  let pendingError: unknown;

  try {
    suppressOutput();

    const formattingResults = await benchmarkFormatting(benchmark);
    sections.push({
      title: "Formatting Performance",
      results: formattingResults,
    });
    allResults.push(...formattingResults);

    const parsingResults = await benchmarkParsing(benchmark);
    sections.push({
      title: "Parsing Performance",
      results: parsingResults,
    });
    allResults.push(...parsingResults);

    const timezoneResults = await benchmarkTimezone(benchmark);
    sections.push({
      title: "Timezone Conversion Performance",
      results: timezoneResults,
    });
    allResults.push(...timezoneResults);

    const durationResults = await benchmarkDuration(benchmark);
    sections.push({
      title: "Duration Calculation Performance",
      results: durationResults,
    });
    allResults.push(...durationResults);

    const relativeTimeResults = await benchmarkRelativeTime(benchmark);
    sections.push({
      title: "Relative Time Performance",
      results: relativeTimeResults,
    });
    allResults.push(...relativeTimeResults);
  } catch (error) {
    pendingError = error;
  } finally {
    restoreOutput();
  }

  if (typeof pendingError !== "undefined") {
    // Use process.stderr.write directly to ensure error is shown
    process.stderr.write(`Benchmark failed: ${String(pendingError)}\n`);
    if (pendingError instanceof Error && pendingError.stack) {
      process.stderr.write(`${pendingError.stack}\n`);
    }
    throw pendingError;
  }

  const lines: string[] = [];
  for (const section of sections) {
    lines.push(...buildSectionLines(section.title, section.results));
  }

  if (allResults.length > 0) {
    const totalOps = allResults.reduce(
      (sum, result) => sum + result.opsPerSec,
      0,
    );
    const averageOps = Math.round(totalOps / allResults.length);
    const totalIterations = allResults.reduce(
      (sum, result) => sum + result.iterations,
      0,
    );
    lines.push("Summary:");
    lines.push(`Total benchmarks: ${allResults.length}`);
    lines.push(`Average ops/s: ${averageOps.toLocaleString()}`);
    lines.push(`Total operations: ${totalIterations.toLocaleString()}`);
  }

  const report = `${lines.join("\n")}\n`;

  // Write to file first
  await writeFile(outputPath, report, "utf8");

  // Output to terminal after file is written (restoreOutput already called in finally block)
  // Use the original stdout.write that was restored
  originalStdoutWrite("\n");
  originalStdoutWrite(report);
  originalStdoutWrite(`\nBenchmark results also written to ${outputPath}\n`);
}

// Run if executed directly
// Note: import.meta.main may not work correctly in all Bun versions
// So we also check if this is the main module by checking if it's being run directly
const isMainModule =
  import.meta.main ||
  process.argv[1]?.endsWith("perf.ts") ||
  process.argv[1]?.includes("bench/perf.ts");

if (isMainModule) {
  try {
    await runBenchmarks();
  } catch (error) {
    // Ensure error output is visible
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    originalStderrWrite(`Fatal benchmark error: ${errorMsg}\n`);
    if (errorStack) {
      originalStderrWrite(`${errorStack}\n`);
    }
    process.exit(1);
  }
}

export { benchmark, type BenchmarkResult, runBenchmarks };
