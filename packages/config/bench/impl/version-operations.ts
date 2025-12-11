import {
  bumpVersion,
  getNextVersion,
  getReleaseType,
  isPrerelease,
  parseVersion,
} from "../../src/mod";
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

export async function benchmarkVersionOperations(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark parseVersion
  results.push(
    await benchmark("parseVersion (valid)", () => {
      for (const version of testVersions) {
        parseVersion(version);
      }
    }),
  );

  results.push(
    await benchmark("parseVersion (single)", () => {
      parseVersion("1.2.3");
    }),
  );

  results.push(
    await benchmark("parseVersion (invalid)", () => {
      parseVersion("invalid");
    }),
  );

  // Benchmark bumpVersion
  results.push(
    await benchmark("bumpVersion (patch)", () => {
      bumpVersion("1.2.3", "patch");
    }),
  );

  results.push(
    await benchmark("bumpVersion (minor)", () => {
      bumpVersion("1.2.3", "minor");
    }),
  );

  results.push(
    await benchmark("bumpVersion (major)", () => {
      bumpVersion("1.2.3", "major");
    }),
  );

  // Benchmark getNextVersion
  results.push(
    await benchmark("getNextVersion (patch)", () => {
      getNextVersion("1.2.3", "patch");
    }),
  );

  // Benchmark isPrerelease
  results.push(
    await benchmark("isPrerelease (release)", () => {
      isPrerelease("1.2.3");
    }),
  );

  results.push(
    await benchmark("isPrerelease (prerelease)", () => {
      isPrerelease("1.2.3-beta.1");
    }),
  );

  // Benchmark getReleaseType
  results.push(
    await benchmark("getReleaseType", () => {
      getReleaseType("1.2.3");
      getReleaseType("0.1.0");
      getReleaseType("2.0.0");
    }),
  );

  return results;
}
