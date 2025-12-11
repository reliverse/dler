import { relinka } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

export async function benchmarkAsyncLogger(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Basic log levels
  results.push(
    await benchmark("async relinka.log", async () => {
      await relinka.log("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.info", async () => {
      await relinka.info("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.success", async () => {
      await relinka.success("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.warn", async () => {
      await relinka.warn("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.error", async () => {
      await relinka.error("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.fatal", async () => {
      await relinka.fatal("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.debug", async () => {
      await relinka.debug("Test message");
    }),
  );

  results.push(
    await benchmark("async relinka.raw", async () => {
      await relinka.raw("Test message");
    }),
  );

  // Callable function interface
  results.push(
    await benchmark("async relinka('info', ...)", async () => {
      await relinka("info", "Test message");
    }),
  );

  return results;
}
