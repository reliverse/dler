// packages/config/src/build.ts

// ============================================================================
// Build Configuration Types
// ============================================================================

export interface AssetOptions {
  publicPath?: string;
  copyFiles?: string[];
  imageOptimization?: boolean;
}

export interface PerformanceBudget {
  maxBundleSize?: number;
  maxChunkSize?: number;
  maxAssetSize?: number;
  maxInitialChunkSize?: number;
  maxAsyncChunkSize?: number;
}

export interface HtmlOptions {
  entryPoints?: string[];
  inject?: boolean;
  minify?: boolean;
}

export interface PackageBuildConfig {
  enable?: boolean;
  target?: "browser" | "bun" | "node";
  format?: "esm" | "cjs" | "iife";
  minify?:
    | boolean
    | {
        whitespace?: boolean;
        syntax?: boolean;
        identifiers?: boolean;
      };
  sourcemap?: string | boolean;
  splitting?: boolean;
  external?: string | string[];
  bytecode?: boolean;
  drop?: string | string[];
  packages?: string;
  publicPath?: string;
  root?: string;
  define?: Record<string, string>;
  naming?: {
    chunk?: string;
    entry?: string;
    asset?: string;
  };
  env?: string | Record<string, string>;
  banner?: string | Record<string, string>;
  footer?: string | Record<string, string>;
  conditions?: string | string[];
  loader?: Record<string, string>;
  ignoreDCEAnnotations?: boolean;
  emitDCEAnnotations?: boolean;
  throw?: boolean;
  jsx?:
    | string
    | {
        factory?: string;
        fragment?: string;
        importSource?: string;
        pragma?: string;
        pragmaFrag?: string;
        runtime?: "automatic" | "classic";
        development?: boolean;
      };
  keepNames?: boolean;
  // Frontend-specific options
  html?: boolean | HtmlOptions;
  assets?: AssetOptions;
  cssChunking?: boolean;
  // Enhanced features
  macros?: boolean;
  sideEffects?: boolean | string[];
  bundleAnalyzer?: boolean;
  typeCheck?: boolean;
  generateTypes?: boolean;
  performanceBudget?: PerformanceBudget;
  imageOptimization?: boolean;
  fontOptimization?: boolean;
  cssOptimization?: boolean;
  svgAsReact?: boolean;
  cssModules?: boolean;
  workerSupport?: boolean;
  // Compilation options
  compile?: boolean;
  // Windows executable options
  windowsHideConsole?: boolean;
  windowsIcon?: string;
  windowsTitle?: string;
  windowsPublisher?: string;
  windowsVersion?: string;
  windowsDescription?: string;
  windowsCopyright?: string;
}

export interface BuildConfig {
  global?: PackageBuildConfig;
  packages?: Record<string, PackageBuildConfig>;
  patterns?: Array<{
    pattern: string;
    config: PackageBuildConfig;
  }>;
}

export interface DlerConfig {
  build?: {
    // Global build configuration
    global?: PackageBuildConfig;
    // Per-package build configurations
    packages?: Record<string, PackageBuildConfig>;
    // Package patterns for applying configs
    patterns?: Array<{
      pattern: string;
      config: PackageBuildConfig;
    }>;
  };
  publish?: any; // Will be defined in publish.ts
}

// ============================================================================
// Package Configuration Resolution
// ============================================================================

/**
 * Get package-specific build configuration from dler.ts
 */
export const getPackageBuildConfig = async (
  packageName: string,
  dlerConfig: DlerConfig | null,
): Promise<PackageBuildConfig | undefined> => {
  // Check dler.ts configuration
  if (!dlerConfig?.build) {
    return;
  }

  const { build } = dlerConfig;

  // 1. Check for exact package name match
  if (build.packages?.[packageName]) {
    const packageConfig = build.packages[packageName];
    // If enable is explicitly false, return undefined to skip this package
    // enable defaults to true when not specified
    if (packageConfig.enable === false) {
      return;
    }
    return packageConfig;
  }

  // 2. Check for pattern matches
  if (build.patterns) {
    for (const { pattern, config: patternConfig } of build.patterns) {
      // Simple glob pattern matching (can be enhanced with minimatch later)
      if (
        packageName.includes(pattern.replace(/\*/g, "")) ||
        new RegExp(pattern.replace(/\*/g, ".*")).test(packageName)
      ) {
        // If enable is explicitly false, return undefined to skip this package
        // enable defaults to true when not specified
        if (patternConfig.enable === false) {
          return;
        }
        return patternConfig;
      }
    }
  }

  // 3. Return global config if no specific match
  const globalConfig = build.global;
  // If global enable is explicitly false, return undefined to skip this package
  // enable defaults to true when not specified
  if (globalConfig?.enable === false) {
    return;
  }
  return globalConfig;
};

// ============================================================================
// Configuration Merging
// ============================================================================

/**
 * Merge build options with package-specific configuration
 */
export const mergeBuildOptions = <T extends Record<string, any>>(
  globalOptions: T,
  packageConfig?: PackageBuildConfig,
): T => {
  if (!packageConfig) return globalOptions;

  const merged = { ...globalOptions };

  // Merge package-specific options
  for (const [key, value] of Object.entries(packageConfig)) {
    if (value !== undefined) {
      (merged as any)[key] = value;
    }
  }

  return merged as T;
};
