import { logger } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

export async function benchmarkSyncLogger(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Basic log levels
  results.push(
    await benchmark("sync logger.log", () => {
      logger.log("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.info", () => {
      logger.info("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.success", () => {
      logger.success("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.warn", () => {
      logger.warn("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.error", () => {
      logger.error("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.fatal", () => {
      logger.fatal("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.debug", () => {
      logger.debug("Test message");
    }),
  );

  results.push(
    await benchmark("sync logger.raw", () => {
      logger.raw("Test message");
    }),
  );

  // Callable function interface
  results.push(
    await benchmark("sync logger('info', ...)", () => {
      logger("info", "Test message");
    }),
  );

  return results;
}
