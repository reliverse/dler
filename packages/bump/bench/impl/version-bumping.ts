import { bumpVersion, getNextVersion } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const testVersions = ["1.0.0", "2.3.4", "10.20.30", "0.1.0", "1.2.3-beta.1", "2.0.0-alpha.5"];

const bumpTypes = ["major", "minor", "patch", "prerelease"] as const;

export async function benchmarkVersionBumping(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark bumpVersion for each type
  for (const type of bumpTypes) {
    results.push(
      await benchmark(`bumpVersion (${type})`, () => {
        for (const version of testVersions) {
          bumpVersion(version, type);
        }
      })
    );
  }

  // Benchmark getNextVersion for each type
  for (const type of bumpTypes) {
    results.push(
      await benchmark(`getNextVersion (${type})`, () => {
        for (const version of testVersions) {
          getNextVersion(version, type);
        }
      })
    );
  }

  // Benchmark single bump operation
  results.push(
    await benchmark("bumpVersion (single patch)", () => {
      bumpVersion("1.2.3", "patch");
    })
  );

  // Benchmark single getNextVersion operation
  results.push(
    await benchmark("getNextVersion (single minor)", () => {
      getNextVersion("1.2.3", "minor");
    })
  );

  // Benchmark complex bumping scenarios
  results.push(
    await benchmark("bumpVersion (complex scenarios)", () => {
      bumpVersion("1.0.0", "major");
      bumpVersion("1.0.0", "minor");
      bumpVersion("1.0.0", "patch");
      bumpVersion("1.0.0-beta.1", "prerelease");
      bumpVersion("1.2.3", "major");
      bumpVersion("1.2.3", "minor");
    })
  );

  return results;
}
