// packages/publish/src/impl/release.ts

import type { LoadedConfig } from "@reliverse/config";
import { logger } from "@reliverse/relinka";
import { $ } from "bun";

// ============================================================================
// Types
// ============================================================================

export interface ReleaseOptions {
  version?: string | "patch" | "minor" | "major";
  tag?: string;
  npm?: boolean;
  github?: boolean;
  dryRun?: boolean;
  test?: boolean;
  build?: boolean;
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Check if git repository is clean
 */
export async function checkGitClean(dryRun: boolean): Promise<void> {
  try {
    const status = await $`git status --porcelain`.text();
    if (status.trim() && !dryRun) {
      logger.error("Working directory is not clean. Please commit or stash changes first.");
      process.exit(1);
    }
  } catch {
    logger.error("Not a git repository");
    process.exit(1);
  }
}

/**
 * Create git tag and push
 */
export async function createGitTag(
  version: string,
  config: LoadedConfig | null,
  tagFormat?: string
): Promise<void> {
  const format = tagFormat || config?.release?.tagFormat || "v${version}";
  const tag = format.replace("${version}", version);

  await $`git add package.json`;
  await $`git commit -m "chore: release v${version}"`;
  await $`git tag ${tag}`;
  await $`git push origin main --tags`.nothrow();
}

/**
 * Get GitHub repository name from git remote
 */
export async function getGitHubRepo(): Promise<string> {
  try {
    const remote = await $`git remote get-url origin`.text();
    const match = remote.match(/github\.com[:/]([^\s/]+\/[^\s/]+?)(?:\.git)?(?:\s|$)/);
    return match?.[1] ?? "unknown/repo";
  } catch {
    return "unknown/repo";
  }
}

// ============================================================================
// GitHub Release
// ============================================================================

/**
 * Create GitHub release using gh CLI
 */
export async function createGitHubRelease(
  version: string,
  config: LoadedConfig | null
): Promise<void> {
  if (!(config?.release?.github ?? false)) {
    return;
  }

  const tag = `v${version}`;

  // Check if gh CLI is available
  try {
    await $`gh --version`.quiet();
  } catch {
    logger.warn("GitHub CLI not found, skipping GitHub release");
    return;
  }

  await $`gh release create ${tag} --title "Release ${tag}" --generate-notes`.nothrow();
}

// ============================================================================
// Release Steps
// ============================================================================

/**
 * Run tests
 */
export async function runTests(): Promise<void> {
  await $`bun test`;
}

/**
 * Build project
 */
export async function buildProject(): Promise<void> {
  await $`bun run build`;
}

// ============================================================================
// Version Management
// ============================================================================

/**
 * Simple version bump (for release command compatibility)
 */
export function bumpVersionSimple(version: string, type: "patch" | "minor" | "major"): string {
  const parts = version.split(".").map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;

  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
  }
}
