import {
  getAvailableTimezones,
  getTimezoneOffset,
  toTimezone,
} from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const testDate = new Date("2024-01-15T10:30:45.123Z");
const testDates = [
  new Date("2024-01-15T10:30:45.123Z"),
  new Date("2023-12-25T00:00:00.000Z"),
  new Date("2024-06-15T15:45:30.500Z"),
];

const commonTimezones = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export async function benchmarkTimezone(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark getAvailableTimezones (should be cached after first call)
  results.push(
    await benchmark("getAvailableTimezones", () => {
      getAvailableTimezones();
    }),
  );

  // Benchmark toTimezone with different timezones
  results.push(
    await benchmark("toTimezone (single timezone)", () => {
      toTimezone(testDate, "America/New_York");
      toTimezone(testDate, "Europe/London");
    }),
  );

  results.push(
    await benchmark("toTimezone (multiple timezones)", () => {
      toTimezone(testDate, commonTimezones[0] ?? "UTC");
      toTimezone(testDate, commonTimezones[1] ?? "UTC");
      toTimezone(testDate, commonTimezones[2] ?? "UTC");
      toTimezone(testDate, commonTimezones[3] ?? "UTC");
    }),
  );

  results.push(
    await benchmark("toTimezone (different dates)", () => {
      toTimezone(testDates[0] ?? testDate, "America/New_York");
      toTimezone(testDates[1] ?? testDate, "Europe/London");
      toTimezone(testDates[2] ?? testDate, "Asia/Tokyo");
    }),
  );

  // Benchmark getTimezoneOffset
  results.push(
    await benchmark("getTimezoneOffset (single timezone)", () => {
      getTimezoneOffset(testDate, "America/New_York");
      getTimezoneOffset(testDate, "Europe/London");
    }),
  );

  results.push(
    await benchmark("getTimezoneOffset (multiple timezones)", () => {
      getTimezoneOffset(testDate, commonTimezones[0] ?? "UTC");
      getTimezoneOffset(testDate, commonTimezones[1] ?? "UTC");
      getTimezoneOffset(testDate, commonTimezones[2] ?? "UTC");
      getTimezoneOffset(testDate, commonTimezones[3] ?? "UTC");
    }),
  );

  // Benchmark mixed timezone operations
  results.push(
    await benchmark("timezone (mixed operations)", () => {
      toTimezone(testDate, "America/New_York");
      getTimezoneOffset(testDate, "Europe/London");
      toTimezone(testDates[0] ?? testDate, "Asia/Tokyo");
      getTimezoneOffset(testDates[1] ?? testDate, "Australia/Sydney");
    }),
  );

  return results;
}
