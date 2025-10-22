// Benchmark configuration for relico
export interface BenchmarkConfig {
  // Source directories to test
  sourceDirs: {
    src?: string;
    distNpmBin: string;
  };

  // Which directories to include in testing
  enabledDirs: ("src" | "distNpmBin")[];

  // Performance test settings
  performance: {
    iterations: number;
    warmupRuns: number;
  };

  // Bundle analysis settings
  bundleAnalysis: {
    includeSourceMaps: boolean;
    analyzeDependencies: boolean;
  };
}

// Default configuration
export const defaultConfig: BenchmarkConfig = {
  sourceDirs: {
    src: "../../src",
    distNpmBin: "../../dist-npm/bin", // Binary distribution (where .js and .d.ts files are)
  },

  // Test source directory by default since we don't have a built version
  enabledDirs: ["src"],

  performance: {
    iterations: 100_000,
    warmupRuns: 1000,
  },

  bundleAnalysis: {
    includeSourceMaps: false,
    analyzeDependencies: true,
  },
};

// Helper function to get import path for a specific directory
export function getImportPath(
  dir: keyof BenchmarkConfig["sourceDirs"],
  module = "mod",
): string {
  const config = defaultConfig;
  const basePath = config.sourceDirs[dir];

  switch (dir) {
    case "src":
      return `${basePath}/${module}.ts`;
    case "distNpmBin":
      return `${basePath}/${module}.js`;
    default:
      return `${basePath}/${module}.ts`;
  }
}

// Helper function to get file paths for analysis (both .js and .d.ts files)
export function getFilePaths(
  dir: keyof BenchmarkConfig["sourceDirs"],
  module = "mod",
): { js?: string; dts?: string } {
  const config = defaultConfig;
  const basePath = config.sourceDirs[dir];

  switch (dir) {
    case "src":
      return { js: `${basePath}/${module}.ts` };
    case "distNpmBin":
      return {
        js: `${basePath}/${module}.js`,
        dts: `${basePath}/${module}.d.ts`,
      };
    default:
      return { js: `${basePath}/${module}.ts` };
  }
}

// Helper to check if directory is enabled
export function isDirEnabled(
  dir: keyof BenchmarkConfig["sourceDirs"],
): boolean {
  return defaultConfig.enabledDirs.includes(dir);
}

// Helper to get all enabled directories
export function getEnabledDirs(): (keyof BenchmarkConfig["sourceDirs"])[] {
  return defaultConfig.enabledDirs;
}

// Export the config for easy access
export const config = defaultConfig;
