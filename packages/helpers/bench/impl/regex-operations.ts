import type { BenchmarkResult } from "../perf";

// Mock data for regex operations
const createMockFileContent = (lines: number, withLogger = false): string => {
  const content: string[] = [];
  for (let i = 0; i < lines; i++) {
    if (withLogger && i % 10 === 0) {
      content.push(`logger.internal("test ${i}");`);
    } else {
      content.push(`const line${i} = "value${i}";`);
    }
  }
  return content.join("\n");
};

const createMockPackageJson = (): string => {
  return JSON.stringify(
    {
      name: "@test/package",
      version: "1.0.0",
      exports: {
        ".": {
          types: "./src/mod.ts",
          default: "./src/mod.ts",
        },
      },
    },
    null,
    2
  );
};

// Simulate matchesPattern function
function matchesPattern(str: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    return regex.test(str);
  }
  return str === pattern;
}

// Simulate clearLoggerInternalsInFile logic
function clearLoggerInternalsInFile(content: string): string {
  const lines = content.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    if (/logger\.internal\s*\(/.test(line) || /logInternal\s*\(/.test(line)) {
      continue;
    }
    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}

// Simulate replaceInPackageJson logic (ts-to-js direction)
function replaceInPackageJson(content: string): string {
  let updated = content;
  let _hasChanges = false;

  const defaultPattern = /"default":\s*"\.\/src\/([^"]+)\.ts"/g;
  if (defaultPattern.test(content)) {
    defaultPattern.lastIndex = 0;
    updated = updated.replace(defaultPattern, '"default": "./dist/$1.js"');
    _hasChanges = true;
  }

  const typesPattern = /"types":\s*"\.\/src\/([^"]+)\.ts"/g;
  if (typesPattern.test(content)) {
    typesPattern.lastIndex = 0;
    updated = updated.replace(typesPattern, '"types": "./dist/$1.d.ts"');
    _hasChanges = true;
  }

  return updated;
}

export async function benchmarkRegexOperations(
  benchmark: (
    name: string,
    fn: () => void | Promise<void>,
    iterCount?: number
  ) => Promise<BenchmarkResult>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Benchmark pattern matching
  results.push(
    await benchmark("pattern matching (exact)", () => {
      matchesPattern("@test/package", "@test/package");
      matchesPattern("@other/package", "@test/package");
    })
  );

  results.push(
    await benchmark("pattern matching (wildcard)", () => {
      matchesPattern("@test/package", "@test/*");
      matchesPattern("@test/subpackage", "@test/*");
      matchesPattern("@other/package", "@test/*");
    })
  );

  // Benchmark logger internals clearing
  const fileWithLogger = createMockFileContent(100, true);
  results.push(
    await benchmark("clear logger internals (100 lines)", () => {
      clearLoggerInternalsInFile(fileWithLogger);
    })
  );

  const largeFileWithLogger = createMockFileContent(1000, true);
  results.push(
    await benchmark("clear logger internals (1000 lines)", () => {
      clearLoggerInternalsInFile(largeFileWithLogger);
    })
  );

  // Benchmark package.json replacement
  const packageJson = createMockPackageJson();
  results.push(
    await benchmark("replace exports in package.json", () => {
      replaceInPackageJson(packageJson);
    })
  );

  // Benchmark multiple regex operations (simulating file processing)
  results.push(
    await benchmark("regex operations (combined)", () => {
      const content = createMockFileContent(50, true);
      clearLoggerInternalsInFile(content);
      replaceInPackageJson(packageJson);
      matchesPattern("@test/package-1", "@test/*");
      matchesPattern("@test/package-2", "@test/package-*");
    })
  );

  return results;
}
