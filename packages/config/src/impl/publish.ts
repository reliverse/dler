// packages/config/src/publish.ts

// ============================================================================
// Publish Configuration Types
// ============================================================================

export interface PublishConfig {
  // Global publish configuration
  global?: {
    enable?: boolean;
    dryRun?: boolean;
    tag?: string;
    access?: "public" | "restricted";
    otp?: string;
    authType?: "web" | "legacy";
    concurrency?: number;
    verbose?: boolean;
    bump?:
      | "major"
      | "minor"
      | "patch"
      | "premajor"
      | "preminor"
      | "prepatch"
      | "prerelease";
  };
  // Per-package publish configurations
  packages?: Record<
    string,
    {
      enable?: boolean;
      dryRun?: boolean;
      tag?: string;
      access?: "public" | "restricted";
      otp?: string;
      authType?: "web" | "legacy";
      verbose?: boolean;
      bump?:
        | "major"
        | "minor"
        | "patch"
        | "premajor"
        | "preminor"
        | "prepatch"
        | "prerelease";
    }
  >;
  // Package patterns for applying configs
  patterns?: Array<{
    pattern: string;
    config: {
      enable?: boolean;
      dryRun?: boolean;
      tag?: string;
      access?: "public" | "restricted";
      otp?: string;
      authType?: "web" | "legacy";
      verbose?: boolean;
      bump?:
        | "major"
        | "minor"
        | "patch"
        | "premajor"
        | "preminor"
        | "prepatch"
        | "prerelease";
    };
  }>;
}

export interface DlerConfig {
  publish?: PublishConfig;
}

// ============================================================================
// Package Configuration Resolution
// ============================================================================

/**
 * Get package-specific publish configuration from dler.ts
 */
export const getPackagePublishConfig = (
  packageName: string,
  dlerConfig: DlerConfig | null,
): Partial<Record<string, any>> | undefined => {
  if (!dlerConfig?.publish) {
    return;
  }

  const { publish } = dlerConfig;

  // 1. Check for exact package name match
  if (publish.packages?.[packageName]) {
    const packageConfig = publish.packages[packageName];
    // If enable is explicitly false, return undefined to skip this package
    // enable defaults to true when not specified
    if (packageConfig.enable === false) {
      return;
    }
    return packageConfig;
  }

  // 2. Check for pattern matches
  if (publish.patterns) {
    for (const { pattern, config: patternConfig } of publish.patterns) {
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
        return patternConfig;
      }
    }
  }

  // 3. Return global config if no specific match
  const globalConfig = publish.global;
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
 * Merge CLI options with dler.ts configuration
 */
export const mergePublishOptions = <T extends Record<string, any>>(
  cliOptions: T,
  packageName: string,
  dlerConfig: DlerConfig | null,
): T => {
  const configOptions = getPackagePublishConfig(packageName, dlerConfig) || {};

  // CLI options take precedence over config options
  return {
    ...configOptions,
    ...cliOptions,
  } as T;
};
