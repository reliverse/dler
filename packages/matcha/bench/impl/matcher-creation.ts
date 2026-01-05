import { createMatcher, createMatchers } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const patterns = [
  "*.ts",
  "*.js",
  "**/*.test.ts",
  "src/**/*.ts",
  "packages/*/src/**",
  "dist/**/*.js",
  "**/*.{ts,tsx}",
];

const testInputs = [
  "src/mod.ts",
  "test/index.test.ts",
  "dist/index.js",
  "packages/foo/src/mod.ts",
];

export async function benchmarkMatcherCreation(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark creating a single matcher
  results.push(
    await benchmark("createMatcher (single)", () => {
      const matcher = createMatcher("*.ts");
      matcher("src/mod.ts");
      matcher("test/index.test.ts");
    }),
  );

  // Benchmark creating multiple matchers
  results.push(
    await benchmark("createMatchers (multiple)", () => {
      const matchers = createMatchers(patterns);
      for (const input of testInputs) {
        for (const matcher of matchers) {
          matcher(input);
        }
      }
    }),
  );

  // Benchmark reusing matchers (should be fast)
  results.push(
    await benchmark("createMatcher (reuse)", () => {
      const matcher = createMatcher("**/*.ts");
      for (const input of testInputs) {
        matcher(input);
      }
    }),
  );

  // Benchmark creating matchers with options
  results.push(
    await benchmark("createMatcher (with options)", () => {
      const matcher = createMatcher("*.ts", { partial: true });
      matcher("src/mod.ts");
      matcher("test/index.test.ts");
    }),
  );

  return results;
}
