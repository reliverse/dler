import { logger, relinka } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

export async function benchmarkMessageFormatting(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Single argument
  results.push(
    await benchmark("sync single arg", () => {
      logger.info("Single message");
    })
  );

  // Multiple arguments
  results.push(
    await benchmark("sync multiple args (3)", () => {
      logger.info("User", "john_doe", "logged in");
    })
  );

  results.push(
    await benchmark("sync multiple args (5)", () => {
      logger.info("Failed to connect to", "localhost", "on port", 3000, "with error");
    })
  );

  results.push(
    await benchmark("sync multiple args (10)", () => {
      logger.info("A", "B", "C", "D", "E", "F", "G", "H", "I", "J");
    })
  );

  // Async single argument
  results.push(
    await benchmark("async single arg", async () => {
      await relinka.info("Single message");
    })
  );

  // Async multiple arguments
  results.push(
    await benchmark("async multiple args (3)", async () => {
      await relinka.info("User", "john_doe", "logged in");
    })
  );

  results.push(
    await benchmark("async multiple args (5)", async () => {
      await relinka.info("Failed to connect to", "localhost", "on port", 3000, "with error");
    })
  );

  results.push(
    await benchmark("async multiple args (10)", async () => {
      await relinka.info("A", "B", "C", "D", "E", "F", "G", "H", "I", "J");
    })
  );

  // Different data types
  results.push(
    await benchmark("sync mixed types", () => {
      logger.info("Value:", 42, "Flag:", true, "Null:", null);
    })
  );

  results.push(
    await benchmark("async mixed types", async () => {
      await relinka.info("Value:", 42, "Flag:", true, "Null:", null);
    })
  );

  return results;
}
