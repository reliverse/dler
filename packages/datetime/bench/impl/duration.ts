import {
  addDuration,
  diffInDays,
  diffInHours,
  diffInMilliseconds,
  diffInMinutes,
  diffInMonths,
  diffInSeconds,
  diffInWeeks,
  diffInYears,
  getDuration,
  subtractDuration,
} from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const startDate = new Date("2024-01-15T10:30:45.123Z");
const endDate = new Date("2024-12-31T23:59:59.999Z");
const datePairs = [
  [new Date("2024-01-01T00:00:00.000Z"), new Date("2024-12-31T23:59:59.999Z")],
  [new Date("2023-01-01T00:00:00.000Z"), new Date("2024-01-01T00:00:00.000Z")],
  [new Date("2024-06-15T10:00:00.000Z"), new Date("2024-06-20T15:30:00.000Z")],
];

const durations = [
  { years: 1, months: 2, days: 5 },
  { weeks: 2, days: 3, hours: 5 },
  { hours: 10, minutes: 30, seconds: 45 },
  { milliseconds: 500, seconds: 30 },
];

export async function benchmarkDuration(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark getDuration
  results.push(
    await benchmark("getDuration", () => {
      getDuration(startDate, endDate);
      getDuration(datePairs[0]?.[0] ?? startDate, datePairs[0]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInMilliseconds
  results.push(
    await benchmark("diffInMilliseconds", () => {
      diffInMilliseconds(startDate, endDate);
      diffInMilliseconds(datePairs[0]?.[0] ?? startDate, datePairs[0]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInSeconds
  results.push(
    await benchmark("diffInSeconds", () => {
      diffInSeconds(startDate, endDate);
      diffInSeconds(datePairs[1]?.[0] ?? startDate, datePairs[1]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInMinutes
  results.push(
    await benchmark("diffInMinutes", () => {
      diffInMinutes(startDate, endDate);
      diffInMinutes(datePairs[2]?.[0] ?? startDate, datePairs[2]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInHours
  results.push(
    await benchmark("diffInHours", () => {
      diffInHours(startDate, endDate);
      diffInHours(datePairs[0]?.[0] ?? startDate, datePairs[0]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInDays
  results.push(
    await benchmark("diffInDays", () => {
      diffInDays(startDate, endDate);
      diffInDays(datePairs[1]?.[0] ?? startDate, datePairs[1]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInWeeks
  results.push(
    await benchmark("diffInWeeks", () => {
      diffInWeeks(startDate, endDate);
      diffInWeeks(datePairs[0]?.[0] ?? startDate, datePairs[0]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInMonths
  results.push(
    await benchmark("diffInMonths", () => {
      diffInMonths(startDate, endDate);
      diffInMonths(datePairs[1]?.[0] ?? startDate, datePairs[1]?.[1] ?? endDate);
    }),
  );

  // Benchmark diffInYears
  results.push(
    await benchmark("diffInYears", () => {
      diffInYears(startDate, endDate);
      diffInYears(datePairs[1]?.[0] ?? startDate, datePairs[1]?.[1] ?? endDate);
    }),
  );

  // Benchmark addDuration
  results.push(
    await benchmark("addDuration", () => {
      addDuration(startDate, durations[0] ?? {});
      addDuration(startDate, durations[1] ?? {});
      addDuration(startDate, durations[2] ?? {});
    }),
  );

  // Benchmark subtractDuration
  results.push(
    await benchmark("subtractDuration", () => {
      subtractDuration(endDate, durations[0] ?? {});
      subtractDuration(endDate, durations[1] ?? {});
      subtractDuration(endDate, durations[2] ?? {});
    }),
  );

  // Benchmark mixed duration operations
  results.push(
    await benchmark("duration (mixed operations)", () => {
      getDuration(startDate, endDate);
      diffInDays(startDate, endDate);
      addDuration(startDate, durations[0] ?? {});
      diffInHours(startDate, endDate);
      subtractDuration(endDate, durations[1] ?? {});
    }),
  );

  return results;
}
