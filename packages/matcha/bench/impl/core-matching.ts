import { match, matchAll, matchAny } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const testPatterns = [
  "*.ts",
  "*.js",
  "**/*.test.ts",
  "src/**/*.ts",
  "packages/*/src/**",
];

const testPaths = [
  "src/mod.ts",
  "src/utils/helper.ts",
  "test/index.test.ts",
  "packages/foo/src/mod.ts",
  "dist/index.js",
  "node_modules/foo/index.js",
  ".git/config",
  "README.md",
];

export async function benchmarkCoreMatching(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark single pattern matching
  results.push(
    await benchmark("match (single pattern)", () => {
      match("*.ts", "src/mod.ts");
      match("**/*.test.ts", "test/index.test.ts");
      match("src/**/*.ts", "src/utils/helper.ts");
    }),
  );

  // Benchmark matchAny with multiple patterns
  results.push(
    await benchmark("matchAny (multiple patterns)", () => {
      matchAny(testPatterns, "src/mod.ts");
      matchAny(testPatterns, "test/index.test.ts");
      matchAny(testPatterns, "dist/index.js");
    }),
  );

  // Benchmark matchAll with multiple patterns
  results.push(
    await benchmark("matchAll (multiple patterns)", () => {
      matchAll(["*.ts", "src/**"], "src/mod.ts");
      matchAll(["*.js", "dist/**"], "dist/index.js");
    }),
  );

  // Benchmark matching against multiple paths
  results.push(
    await benchmark("match (multiple paths)", () => {
      for (const path of testPaths) {
        match("*.ts", path);
        match("**/*.test.ts", path);
        match("src/**/*.ts", path);
      }
    }),
  );

  // Benchmark complex patterns
  results.push(
    await benchmark("match (complex patterns)", () => {
      match("**/*.{ts,tsx}", "src/components/Button.tsx");
      match("packages/*/src/**/*.ts", "packages/foo/src/mod.ts");
      match("!**/node_modules/**", "src/mod.ts");
    }),
  );

  return results;
}
