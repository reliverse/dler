import { resolvePackageConfig } from "../../src/impl/core";
import type { BenchmarkResult } from "../perf";

const patterns = [
  "@reliverse/*",
  "@reliverse/build*",
  "@reliverse/*-kit",
  "packages/*",
  "*config*",
];

const testPackageNames = [
  "@reliverse/test",
  "@reliverse/build",
  "@reliverse/pathkit",
  "@reliverse/config",
  "packages/test",
  "unknown-package",
];

const configWithPatterns = {
  global: { option1: "global" },
  patterns: patterns.map((pattern) => ({
    pattern,
    config: { option1: `pattern-${pattern}` },
  })),
};

const configWithManyPatterns = {
  global: { option1: "global" },
  patterns: Array.from({ length: 20 }, (_, i) => ({
    pattern: `pattern-${i}/*`,
    config: { option1: `value-${i}` },
  })),
};

export async function benchmarkPatternMatching(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark pattern matching with includes check
  results.push(
    await benchmark("resolvePackageConfig (pattern includes)", () => {
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, configWithPatterns);
      }
    }),
  );

  // Benchmark pattern matching with regex
  results.push(
    await benchmark("resolvePackageConfig (pattern regex)", () => {
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, configWithPatterns);
      }
    }),
  );

  // Benchmark many patterns
  results.push(
    await benchmark("resolvePackageConfig (many patterns)", () => {
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, configWithManyPatterns);
      }
    }),
  );

  // Benchmark no match
  results.push(
    await benchmark("resolvePackageConfig (no pattern match)", () => {
      const noMatchConfig = {
        global: { option1: "global" },
        patterns: [
          {
            pattern: "other/*",
            config: { option1: "other" },
          },
        ],
      };
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, noMatchConfig);
      }
    }),
  );

  return results;
}
