import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BenchmarkResult } from "../perf";

// Create a test package structure
const createTestPackage = (baseDir: string): string => {
  const pkgDir = join(baseDir, "test-pkg");
  if (!existsSync(pkgDir)) {
    mkdirSync(pkgDir, { recursive: true });
  }

  const srcDir = join(pkgDir, "src");
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }

  const packageJson = {
    name: "@test/package",
    version: "1.0.0",
    type: "module",
    exports: {
      ".": "./src/mod.ts",
    },
  };

  writeFileSync(join(pkgDir, "package.json"), JSON.stringify(packageJson, null, 2));

  const tsconfig = {
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src",
    },
  };

  writeFileSync(join(pkgDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  writeFileSync(join(srcDir, "index.ts"), "export const main = () => {};");

  return pkgDir;
};

interface PackageInfo {
  name: string;
  path: string;
  hasTsConfig: boolean;
  outputDir: string;
  private: boolean;
}

// Simulate package info resolution
const resolvePackageInfo = async (packagePath: string): Promise<PackageInfo | null> => {
  const { readPackageJSON, readTSConfig } = await import("@reliverse/typerso");
  const { resolve } = await import("node:path");
  const { existsSync } = await import("node:fs");

  const pkg = await readPackageJSON(packagePath);
  if (!pkg?.name) {
    return null;
  }

  const hasTsConfig = existsSync(join(packagePath, "tsconfig.json"));
  const tsconfig = hasTsConfig ? await readTSConfig(packagePath) : null;
  const outputDir = tsconfig?.compilerOptions?.outDir
    ? resolve(packagePath, tsconfig.compilerOptions.outDir)
    : resolve(packagePath, "dist");

  return {
    name: pkg.name,
    path: packagePath,
    hasTsConfig,
    outputDir,
    private: pkg.private === true,
  };
};

export async function benchmarkPackageInfoResolution(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const testDir = join(tmpdir(), "build-bench");
  const pkgDir = createTestPackage(testDir);

  // Benchmark package info resolution
  results.push(
    await benchmark("package info resolution", async () => {
      await resolvePackageInfo(pkgDir);
    }),
  );

  // Benchmark with cached package.json reads
  results.push(
    await benchmark("package info resolution (cached)", async () => {
      // First call to warm cache
      await resolvePackageInfo(pkgDir);
      // Second call should use cache
      await resolvePackageInfo(pkgDir);
    }),
  );

  return results;
}
