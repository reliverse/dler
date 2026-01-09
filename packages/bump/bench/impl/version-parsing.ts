import { parseVersion } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const testVersions = [
  "1.0.0",
  "2.3.4",
  "10.20.30",
  "0.1.0",
  "1.2.3-beta.1",
  "2.0.0-alpha.5",
  "3.1.0-rc.2",
  "1.0.0-0",
  "invalid-version",
  "not.a.version",
  "1",
  "1.2",
  "1.2.3.4",
];

export async function benchmarkVersionParsing(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark valid version parsing
  results.push(
    await benchmark("parseVersion (valid)", () => {
      for (const version of testVersions) {
        parseVersion(version);
      }
    })
  );

  // Benchmark single valid version
  results.push(
    await benchmark("parseVersion (single valid)", () => {
      parseVersion("1.2.3");
    })
  );

  // Benchmark invalid version handling
  results.push(
    await benchmark("parseVersion (invalid)", () => {
      parseVersion("invalid");
    })
  );

  // Benchmark edge cases
  results.push(
    await benchmark("parseVersion (edge cases)", () => {
      parseVersion("0.0.0");
      parseVersion("999.999.999");
      parseVersion("1.0.0-beta.1");
    })
  );

  return results;
}
