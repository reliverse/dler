// Example configuration for relico benchmarks
// Copy this file to config.ts and modify as needed

import type { BenchmarkConfig } from "./config";

// Custom configuration example
export const customConfig: BenchmarkConfig = {
  sourceDirs: {
    src: "../../src", // Source TypeScript files
    distNpmBin: "../../dist-npm/bin", // Binary distribution files
  },

  // Choose which directories to test
  enabledDirs: ["src", "distNpmBin"], // Only test src and dist-npm/bin

  performance: {
    iterations: 50_000, // Reduce iterations for faster testing
    warmupRuns: 500, // Reduce warmup runs
  },

  bundleAnalysis: {
    includeSourceMaps: false, // Skip source map analysis
    analyzeDependencies: true, // Include dependency analysis
  },
};

// Example: Test only source files
export const sourceOnlyConfig: BenchmarkConfig = {
  ...customConfig,
  enabledDirs: ["src"],
};

// Example: Test only built files
export const builtOnlyConfig: BenchmarkConfig = {
  ...customConfig,
  enabledDirs: ["distNpmBin"],
};

// Example: High-performance testing
export const highPerfConfig: BenchmarkConfig = {
  ...customConfig,
  performance: {
    iterations: 1_000_000, // 1M iterations for accurate results
    warmupRuns: 10_000, // 10K warmup runs
  },
};

// Example: Quick testing
export const quickConfig: BenchmarkConfig = {
  ...customConfig,
  performance: {
    iterations: 10_000, // 10K iterations for quick results
    warmupRuns: 100, // Minimal warmup
  },
};
