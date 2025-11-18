// Performance benchmarks for @reliverse/dler-fs-utils

import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import fs from "./src/mod";

// Constants
const WARMUP_RUNS = 5;
const ITERATIONS = 100;
const LARGE_FILE_SIZE = 1024 * 1024; // 1MB
const VERY_LARGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MEDIUM_FILE_SIZE = 1024 * 10; // 10KB
const SMALL_FILE_SIZE = 1024; // 1KB

// Test directory
const testDir = join(tmpdir(), `dler-fs-utils-perf-${Date.now()}`);
const testFile = join(testDir, "test.txt");
const testJsonFile = join(testDir, "test.json");
const copySource = join(testDir, "source");
const copyDest = join(testDir, "dest");

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
  throughput?: string;
}

// Helper to create test data
const createTestData = (size: number): string => {
  return "x".repeat(size);
};

const createBinaryData = (size: number): Uint8Array => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
};

const createTestJson = (): Record<string, unknown> => {
  return {
    name: "test",
    version: "1.0.0",
    data: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: `item-${i}`,
      nested: { prop: `value-${i}` },
    })),
  };
};

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

const formatTime = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms * 1000).toFixed(2)}µs`;
};

const calculatePercentile = (sorted: number[], percentile: number): number => {
  const index = Math.ceil((sorted.length * percentile) / 100) - 1;
  return sorted[Math.max(0, index)] ?? 0;
};

// Benchmark helper with detailed statistics
async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterCount = ITERATIONS,
  fileSize?: number,
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

  let throughput: string | undefined;
  if (fileSize) {
    const bytesPerSec = (fileSize * opsPerSec) / 1000;
    throughput = `${formatBytes(bytesPerSec)}/s`;
  }

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
    throughput,
  };
}

function printBenchmarkResult(result: BenchmarkResult): void {
  const name = result.name.padEnd(45);
  const stats = [
    `avg: ${formatTime(result.avgTime).padStart(8)}`,
    `min: ${formatTime(result.minTime).padStart(8)}`,
    `max: ${formatTime(result.maxTime).padStart(8)}`,
    `p95: ${formatTime(result.p95Time).padStart(8)}`,
    `p99: ${formatTime(result.p99Time).padStart(8)}`,
  ].join(" | ");
  const ops = `${result.opsPerSec.toLocaleString().padStart(8)} ops/s`;
  const throughput = result.throughput
    ? ` | ${result.throughput.padStart(12)}`
    : "";

  console.log(`  ${name} ${stats} | ${ops}${throughput}`);
}

// Setup and cleanup
async function setup(): Promise<void> {
  // Clean up any existing test directory
  try {
    await fs.remove(testDir);
  } catch {
    // Ignore if doesn't exist
  }
  await fs.ensureDir(testDir);
}

async function cleanup(): Promise<void> {
  try {
    await fs.remove(testDir);
  } catch {
    // Ignore cleanup errors
  }
}

// File operations benchmarks
async function benchmarkFileOperations(): Promise<BenchmarkResult[]> {
  console.log("\n📄 File Operations:");
  console.log("─".repeat(120));
  console.log(
    "  Operation".padEnd(45) +
      "avg".padStart(10) +
      "min".padStart(10) +
      "max".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "ops/s".padStart(12) +
      "throughput".padStart(14),
  );
  console.log("─".repeat(120));

  const results: BenchmarkResult[] = [];

  // Small file operations
  const smallData = createTestData(SMALL_FILE_SIZE);
  const smallBinary = createBinaryData(SMALL_FILE_SIZE);

  results.push(
    await benchmark(
      "readFile (small, 1KB, binary)",
      async () => {
        await fs.writeFile(testFile, smallData);
        await fs.readFile(testFile);
      },
      ITERATIONS,
      SMALL_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (small, 1KB, string)",
      async () => {
        await fs.writeFile(testFile, smallData);
      },
      ITERATIONS,
      SMALL_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (small, 1KB, binary)",
      async () => {
        await fs.writeFile(testFile, smallBinary);
      },
      ITERATIONS,
      SMALL_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "readFile (small, utf8)",
      async () => {
        await fs.writeFile(testFile, smallData);
        await fs.readFile(testFile, { encoding: "utf8" });
      },
      ITERATIONS,
      SMALL_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  // Medium file operations
  const mediumData = createTestData(MEDIUM_FILE_SIZE);
  const mediumBinary = createBinaryData(MEDIUM_FILE_SIZE);

  results.push(
    await benchmark(
      "readFile (medium, 10KB)",
      async () => {
        await fs.writeFile(testFile, mediumData);
        await fs.readFile(testFile);
      },
      ITERATIONS,
      MEDIUM_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (medium, 10KB)",
      async () => {
        await fs.writeFile(testFile, mediumData);
      },
      ITERATIONS,
      MEDIUM_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (medium, 10KB, binary)",
      async () => {
        await fs.writeFile(testFile, mediumBinary);
      },
      ITERATIONS,
      MEDIUM_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  // Large file operations
  const largeData = createTestData(LARGE_FILE_SIZE);
  const largeBinary = createBinaryData(LARGE_FILE_SIZE);

  results.push(
    await benchmark(
      "readFile (large, 1MB)",
      async () => {
        await fs.writeFile(testFile, largeData);
        await fs.readFile(testFile);
      },
      20,
      LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (large, 1MB, string)",
      async () => {
        await fs.writeFile(testFile, largeData);
      },
      20,
      LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (large, 1MB, binary)",
      async () => {
        await fs.writeFile(testFile, largeBinary);
      },
      20,
      LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  // Very large file operations
  const veryLargeData = createTestData(VERY_LARGE_FILE_SIZE);

  results.push(
    await benchmark(
      "readFile (very large, 10MB)",
      async () => {
        await fs.writeFile(testFile, veryLargeData);
        await fs.readFile(testFile);
      },
      5,
      VERY_LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "writeFile (very large, 10MB)",
      async () => {
        await fs.writeFile(testFile, veryLargeData);
      },
      5,
      VERY_LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  // JSON operations
  const jsonData = createTestJson();
  const jsonSize = JSON.stringify(jsonData).length;

  results.push(
    await benchmark(
      "writeJson",
      async () => {
        await fs.writeJson(testJsonFile, jsonData);
      },
      ITERATIONS,
      jsonSize,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "readJson",
      async () => {
        await fs.writeJson(testJsonFile, jsonData);
        await fs.readJson<typeof jsonData>(testJsonFile);
      },
      ITERATIONS,
      jsonSize,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("outputFile (creates dirs)", async () => {
      const path = join(testDir, "output", "file.txt");
      await fs.outputFile(path, smallData);
      await fs.remove(join(testDir, "output"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("outputJson (creates dirs)", async () => {
      const path = join(testDir, "output", "file.json");
      await fs.outputJson(path, jsonData);
      await fs.remove(join(testDir, "output"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  return results;
}

// Directory operations benchmarks
async function benchmarkDirectoryOperations(): Promise<BenchmarkResult[]> {
  console.log("\n📁 Directory Operations:");
  console.log("─".repeat(120));
  console.log(
    "  Operation".padEnd(45) +
      "avg".padStart(10) +
      "min".padStart(10) +
      "max".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "ops/s".padStart(12),
  );
  console.log("─".repeat(120));

  const results: BenchmarkResult[] = [];

  results.push(
    await benchmark("ensureDir (single)", async () => {
      const dir = join(testDir, "single");
      await fs.ensureDir(dir);
      await fs.remove(dir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("ensureDir (nested)", async () => {
      const dir = join(testDir, "a", "b", "c", "d");
      await fs.ensureDir(dir);
      await fs.remove(join(testDir, "a"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("mkdirp (alias)", async () => {
      const dir = join(testDir, "mkdirp", "test");
      await fs.mkdirp(dir);
      await fs.remove(join(testDir, "mkdirp"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("ensureFile", async () => {
      const file = join(testDir, "ensure", "file.txt");
      await fs.ensureFile(file);
      await fs.remove(join(testDir, "ensure"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("pathExists (exists)", async () => {
      await fs.writeFile(testFile, "test");
      await fs.pathExists(testFile);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("pathExists (not exists)", async () => {
      await fs.pathExists(join(testDir, "nonexistent"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("touch", async () => {
      await fs.writeFile(testFile, "test");
      await fs.touch(testFile);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("emptyDir", async () => {
      const dir = join(testDir, "empty");
      await fs.ensureDir(dir);
      await fs.writeFile(join(dir, "file1.txt"), "test");
      await fs.writeFile(join(dir, "file2.txt"), "test");
      await fs.emptyDir(dir);
      await fs.remove(dir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("remove (file)", async () => {
      await fs.writeFile(testFile, "test");
      await fs.remove(testFile);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("remove (directory)", async () => {
      const dir = join(testDir, "remove");
      await fs.ensureDir(dir);
      await fs.writeFile(join(dir, "file.txt"), "test");
      await fs.remove(dir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  return results;
}

// Copy and move operations benchmarks
async function benchmarkCopyMoveOperations(): Promise<BenchmarkResult[]> {
  console.log("\n📋 Copy & Move Operations:");
  console.log("─".repeat(120));
  console.log(
    "  Operation".padEnd(45) +
      "avg".padStart(10) +
      "min".padStart(10) +
      "max".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "ops/s".padStart(12),
  );
  console.log("─".repeat(120));

  const results: BenchmarkResult[] = [];

  // Setup source files
  await fs.ensureDir(copySource);
  await fs.writeFile(join(copySource, "file1.txt"), "test1");
  await fs.writeFile(join(copySource, "file2.txt"), "test2");
  await fs.ensureDir(join(copySource, "subdir"));
  await fs.writeFile(join(copySource, "subdir", "file3.txt"), "test3");

  results.push(
    await benchmark("copy (file)", async () => {
      const src = join(copySource, "file1.txt");
      const dest = join(copyDest, "file1.txt");
      await fs.copy(src, dest);
      await fs.remove(copyDest);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("copy (directory)", async () => {
      await fs.copy(copySource, copyDest);
      await fs.remove(copyDest);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "copy (large file, 1MB)",
      async () => {
        const largeData = createTestData(LARGE_FILE_SIZE);
        const src = join(copySource, "large.txt");
        const dest = join(copyDest, "large.txt");
        await fs.writeFile(src, largeData);
        await fs.copy(src, dest);
        await fs.remove(dest);
      },
      20,
      LARGE_FILE_SIZE,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("move (file)", async () => {
      const src = join(copySource, "file1.txt");
      const dest = join(copyDest, "moved.txt");
      await fs.move(src, dest);
      await fs.writeFile(src, "test1"); // Restore for next iteration
      await fs.remove(copyDest);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  return results;
}

// Advanced operations benchmarks
async function benchmarkAdvancedOperations(): Promise<BenchmarkResult[]> {
  console.log("\n🔧 Advanced Operations:");
  console.log("─".repeat(120));
  console.log(
    "  Operation".padEnd(45) +
      "avg".padStart(10) +
      "min".padStart(10) +
      "max".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "ops/s".padStart(12),
  );
  console.log("─".repeat(120));

  const results: BenchmarkResult[] = [];

  // Setup test directory structure
  const scanDir = join(testDir, "scan");
  await fs.ensureDir(scanDir);
  for (let i = 0; i < 10; i++) {
    await fs.writeFile(join(scanDir, `file${i}.txt`), "test");
    await fs.ensureDir(join(scanDir, `dir${i}`));
    await fs.writeFile(join(scanDir, `dir${i}`, `nested${i}.txt`), "test");
  }

  results.push(
    await benchmark("readdirRecursive (small)", async () => {
      await fs.readdirRecursive(scanDir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("listFiles (alias)", async () => {
      await fs.listFiles(scanDir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("readdirRecursive (with filter)", async () => {
      await fs.readdirRecursive(scanDir, { extensions: ["txt"] });
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  // Create larger directory structure for more realistic benchmarks
  const largeScanDir = join(testDir, "large-scan");
  await fs.ensureDir(largeScanDir);
  for (let i = 0; i < 50; i++) {
    await fs.writeFile(join(largeScanDir, `file${i}.txt`), "test");
    if (i % 5 === 0) {
      await fs.ensureDir(join(largeScanDir, `dir${i}`));
      for (let j = 0; j < 5; j++) {
        await fs.writeFile(
          join(largeScanDir, `dir${i}`, `nested${j}.txt`),
          "test",
        );
      }
    }
  }

  results.push(
    await benchmark(
      "readdirRecursive (large, 50 files)",
      async () => {
        await fs.readdirRecursive(largeScanDir);
      },
      20,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("sizeOf (file)", async () => {
      await fs.sizeOf(join(scanDir, "file0.txt"));
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("sizeOf (directory)", async () => {
      await fs.sizeOf(scanDir);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("readLines", async () => {
      const content = "line1\nline2\nline3\nline4\nline5";
      await fs.writeFile(testFile, content);
      await fs.readLines(testFile);
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark("readLines (with trim)", async () => {
      const content = "  line1  \n  line2  \n  line3  ";
      await fs.writeFile(testFile, content);
      await fs.readLines(testFile, { trim: true });
    }),
  );
  printBenchmarkResult(results[results.length - 1]!);

  results.push(
    await benchmark(
      "readLines (large, 1000 lines)",
      async () => {
        const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
        await fs.writeFile(testFile, lines.join("\n"));
        await fs.readLines(testFile);
      },
      20,
    ),
  );
  printBenchmarkResult(results[results.length - 1]!);

  return results;
}

// Link operations benchmarks
async function benchmarkLinkOperations(): Promise<BenchmarkResult[]> {
  console.log("\n🔗 Link Operations:");
  console.log("─".repeat(120));
  console.log(
    "  Operation".padEnd(45) +
      "avg".padStart(10) +
      "min".padStart(10) +
      "max".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "ops/s".padStart(12),
  );
  console.log("─".repeat(120));

  const results: BenchmarkResult[] = [];

  const linkSource = join(testDir, "link-source.txt");
  const linkDest = join(testDir, "link-dest.txt");
  const symlinkDest = join(testDir, "symlink-dest.txt");

  await fs.writeFile(linkSource, "test");

  const linkResult = await benchmark("ensureLink", async () => {
    try {
      await fs.ensureLink(linkSource, linkDest);
      await fs.remove(linkDest);
    } catch {
      // Skip on platforms that don't support hard links
    }
  });
  results.push(linkResult);
  printBenchmarkResult(linkResult);

  const symlinkResult = await benchmark("ensureSymlink", async () => {
    try {
      await fs.ensureSymlink(linkSource, symlinkDest);
      await fs.remove(symlinkDest);
    } catch {
      // Skip on platforms that don't support symlinks
    }
  });
  results.push(symlinkResult);
  printBenchmarkResult(symlinkResult);

  return results;
}

function printSummary(allResults: BenchmarkResult[]): void {
  console.log("\n📊 Summary Statistics:");
  console.log("─".repeat(120));

  const totalOps = allResults.reduce((sum, r) => sum + r.opsPerSec, 0);
  const avgOps = Math.round(totalOps / allResults.length);
  const fastest = allResults.reduce((max, r) =>
    r.opsPerSec > max.opsPerSec ? r : max,
  );
  const slowest = allResults.reduce((min, r) =>
    r.opsPerSec < min.opsPerSec ? r : min,
  );

  console.log(`  Total benchmarks: ${allResults.length}`);
  console.log(`  Average ops/sec: ${avgOps.toLocaleString()}`);
  console.log(
    `  Fastest: ${fastest.name} (${fastest.opsPerSec.toLocaleString()} ops/s)`,
  );
  console.log(
    `  Slowest: ${slowest.name} (${slowest.opsPerSec.toLocaleString()} ops/s)`,
  );

  // Group by category
  const fileOps = allResults.filter(
    (r) => r.name.includes("readFile") || r.name.includes("writeFile"),
  );
  const dirOps = allResults.filter(
    (r) =>
      r.name.includes("Dir") ||
      r.name.includes("remove") ||
      r.name.includes("pathExists"),
  );
  const copyOps = allResults.filter(
    (r) => r.name.includes("copy") || r.name.includes("move"),
  );

  if (fileOps.length > 0) {
    const avgFileOps = Math.round(
      fileOps.reduce((sum, r) => sum + r.opsPerSec, 0) / fileOps.length,
    );
    console.log(`  File operations avg: ${avgFileOps.toLocaleString()} ops/s`);
  }

  if (dirOps.length > 0) {
    const avgDirOps = Math.round(
      dirOps.reduce((sum, r) => sum + r.opsPerSec, 0) / dirOps.length,
    );
    console.log(
      `  Directory operations avg: ${avgDirOps.toLocaleString()} ops/s`,
    );
  }

  if (copyOps.length > 0) {
    const avgCopyOps = Math.round(
      copyOps.reduce((sum, r) => sum + r.opsPerSec, 0) / copyOps.length,
    );
    console.log(
      `  Copy/move operations avg: ${avgCopyOps.toLocaleString()} ops/s`,
    );
  }
}

// Main benchmark runner
async function runBenchmarks(): Promise<void> {
  console.log("🚀 Performance Benchmarks for @reliverse/dler-fs-utils");
  console.log("=".repeat(120));
  console.log(`Test directory: ${testDir}`);
  console.log(`Warmup runs: ${WARMUP_RUNS}`);
  console.log(`Default iterations: ${ITERATIONS}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  if (typeof process.versions.bun !== "undefined") {
    console.log(`Bun version: ${process.versions.bun}`);
  }
  console.log("=".repeat(120));

  const allResults: BenchmarkResult[] = [];

  try {
    await setup();

    const fileResults = await benchmarkFileOperations();
    allResults.push(...fileResults);

    const dirResults = await benchmarkDirectoryOperations();
    allResults.push(...dirResults);

    const copyResults = await benchmarkCopyMoveOperations();
    allResults.push(...copyResults);

    const advancedResults = await benchmarkAdvancedOperations();
    allResults.push(...advancedResults);

    const linkResults = await benchmarkLinkOperations();
    allResults.push(...linkResults);

    printSummary(allResults);

    console.log("\n✅ All benchmarks completed!");
  } catch (error) {
    console.error("\n❌ Benchmark failed:", error);
    throw error;
  } finally {
    await cleanup();
  }
}

// Run if executed directly
if (import.meta.main) {
  runBenchmarks().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
