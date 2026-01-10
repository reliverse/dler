// packages/config/src/impl/core.ts

import type { LoadedConfig } from "./config-loader";

// ============================================================================
// Generic Configuration Types
// ============================================================================

export interface BaseConfig {
  global?: Record<string, any>;
  packages?: Record<string, Record<string, any>>;
  patterns?: Array<{
    pattern: string;
    config: Record<string, any>;
  }>;
}

// ============================================================================
// Generic Configuration Resolution
// ============================================================================

/**
 * Generic function to resolve package-specific configuration using pattern matching
 * Priority: packages (exact match) → patterns (glob match) → global
 */
export const resolvePackageConfig = <T extends Record<string, any>>(
  packageName: string,
  config: BaseConfig | null | undefined
): T | undefined => {
  if (!config) {
    return;
  }

  // 1. Check for exact package name match
  if (config.packages?.[packageName]) {
    const packageConfig = config.packages[packageName];
    // If enable is explicitly false, return undefined to skip this package
    // enable defaults to true when not specified
    if (packageConfig.enable === false) {
      return;
    }
    return packageConfig as T;
  }

  // 2. Check for pattern matches
  if (config.patterns) {
    for (const { pattern, config: patternConfig } of config.patterns) {
      // Optimized glob pattern matching: cache the pattern replacement
      // to avoid doing it twice (once for includes, once for regex)
      const regexPattern = pattern.replace(/\*/g, ".*");
      const patternWithoutWildcards = pattern.replace(/\*/g, "");

      // Try simple includes check first (faster for simple patterns)
      // Then verify with regex for accuracy
      if (
        (patternWithoutWildcards && packageName.includes(patternWithoutWildcards)) ||
        new RegExp(regexPattern).test(packageName)
      ) {
        // If enable is explicitly false, return undefined to skip this package
        // enable defaults to true when not specified
        if (patternConfig.enable === false) {
          return;
        }
        return patternConfig as T;
      }
    }
  }

  // 3. Return global config if no specific match
  const globalConfig = config.global;
  // If global enable is explicitly false, return undefined to skip this package
  // enable defaults to true when not specified
  if (globalConfig?.enable === false) {
    return;
  }
  return globalConfig as T;
};

// ============================================================================
// Generic Configuration Merging
// ============================================================================

/**
 * Generic function to merge configuration options
 * CLI options take precedence over config options
 */
export const mergeConfig = <T extends Record<string, any>>(
  cliOptions: T,
  configOptions?: Record<string, any>
): T => {
  if (!configOptions) {
    return cliOptions;
  }

  // CLI options take precedence over config options
  return {
    ...configOptions,
    ...cliOptions,
  } as T;
};

// ============================================================================
// Unified Configuration Resolution (works with dler.config.ts)
// ============================================================================

/**
 * Get package-specific build configuration from dler.config.ts
 */
export const getPackageBuildConfigUnified = async (
  packageName: string,
  dlerConfig: LoadedConfig | null
): Promise<Record<string, any> | undefined> => {
  return resolvePackageConfig(packageName, dlerConfig?.build);
};

/**
 * Get package-specific publish configuration from dler.config.ts
 */
export const getPackagePublishConfigUnified = (
  packageName: string,
  dlerConfig: LoadedConfig | null
): Record<string, any> | undefined => {
  return resolvePackageConfig(packageName, dlerConfig?.publish);
};

// ============================================================================
// Unified Configuration Merging (works with dler.config.ts)
// ============================================================================

/**
 * Merge build options with package-specific configuration from dler.config.ts
 */
export const mergeBuildOptionsUnified = <T extends Record<string, any>>(
  cliOptions: T,
  packageName: string,
  dlerConfig: LoadedConfig | null
): T => {
  const packageConfig = getPackageBuildConfigUnified(packageName, dlerConfig);
  return mergeConfig(cliOptions, packageConfig);
};

/**
 * Merge publish options with package-specific configuration from dler.config.ts
 */
export const mergePublishOptionsUnified = <T extends Record<string, any>>(
  cliOptions: T,
  packageName: string,
  dlerConfig: LoadedConfig | null
): T => {
  const packageConfig = getPackagePublishConfigUnified(packageName, dlerConfig);
  return mergeConfig(cliOptions, packageConfig);
};
