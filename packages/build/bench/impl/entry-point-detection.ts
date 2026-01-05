import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BenchmarkResult } from "../perf";

// Create a temporary test package structure
const createTestPackage = (baseDir: string): string => {
  const pkgDir = join(baseDir, "test-pkg");
  if (!existsSync(pkgDir)) {
    mkdirSync(pkgDir, { recursive: true });
  }

  const srcDir = join(pkgDir, "src");
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }

  // Create package.json with exports
  const packageJson = {
    name: "@test/package",
    version: "1.0.0",
    exports: {
      ".": "./src/mod.ts",
      "./utils": "./src/utils.ts",
    },
  };

  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  // Create entry point files
  writeFileSync(join(srcDir, "index.ts"), "export const main = () => {};");
  writeFileSync(join(srcDir, "utils.ts"), "export const util = () => {};");

  return pkgDir;
};

// Simulate entry point detection logic
const detectEntryPoints = async (packagePath: string): Promise<string[]> => {
  const { readPackageJSON } = await import("@reliverse/typerso");
  const pkg = await readPackageJSON(packagePath);
  if (!pkg) return [];

  const entryPoints: string[] = [];

  if (pkg.exports) {
    const extractFromExports = (
      exports: string | Record<string, unknown>,
      basePath = "",
    ): void => {
      if (typeof exports === "string") {
        const fullPath = resolve(packagePath, basePath, exports);
        if (existsSync(fullPath)) {
          entryPoints.push(fullPath);
        }
      } else if (typeof exports === "object" && exports !== null) {
        for (const [key, value] of Object.entries(exports)) {
          if (key === "." || key.startsWith("./")) {
            extractFromExports(value, basePath);
          } else if (
            key === "import" ||
            key === "require" ||
            key === "default"
          ) {
            if (key !== "types") {
              extractFromExports(value, basePath);
            }
          } else if (typeof value === "object" && value !== null) {
            extractFromExports(value, basePath);
          } else if (typeof value === "string") {
            const fullPath = resolve(packagePath, basePath, value);
            if (existsSync(fullPath)) {
              entryPoints.push(fullPath);
            }
          }
        }
      }
    };

    extractFromExports(pkg.exports);
  }

  return [...new Set(entryPoints)];
};

export async function benchmarkEntryPointDetection(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number,
  ) => Promise<BenchmarkResult>,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const testDir = join(tmpdir(), "build-bench");
  const pkgDir = createTestPackage(testDir);

  // Benchmark entry point detection
  results.push(
    await benchmark("entry point detection (exports)", async () => {
      await detectEntryPoints(pkgDir);
    }),
  );

  // Benchmark with complex exports
  const complexPackageJson = {
    name: "@test/complex",
    version: "1.0.0",
    exports: {
      ".": {
        import: "./src/mod.ts",
        require: "./src/index.cjs",
        types: "./src/index.d.ts",
      },
      "./utils": "./src/utils.ts",
      "./components": {
        import: "./src/components/index.ts",
        require: "./src/components/index.cjs",
      },
    },
  };

  const complexPkgDir = join(testDir, "complex-pkg");
  mkdirSync(join(complexPkgDir, "src", "components"), { recursive: true });
  writeFileSync(
    join(complexPkgDir, "package.json"),
    JSON.stringify(complexPackageJson, null, 2),
  );
  writeFileSync(join(complexPkgDir, "src", "index.ts"), "");
  writeFileSync(join(complexPkgDir, "src", "utils.ts"), "");
  writeFileSync(join(complexPkgDir, "src", "components", "index.ts"), "");

  results.push(
    await benchmark("entry point detection (complex exports)", async () => {
      await detectEntryPoints(complexPkgDir);
    }),
  );

  return results;
}
