import { resolvePackageConfig } from "../../src/impl/core";
import type { BenchmarkResult } from "../perf";

const testConfigs = [
  {
    global: { enable: true, option1: "global" },
    packages: {
      "@reliverse/test": { option1: "package" },
    },
  },
  {
    global: { enable: true },
    patterns: [
      {
        pattern: "@reliverse/*",
        config: { option1: "pattern" },
      },
    ],
  },
  {
    global: { enable: false },
    packages: {
      "@reliverse/test": { enable: true, option1: "package" },
    },
  },
  {
    packages: {
      "@reliverse/exact": { option1: "exact" },
    },
    patterns: [
      {
        pattern: "@reliverse/*",
        config: { option1: "pattern" },
      },
    ],
  },
];

const testPackageNames = [
  "@reliverse/test",
  "@reliverse/build",
  "@reliverse/config",
  "@reliverse/other",
  "unknown-package",
];

export async function benchmarkConfigResolution(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark exact package match
  results.push(
    await benchmark("resolvePackageConfig (exact match)", () => {
      const config = testConfigs[0];
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, config);
      }
    }),
  );

  // Benchmark pattern matching
  results.push(
    await benchmark("resolvePackageConfig (pattern match)", () => {
      const config = testConfigs[1];
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, config);
      }
    }),
  );

  // Benchmark enable flag handling
  results.push(
    await benchmark("resolvePackageConfig (enable flag)", () => {
      const config = testConfigs[2];
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, config);
      }
    }),
  );

  // Benchmark priority (exact > pattern > global)
  results.push(
    await benchmark("resolvePackageConfig (priority)", () => {
      const config = testConfigs[3];
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, config);
      }
    }),
  );

  // Benchmark null/undefined config
  results.push(
    await benchmark("resolvePackageConfig (null config)", () => {
      for (const pkgName of testPackageNames) {
        resolvePackageConfig(pkgName, null);
      }
    }),
  );

  return results;
}
