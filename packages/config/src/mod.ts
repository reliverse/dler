// packages/config/src/mod.ts

import { inc, parse, valid } from "semver";
import type { BumpType, VersionInfo } from "./impl/types";


// ============================================================================
// Version Management
// ============================================================================


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
