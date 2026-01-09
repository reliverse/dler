import {
  createIgnoreFilter,
  createIncludeFilter,
  normalizePatterns,
} from "@reliverse/matcha";
import type { BenchmarkResult } from "../perf";

// Mock package info array
const createMockPackages = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `@test/package-${i}`,
    path: `/test/package-${i}`,
    private: i % 3 === 0,
  }));
};

export async function benchmarkPackageFiltering(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const packages = createMockPackages(100);

  // Benchmark ignore filter
  results.push(
    await benchmark("package filtering (ignore)", () => {
      const ignoreFilter = createIgnoreFilter([
        "@test/package-1",
        "@test/package-2",
      ]);
      ignoreFilter(packages);
    })
  );

  // Benchmark include filter
  results.push(
    await benchmark("package filtering (include)", () => {
      const includeFilter = createIncludeFilter(["@test/package-*"]);
      includeFilter(packages);
    })
  );

  // Benchmark pattern normalization
  results.push(
    await benchmark("pattern normalization", () => {
      normalizePatterns(["@test/*", "package-1", "package-2"]);
    })
  );

  // Benchmark complex filtering
  results.push(
    await benchmark("package filtering (complex)", () => {
      const ignoreFilter = createIgnoreFilter([
        "@test/package-1",
        "@test/package-2",
        "@test/package-3",
      ]);
      const filtered = ignoreFilter(packages);
      const includeFilter = createIncludeFilter(["@test/package-*"]);
      includeFilter(filtered);
    })
  );

  return results;
}
