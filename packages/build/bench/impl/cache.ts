import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BuildCache } from "../../src/impl/cache";
import type { BuildOptions, PackageInfo } from "../../src/impl/types";
import type { BenchmarkResult } from "../perf";

// Create test package info
const createTestPackageInfo = (): PackageInfo => {
  const testDir = join(tmpdir(), "build-bench-cache");
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  return {
    name: "@test/package",
    path: testDir,
    hasTsConfig: true,
    entryPoints: [join(testDir, "src", "index.ts")],
    outputDir: join(testDir, "dist"),
    buildConfig: null,
    isFrontendApp: false,
    hasHtmlEntry: false,
    hasPublicDir: false,
    private: false,
    isCLI: false,
    hasGoFiles: false,
  };
};

// Create test entry point file
const setupTestFiles = (pkg: PackageInfo): void => {
  const srcDir = join(pkg.path, "src");
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }
  writeFileSync(join(srcDir, "index.ts"), "export const main = () => {};");
};

const testOptions: BuildOptions = {
  target: "node",
  format: "esm",
  minify: false,
  sourcemap: "none",
};

export async function benchmarkCache(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const cacheDir = join(tmpdir(), "build-bench-cache-dir");
  const cache = new BuildCache({ directory: cacheDir });

  // Clean up before benchmarks
  if (existsSync(cacheDir)) {
    try {
      cache.clear();
    } catch {
      // Ignore cleanup errors
    }
  }

  const pkg = createTestPackageInfo();
  setupTestFiles(pkg);

  // Benchmark cache operations (get/set cycle)
  results.push(
    await benchmark("cache operations (set + get)", async () => {
      await cache.set(pkg, testOptions, {
        buildTime: 100,
        bundleSize: 1024,
        outputFiles: [join(pkg.outputDir, "index.js")],
      });
      await cache.get(pkg, testOptions);
    })
  );

  // Benchmark cache set
  results.push(
    await benchmark("cache set", async () => {
      await cache.set(pkg, testOptions, {
        buildTime: 100,
        bundleSize: 1024,
        outputFiles: [join(pkg.outputDir, "index.js")],
      });
    })
  );

  // Benchmark cache get (miss)
  results.push(
    await benchmark("cache get (miss)", async () => {
      // Use a different package to ensure miss
      const differentPkg = {
        ...pkg,
        name: "@test/different",
      };
      await cache.get(differentPkg, testOptions);
    })
  );

  // Benchmark cache get (hit)
  results.push(
    await benchmark("cache get (hit)", async () => {
      await cache.get(pkg, testOptions);
    })
  );

  // Cleanup
  try {
    cache.clear();
  } catch {
    // Ignore cleanup errors
  }

  return results;
}
