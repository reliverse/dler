import {
  createIgnoreFilter,
  createIncludeFilter,
  exclude,
  filter,
  normalizePatterns,
} from "../../src/mod";
import type { BenchmarkResult } from "../perf";

const createTestItems = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `file-${i}.ts`,
    path: `src/file-${i}.ts`,
  }));
};

const testPaths = [
  "src/mod.ts",
  "src/utils/helper.ts",
  "test/index.test.ts",
  "dist/index.js",
  "node_modules/foo/index.js",
  ".git/config",
  "README.md",
  "src/components/Button.tsx",
  "packages/foo/src/mod.ts",
];

const ignorePatterns = ["node_modules/**", "dist/**", "*.test.ts"];

const includePatterns = ["src/**/*.ts", "**/*.tsx"];

export async function benchmarkFiltering(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const items = createTestItems(100);

  // Benchmark filter function
  results.push(
    await benchmark("filter (include patterns)", () => {
      filter(includePatterns, testPaths);
    }),
  );

  // Benchmark exclude function
  results.push(
    await benchmark("exclude (ignore patterns)", () => {
      exclude(ignorePatterns, testPaths);
    }),
  );

  // Benchmark createIgnoreFilter
  results.push(
    await benchmark("createIgnoreFilter", () => {
      const ignoreFilter = createIgnoreFilter(ignorePatterns);
      ignoreFilter(items);
    }),
  );

  // Benchmark createIncludeFilter
  results.push(
    await benchmark("createIncludeFilter", () => {
      const includeFilter = createIncludeFilter(includePatterns);
      includeFilter(items);
    }),
  );

  // Benchmark normalizePatterns
  results.push(
    await benchmark("normalizePatterns (string)", () => {
      normalizePatterns("*.ts *.js **/*.test.ts");
    }),
  );

  results.push(
    await benchmark("normalizePatterns (array)", () => {
      normalizePatterns(["*.ts", "*.js", "**/*.test.ts"]);
    }),
  );

  // Benchmark complex filtering chain
  results.push(
    await benchmark("filtering (complex chain)", () => {
      const filtered = filter(includePatterns, testPaths);
      const excluded = exclude(ignorePatterns, filtered);
      exclude(["*.js"], excluded);
    }),
  );

  return results;
}
