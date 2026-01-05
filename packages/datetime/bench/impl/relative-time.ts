import { formatRelativeTime } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const baseDate = new Date("2024-01-15T12:00:00.000Z");
const testDates = [
  new Date("2024-01-15T11:00:00.000Z"), // 1 hour ago
  new Date("2024-01-14T12:00:00.000Z"), // 1 day ago
  new Date("2024-01-08T12:00:00.000Z"), // 1 week ago
  new Date("2023-12-15T12:00:00.000Z"), // 1 month ago
  new Date("2023-01-15T12:00:00.000Z"), // 1 year ago
  new Date("2024-01-15T13:00:00.000Z"), // in 1 hour
  new Date("2024-01-16T12:00:00.000Z"), // in 1 day
  new Date("2024-01-22T12:00:00.000Z"), // in 1 week
];

export async function benchmarkRelativeTime(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark formatRelativeTime with default options
  results.push(
    await benchmark("formatRelativeTime (default options)", () => {
      formatRelativeTime(testDates[0] ?? baseDate, baseDate);
      formatRelativeTime(testDates[1] ?? baseDate, baseDate);
      formatRelativeTime(testDates[2] ?? baseDate, baseDate);
    }),
  );

  // Benchmark formatRelativeTime with different time ranges
  results.push(
    await benchmark("formatRelativeTime (hours)", () => {
      formatRelativeTime(testDates[0] ?? baseDate, baseDate);
      formatRelativeTime(testDates[5] ?? baseDate, baseDate);
    }),
  );

  results.push(
    await benchmark("formatRelativeTime (days)", () => {
      formatRelativeTime(testDates[1] ?? baseDate, baseDate);
      formatRelativeTime(testDates[6] ?? baseDate, baseDate);
    }),
  );

  results.push(
    await benchmark("formatRelativeTime (weeks)", () => {
      formatRelativeTime(testDates[2] ?? baseDate, baseDate);
      formatRelativeTime(testDates[7] ?? baseDate, baseDate);
    }),
  );

  results.push(
    await benchmark("formatRelativeTime (months/years)", () => {
      formatRelativeTime(testDates[3] ?? baseDate, baseDate);
      formatRelativeTime(testDates[4] ?? baseDate, baseDate);
    }),
  );

  // Benchmark formatRelativeTime with custom options
  results.push(
    await benchmark("formatRelativeTime (short style)", () => {
      formatRelativeTime(testDates[0] ?? baseDate, baseDate, {
        style: "short",
      });
      formatRelativeTime(testDates[1] ?? baseDate, baseDate, {
        style: "short",
      });
    }),
  );

  results.push(
    await benchmark("formatRelativeTime (narrow style)", () => {
      formatRelativeTime(testDates[0] ?? baseDate, baseDate, {
        style: "narrow",
      });
      formatRelativeTime(testDates[2] ?? baseDate, baseDate, {
        style: "narrow",
      });
    }),
  );

  results.push(
    await benchmark("formatRelativeTime (custom locale)", () => {
      formatRelativeTime(testDates[0] ?? baseDate, baseDate, {
        locale: "fr-FR",
      });
      formatRelativeTime(testDates[1] ?? baseDate, baseDate, {
        locale: "de-DE",
      });
    }),
  );

  // Benchmark formatRelativeTime with string inputs
  results.push(
    await benchmark("formatRelativeTime (string inputs)", () => {
      formatRelativeTime("2024-01-15T11:00:00.000Z", baseDate);
      formatRelativeTime("2024-01-14T12:00:00.000Z", baseDate);
      formatRelativeTime(testDates[0] ?? baseDate, "2024-01-15T12:00:00.000Z");
    }),
  );

  // Benchmark formatRelativeTime with timestamp inputs
  results.push(
    await benchmark("formatRelativeTime (timestamp inputs)", () => {
      formatRelativeTime(testDates[0]?.getTime() ?? baseDate.getTime(), baseDate);
      formatRelativeTime(testDates[1]?.getTime() ?? baseDate.getTime(), baseDate);
    }),
  );

  return results;
}
