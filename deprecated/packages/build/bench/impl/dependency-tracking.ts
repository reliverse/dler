import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DependencyTracker } from "../../src/impl/dependency-tracker";
import type { BenchmarkResult } from "../perf";

// Create test file structure
const createTestFiles = (baseDir: string): string[] => {
  const srcDir = join(baseDir, "src");
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }

  const utilsDir = join(srcDir, "utils");
  if (!existsSync(utilsDir)) {
    mkdirSync(utilsDir, { recursive: true });
  }

  // Create entry point
  writeFileSync(
    join(srcDir, "index.ts"),
    `import { util1 } from "./utils/util1";
import { util2 } from "./utils/util2";
export const main = () => {};`,
  );

  // Create utility files
  writeFileSync(
    join(utilsDir, "util1.ts"),
    `import { helper } from "./helper";
export const util1 = () => helper();`,
  );

  writeFileSync(join(utilsDir, "util2.ts"), `export const util2 = () => {};`);

  writeFileSync(join(utilsDir, "helper.ts"), `export const helper = () => {};`);

  return [join(srcDir, "index.ts")];
};

export async function benchmarkDependencyTracking(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const testDir = join(tmpdir(), "build-bench-deps");
  const entryPoints = createTestFiles(testDir);

  // Benchmark dependency tracking
  results.push(
    await benchmark("dependency tracking", async () => {
      const tracker = new DependencyTracker();
      await tracker.trackDependencies(entryPoints);
    }),
  );

  // Benchmark with cached graph
  results.push(
    await benchmark("dependency tracking (cached)", async () => {
      const tracker = new DependencyTracker();
      // First call
      await tracker.trackDependencies(entryPoints);
      // Second call with same entry points
      await tracker.trackDependencies(entryPoints);
    }),
  );

  // Benchmark file hash retrieval
  results.push(
    await benchmark("file hash retrieval", async () => {
      const tracker = new DependencyTracker();
      await tracker.trackDependencies(entryPoints);
      tracker.getFileHash(entryPoints[0]);
    }),
  );

  // Benchmark dependency graph retrieval
  results.push(
    await benchmark("dependency graph retrieval", async () => {
      const tracker = new DependencyTracker();
      await tracker.trackDependencies(entryPoints);
      tracker.getGraph();
    }),
  );

  return results;
}
