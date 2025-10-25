// packages/config/src/mod.ts

import { inc, parse, type ReleaseType, valid } from "semver";

// Re-export build types and functions
export type {
  AssetOptions,
  BuildConfig,
  HtmlOptions,
  PackageBuildConfig,
  PerformanceBudget,
} from "./impl/build";
export {
  getPackageBuildConfig,
  mergeBuildOptions,
} from "./impl/build";
// Re-export core utilities
export { type BaseConfig, type DlerConfig, defineConfig } from "./impl/core";
// Re-export all configuration utilities
export * from "./impl/discovery";
// Re-export publish types and functions
export type {
  PackageKind,
  PackagePublishConfig,
  PublishConfig,
  RegistryType,
} from "./impl/publish";
export {
  getPackagePublishConfig,
  mergePublishOptions,
} from "./impl/publish";

// ============================================================================
// Version Management (existing functionality)
// ============================================================================

export type BumpType = ReleaseType | "prerelease";

export interface VersionInfo {
  current: string;
  bumped: string;
  type: BumpType;
}

/**
 * Parse and validate a semver version string
 */
export function parseVersion(version: string): string | null {
  if (!valid(version)) {
    return null;
  }
  return version;
}

/**
 * Bump a version string according to the specified type
 */
export function bumpVersion(
  currentVersion: string,
  type: BumpType,
): VersionInfo | null {
  const parsed = parse(currentVersion);
  if (!parsed) {
    return null;
  }

  const bumped = inc(parsed, type);
  if (!bumped) {
    return null;
  }

  return {
    current: currentVersion,
    bumped,
    type,
  };
}

/**
 * Get the next version for a given type without bumping
 */
export function getNextVersion(
  currentVersion: string,
  type: BumpType,
): string | null {
  const parsed = parse(currentVersion);
  if (!parsed) {
    return null;
  }

  return inc(parsed, type) || null;
}

/**
 * Check if a version is a prerelease
 */
export function isPrerelease(version: string): boolean {
  const parsed = parse(version);
  return parsed ? parsed.prerelease.length > 0 : false;
}

/**
 * Get the release type of a version (major, minor, patch)
 */
export function getReleaseType(
  version: string,
): "major" | "minor" | "patch" | null {
  const parsed = parse(version);
  if (!parsed) {
    return null;
  }

  if (parsed.major > 0) return "major";
  if (parsed.minor > 0) return "minor";
  return "patch";
}
