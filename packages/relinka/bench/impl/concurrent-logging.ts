import { relinka } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

export async function benchmarkConcurrentLogging(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Concurrent async logging (10 parallel operations)
  results.push(
    await benchmark(
      "concurrent async (10 parallel)",
      async () => {
        await Promise.all(
          Array.from({ length: 10 }, (_, i) => relinka.info(`Concurrent message ${i}`))
        );
      },
      100
    )
  );

  // Concurrent async logging (50 parallel operations)
  results.push(
    await benchmark(
      "concurrent async (50 parallel)",
      async () => {
        await Promise.all(
          Array.from({ length: 50 }, (_, i) => relinka.info(`Concurrent message ${i}`))
        );
      },
      100
    )
  );

  // Concurrent async logging (100 parallel operations)
  results.push(
    await benchmark(
      "concurrent async (100 parallel)",
      async () => {
        await Promise.all(
          Array.from({ length: 100 }, (_, i) => relinka.info(`Concurrent message ${i}`))
        );
      },
      50
    )
  );

  // Mixed log levels concurrent
  results.push(
    await benchmark(
      "concurrent mixed levels (20 ops)",
      async () => {
        await Promise.all([
          ...Array.from({ length: 5 }, () => relinka.info("Info message")),
          ...Array.from({ length: 5 }, () => relinka.success("Success message")),
          ...Array.from({ length: 5 }, () => relinka.warn("Warning message")),
          ...Array.from({ length: 5 }, () => relinka.error("Error message")),
        ]);
      },
      100
    )
  );

  return results;
}
