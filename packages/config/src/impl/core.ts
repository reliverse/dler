// packages/config/src/impl/core.ts

import type { PublishConfig } from "./publish";
import type { BuildConfig } from "./build";

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

export interface DlerConfig {
  build?: BuildConfig;
  publish?: PublishConfig;
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
  config: BaseConfig | null | undefined,
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
      // Simple glob pattern matching
      if (
        packageName.includes(pattern.replace(/\*/g, "")) ||
        new RegExp(pattern.replace(/\*/g, ".*")).test(packageName)
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
  configOptions?: Record<string, any>,
): T => {
  if (!configOptions) return cliOptions;

  // CLI options take precedence over config options
  return {
    ...configOptions,
    ...cliOptions,
  } as T;
};

