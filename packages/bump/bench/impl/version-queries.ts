import { getReleaseType, isPrerelease } from "../../src/mod";
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
];

export async function benchmarkVersionQueries(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark isPrerelease
  results.push(
    await benchmark("isPrerelease (all versions)", () => {
      for (const version of testVersions) {
        isPrerelease(version);
      }
    }),
  );

  // Benchmark single isPrerelease check
  results.push(
    await benchmark("isPrerelease (single prerelease)", () => {
      isPrerelease("1.2.3-beta.1");
    }),
  );

  // Benchmark single isPrerelease check (non-prerelease)
  results.push(
    await benchmark("isPrerelease (single release)", () => {
      isPrerelease("1.2.3");
    }),
  );

  // Benchmark getReleaseType
  results.push(
    await benchmark("getReleaseType (all versions)", () => {
      for (const version of testVersions) {
        getReleaseType(version);
      }
    }),
  );

  // Benchmark single getReleaseType check
  results.push(
    await benchmark("getReleaseType (single major)", () => {
      getReleaseType("2.0.0");
    }),
  );

  // Benchmark single getReleaseType check (minor)
  results.push(
    await benchmark("getReleaseType (single minor)", () => {
      getReleaseType("0.2.0");
    }),
  );

  // Benchmark single getReleaseType check (patch)
  results.push(
    await benchmark("getReleaseType (single patch)", () => {
      getReleaseType("0.0.1");
    }),
  );

  // Benchmark combined queries
  results.push(
    await benchmark("version queries (combined)", () => {
      for (const version of testVersions) {
        isPrerelease(version);
        getReleaseType(version);
      }
    }),
  );

  return results;
}
