import { resolve } from "node:path";
import {
  findMonorepoRoot,
  loadDlerConfig,
} from "@reliverse/config/impl/discovery";
import { getWorkspacePatterns, readPackageJSON } from "@reliverse/typerso";
import type { BenchmarkResult } from "../perf";

// Use a test directory that exists in the workspace
const TEST_CWD = resolve(import.meta.dir, "../../../..");

// Simulate package discovery without running builds
const discoverPackages = async (cwd?: string): Promise<number> => {
  const monorepoRoot = await findMonorepoRoot(cwd);
  if (!monorepoRoot) {
    return 0;
  }

  const rootPkg = await readPackageJSON(monorepoRoot);
  if (!rootPkg) {
    return 0;
  }

  const patterns = getWorkspacePatterns(rootPkg);
  if (!patterns.length) {
    return 0;
  }

  // Load dler configuration (this is part of discovery)
  await loadDlerConfig(monorepoRoot);

  // Count packages by pattern matching (simplified - just count patterns)
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // Pattern with wildcards - use glob
      const glob = new Bun.Glob(pattern);
      const matches = Array.from(
        glob.scanSync({ cwd: monorepoRoot, onlyFiles: false }),
      );
      count += matches.length;
    } else {
      // Direct package path
      count += 1;
    }
  }

  return count;
};

export async function benchmarkPackageDiscovery(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark package discovery (just discovery, no builds)
  results.push(
    await benchmark("package discovery (monorepo root)", async () => {
      await findMonorepoRoot(TEST_CWD);
    }),
  );

  // Benchmark workspace pattern extraction
  results.push(
    await benchmark("workspace pattern extraction", async () => {
      const monorepoRoot = await findMonorepoRoot(TEST_CWD);
      if (monorepoRoot) {
        const rootPkg = await readPackageJSON(monorepoRoot);
        if (rootPkg) {
          getWorkspacePatterns(rootPkg);
        }
      }
    }),
  );

  // Benchmark dler config loading
  results.push(
    await benchmark("dler config loading", async () => {
      const monorepoRoot = await findMonorepoRoot(TEST_CWD);
      if (monorepoRoot) {
        await loadDlerConfig(monorepoRoot);
      }
    }),
  );

  // Benchmark full discovery (without builds)
  results.push(
    await benchmark("package discovery (full)", async () => {
      await discoverPackages(TEST_CWD);
    }),
  );

  return results;
}
