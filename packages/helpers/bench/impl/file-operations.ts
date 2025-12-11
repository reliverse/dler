import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchmarkResult } from "../perf";

// Create temporary directory for benchmarks
const tempDir = join(Bun.env.TMPDIR || "/tmp", `bench-helpers-${Date.now()}`);
mkdirSync(tempDir, { recursive: true });

// Mock file content
const createMockContent = (size: number): string => {
  return "x".repeat(size);
};

// Simulate file reading operations
function readFileContent(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

// Simulate file writing operations
function writeFileContent(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf-8");
}

// Simulate file processing (read, process, write)
function processFile(filePath: string): void {
  const content = readFileContent(filePath);
  const processed = content.toUpperCase();
  writeFileContent(filePath, processed);
}

export async function benchmarkFileOperations(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Create test files
  const smallFile = join(tempDir, "small.txt");
  const mediumFile = join(tempDir, "medium.txt");
  const largeFile = join(tempDir, "large.txt");

  writeFileContent(smallFile, createMockContent(100));
  writeFileContent(mediumFile, createMockContent(1000));
  writeFileContent(largeFile, createMockContent(10000));

  // Benchmark read operations
  results.push(
    await benchmark("read file (small, 100 bytes)", () => {
      readFileContent(smallFile);
    }),
  );

  results.push(
    await benchmark("read file (medium, 1KB)", () => {
      readFileContent(mediumFile);
    }),
  );

  results.push(
    await benchmark("read file (large, 10KB)", () => {
      readFileContent(largeFile);
    }),
  );

  // Benchmark write operations
  const smallContent = createMockContent(100);
  results.push(
    await benchmark("write file (small, 100 bytes)", () => {
      writeFileContent(smallFile, smallContent);
    }),
  );

  const mediumContent = createMockContent(1000);
  results.push(
    await benchmark("write file (medium, 1KB)", () => {
      writeFileContent(mediumFile, mediumContent);
    }),
  );

  const largeContent = createMockContent(10000);
  results.push(
    await benchmark("write file (large, 10KB)", () => {
      writeFileContent(largeFile, largeContent);
    }),
  );

  // Benchmark combined read+write operations
  results.push(
    await benchmark("process file (read+write, small)", () => {
      processFile(smallFile);
    }),
  );

  results.push(
    await benchmark("process file (read+write, medium)", () => {
      processFile(mediumFile);
    }),
  );

  // Cleanup
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  return results;
}
