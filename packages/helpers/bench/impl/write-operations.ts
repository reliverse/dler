import {
  writeError,
  writeErrorLines,
  writeJsonFile,
  writeLine,
  writeTextFile,
} from "../../src/impl/write";
import type { BenchmarkResult } from "../perf";

// Mock data
const createMockJson = (size: number) => {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < size; i++) {
    obj[`key${i}`] = `value${i}`;
  }
  return obj;
};

const createMockLines = (count: number): string[] => {
  return Array.from({ length: count }, (_, i) => `Line ${i}: test content`);
};

export async function benchmarkWriteOperations(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark writeLine
  results.push(
    await benchmark("writeLine (single)", () => {
      writeLine("Test line");
    })
  );

  // Benchmark writeError
  results.push(
    await benchmark("writeError (single)", () => {
      writeError("Test error");
    })
  );

  // Benchmark writeErrorLines
  const smallLines = createMockLines(10);
  results.push(
    await benchmark("writeErrorLines (10 lines)", () => {
      writeErrorLines(smallLines);
    })
  );

  const mediumLines = createMockLines(50);
  results.push(
    await benchmark("writeErrorLines (50 lines)", () => {
      writeErrorLines(mediumLines);
    })
  );

  const largeLines = createMockLines(100);
  results.push(
    await benchmark("writeErrorLines (100 lines)", () => {
      writeErrorLines(largeLines);
    })
  );

  // Benchmark writeJsonFile (using temp file)
  const smallJson = createMockJson(10);
  const tempFile = `${Bun.env.TMPDIR || "/tmp"}/bench-${Date.now()}.json`;
  results.push(
    await benchmark("writeJsonFile (small)", async () => {
      await writeJsonFile(tempFile, smallJson);
    })
  );

  const mediumJson = createMockJson(100);
  results.push(
    await benchmark("writeJsonFile (medium)", async () => {
      await writeJsonFile(tempFile, mediumJson);
    })
  );

  // Benchmark writeTextFile
  const smallText = "x".repeat(100);
  results.push(
    await benchmark("writeTextFile (small)", async () => {
      await writeTextFile(tempFile, smallText);
    })
  );

  const mediumText = "x".repeat(1000);
  results.push(
    await benchmark("writeTextFile (medium)", async () => {
      await writeTextFile(tempFile, mediumText);
    })
  );

  const largeText = "x".repeat(10_000);
  results.push(
    await benchmark("writeTextFile (large)", async () => {
      await writeTextFile(tempFile, largeText);
    })
  );

  // Cleanup
  try {
    await Bun.file(tempFile).unlink();
  } catch {
    // Ignore cleanup errors
  }

  return results;
}
