// packages/config/src/impl/publish.ts

import { type BaseConfig, mergeConfig, resolvePackageConfig } from "./core";
import type { BumpType } from "./types";

export type RegistryType = "npm" | "jsr" | "vercel" | "npm-jsr" | "none";
export type PackageKind = "library" | "browser-app" | "native-app" | "cli";

// ============================================================================
// Publish Configuration Types
// ============================================================================

export interface PackagePublishConfig {
  enable?: boolean;
  dryRun?: boolean;
  tag?: string;
  access?: "public" | "restricted";
  otp?: string;
  authType?: "web" | "legacy";
  concurrency?: number;
  verbose?: boolean;
  bump?: BumpType;
  bumpDisable?: boolean;
  registry?: RegistryType;
  kind?: PackageKind;
  bin?: string;
}

export interface PublishConfig extends BaseConfig {
  // Global publish configuration
  global?: PackagePublishConfig;
  // Per-package publish configurations
  packages?: Record<string, PackagePublishConfig>;
  // Package patterns for applying configs
  patterns?: Array<{
    pattern: string;
    config: PackagePublishConfig;
  }>;
}

// ============================================================================
// Package Configuration Resolution
// ============================================================================

/**
 * Get package-specific publish configuration from dler.ts
 */
export const getPackagePublishConfig = (
  packageName: string,
  dlerConfig: { publish?: PublishConfig } | null,
): PackagePublishConfig | undefined => {
  return resolvePackageConfig<PackagePublishConfig>(
    packageName,
    dlerConfig?.publish,
  );
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
  dlerConfig: { publish?: PublishConfig } | null,
): T => {
  const packageConfig = getPackagePublishConfig(packageName, dlerConfig);
  return mergeConfig(cliOptions, packageConfig);
};
