import { isValidDate, parseDate, parseISO } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const isoStrings = [
  "2024-01-15T10:30:45.123Z",
  "2023-12-25T00:00:00.000Z",
  "2024-06-15T15:45:30.500Z",
  "2025-01-01T12:00:00.000Z",
  "2024-03-20T08:15:22.999Z",
];

const dateStrings = [
  "2024-01-15",
  "2024/01/15",
  "January 15, 2024",
  "15 Jan 2024",
  "2024-01-15T10:30:45",
];

const timestamps = [
  1705315845123, 1703520000000, 1718455530500, 1735747200000, 1710922522999,
];

export async function benchmarkParsing(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark parseISO
  results.push(
    await benchmark("parseISO", () => {
      parseISO(isoStrings[0] ?? "");
      parseISO(isoStrings[1] ?? "");
      parseISO(isoStrings[2] ?? "");
    }),
  );

  // Benchmark parseDate with ISO strings
  results.push(
    await benchmark("parseDate (ISO strings)", () => {
      parseDate(isoStrings[0] ?? "");
      parseDate(isoStrings[1] ?? "");
      parseDate(isoStrings[2] ?? "");
    }),
  );

  // Benchmark parseDate with various date strings
  results.push(
    await benchmark("parseDate (various formats)", () => {
      parseDate(dateStrings[0] ?? "");
      parseDate(dateStrings[1] ?? "");
      parseDate(dateStrings[2] ?? "");
      parseDate(dateStrings[3] ?? "");
    }),
  );

  // Benchmark parseDate with timestamps
  results.push(
    await benchmark("parseDate (timestamps)", () => {
      parseDate(timestamps[0] ?? 0);
      parseDate(timestamps[1] ?? 0);
      parseDate(timestamps[2] ?? 0);
    }),
  );

  // Benchmark parseDate with Date objects (should be fast path)
  const dateObjects = [
    new Date("2024-01-15T10:30:45.123Z"),
    new Date("2023-12-25T00:00:00.000Z"),
    new Date("2024-06-15T15:45:30.500Z"),
  ];

  results.push(
    await benchmark("parseDate (Date objects)", () => {
      parseDate(dateObjects[0] ?? new Date());
      parseDate(dateObjects[1] ?? new Date());
      parseDate(dateObjects[2] ?? new Date());
    }),
  );

  // Benchmark isValidDate
  results.push(
    await benchmark("isValidDate (valid dates)", () => {
      isValidDate(isoStrings[0] ?? "");
      isValidDate(timestamps[0] ?? 0);
      isValidDate(dateObjects[0] ?? new Date());
    }),
  );

  results.push(
    await benchmark("isValidDate (invalid dates)", () => {
      isValidDate("invalid-date");
      isValidDate("not-a-date");
      isValidDate("");
    }),
  );

  // Benchmark mixed parsing operations
  results.push(
    await benchmark("parsing (mixed operations)", () => {
      parseISO(isoStrings[0] ?? "");
      parseDate(dateStrings[0] ?? "");
      parseDate(timestamps[0] ?? 0);
      isValidDate(isoStrings[0] ?? "");
      parseISO(isoStrings[1] ?? "");
    }),
  );

  return results;
}
