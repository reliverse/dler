import { compile, compileAny } from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const patterns = [
  "*.ts",
  "*.js",
  "**/*.test.ts",
  "src/**/*.ts",
  "packages/*/src/**",
];

const testInputs = [
  "src/index.ts",
  "test/index.test.ts",
  "dist/index.js",
  "packages/foo/src/mod.ts",
];

export async function benchmarkPatternCompilation(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark compiling a single pattern
  results.push(
    await benchmark("compile (single pattern)", () => {
      const regex = compile("*.ts");
      regex.test("src/index.ts");
      regex.test("test/index.test.ts");
    }),
  );

  // Benchmark compiling multiple patterns
  results.push(
    await benchmark("compileAny (multiple patterns)", () => {
      const regex = compileAny(patterns);
      for (const input of testInputs) {
        regex.test(input);
      }
    }),
  );

  // Benchmark compiling complex patterns
  results.push(
    await benchmark("compile (complex patterns)", () => {
      compile("**/*.{ts,tsx}");
      compile("packages/*/src/**/*.ts");
      compile("!**/node_modules/**");
    }),
  );

  // Benchmark reusing compiled regex
  results.push(
    await benchmark("compile (reuse compiled)", () => {
      const regex = compile("**/*.ts");
      for (const input of testInputs) {
        regex.test(input);
      }
    }),
  );

  return results;
}
