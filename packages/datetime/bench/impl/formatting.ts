import { formatCustom, formatDate, formatDuration, formatISO, formatRFC2822 } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const testDate = new Date("2024-01-15T10:30:45.123Z");
const testDates = [
  new Date("2024-01-15T10:30:45.123Z"),
  new Date("2023-12-25T00:00:00.000Z"),
  new Date("2024-06-15T15:45:30.500Z"),
  new Date("2025-01-01T12:00:00.000Z"),
];

export async function benchmarkFormatting(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark formatISO
  results.push(
    await benchmark("formatISO", () => {
      formatISO(testDate);
      formatISO(testDates[0] ?? testDate);
      formatISO(testDates[1] ?? testDate);
    })
  );

  // Benchmark formatRFC2822
  results.push(
    await benchmark("formatRFC2822", () => {
      formatRFC2822(testDate);
      formatRFC2822(testDates[0] ?? testDate);
      formatRFC2822(testDates[1] ?? testDate);
    })
  );

  // Benchmark formatDate with Intl options
  results.push(
    await benchmark("formatDate (Intl - long)", () => {
      formatDate(testDate, { dateStyle: "long", timeStyle: "long" });
      formatDate(testDates[0] ?? testDate, {
        dateStyle: "medium",
        timeStyle: "medium",
      });
    })
  );

  results.push(
    await benchmark("formatDate (Intl - short)", () => {
      formatDate(testDate, { dateStyle: "short", timeStyle: "short" });
      formatDate(testDates[0] ?? testDate, { dateStyle: "short" });
    })
  );

  results.push(
    await benchmark("formatDate (Intl - custom options)", () => {
      formatDate(testDate, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      formatDate(testDates[0] ?? testDate, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    })
  );

  // Benchmark formatCustom with various patterns
  results.push(
    await benchmark("formatCustom (YYYY-MM-DD HH:mm:ss)", () => {
      formatCustom(testDate, "YYYY-MM-DD HH:mm:ss");
      formatCustom(testDates[0] ?? testDate, "YYYY-MM-DD HH:mm:ss");
    })
  );

  results.push(
    await benchmark("formatCustom (complex pattern)", () => {
      formatCustom(testDate, "YYYY-MM-DD HH:mm:ss.SSS");
      formatCustom(testDates[0] ?? testDate, "DD/MM/YYYY HH:mm");
      formatCustom(testDates[1] ?? testDate, "MM-DD-YYYY hh:mm AM/PM");
    })
  );

  results.push(
    await benchmark("formatCustom (12-hour format)", () => {
      formatCustom(testDate, "hh:mm:ss AM/PM");
      formatCustom(testDates[0] ?? testDate, "YYYY-MM-DD hh:mm AM/PM");
    })
  );

  // Benchmark formatDuration
  const duration1 = { years: 2, months: 3, days: 5, hours: 10, minutes: 30 };
  const duration2 = { weeks: 1, days: 2, hours: 5 };
  const duration3 = { milliseconds: 500, seconds: 30, minutes: 5 };

  results.push(
    await benchmark("formatDuration (long duration)", () => {
      formatDuration(duration1);
      formatDuration(duration2);
    })
  );

  results.push(
    await benchmark("formatDuration (short duration)", () => {
      formatDuration(duration3);
      formatDuration({ seconds: 45 });
    })
  );

  // Benchmark multiple formatting operations
  results.push(
    await benchmark("formatting (mixed operations)", () => {
      formatISO(testDate);
      formatCustom(testDate, "YYYY-MM-DD HH:mm:ss");
      formatDate(testDate, { dateStyle: "long" });
      formatRFC2822(testDate);
      formatDuration({ days: 1, hours: 2, minutes: 30 });
    })
  );

  return results;
}
