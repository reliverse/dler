// packages/config/src/impl/build.ts

import { type BaseConfig, mergeConfig, resolvePackageConfig } from "./core";

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

export interface BuildConfig extends BaseConfig {
  global?: PackageBuildConfig;
  packages?: Record<string, PackageBuildConfig>;
  patterns?: Array<{
    pattern: string;
    config: PackageBuildConfig;
  }>;
}

// ============================================================================
// Package Configuration Resolution
// ============================================================================

/**
 * Get package-specific build configuration from dler.ts
 */
export const getPackageBuildConfig = async (
  packageName: string,
  dlerConfig: { build?: BuildConfig } | null,
): Promise<PackageBuildConfig | undefined> => {
  return resolvePackageConfig<PackageBuildConfig>(
    packageName,
    dlerConfig?.build,
  );
};

// ============================================================================
// Configuration Merging
// ============================================================================

/**
 * Merge build options with package-specific configuration
 */
export const mergeBuildOptions = <T extends Record<string, any>>(
  cliOptions: T,
  packageConfig?: PackageBuildConfig,
): T => {
  return mergeConfig(cliOptions, packageConfig);
};
