import { logger, relinka } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

export async function benchmarkBoxFormatting(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  const shortMessage = "Short message";
  const mediumMessage =
    "This is a medium length message that will test box formatting with multiple lines\nLine 2\nLine 3";
  const longMessage = `This is a very long message that spans multiple lines
and contains a lot of text to test the box formatting performance
with larger content blocks that need to be properly formatted
and displayed in a nice box format with proper padding and borders.`;

  // Sync box formatting
  results.push(
    await benchmark("sync logger.box (short)", () => {
      logger.box(shortMessage);
    }),
  );

  results.push(
    await benchmark("sync logger.box (medium)", () => {
      logger.box(mediumMessage);
    }),
  );

  results.push(
    await benchmark("sync logger.box (long)", () => {
      logger.box(longMessage);
    }),
  );

  // Async box formatting
  results.push(
    await benchmark("async relinka.box (short)", async () => {
      await relinka.box(shortMessage);
    }),
  );

  results.push(
    await benchmark("async relinka.box (medium)", async () => {
      await relinka.box(mediumMessage);
    }),
  );

  results.push(
    await benchmark("async relinka.box (long)", async () => {
      await relinka.box(longMessage);
    }),
  );

  return results;
}
