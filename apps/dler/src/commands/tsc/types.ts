// apps/dler/src/cmds/tsc/types.ts

import type { PackageInfo } from "./impl";

export interface CacheMetadata {
  version: string;
  lastUpdated: number;
  packages: Record<string, PackageCacheEntry>;
}

export interface PackageCacheEntry {
  lastCheck: number;
  lastSuccess: number | null;
  sourceFiles: SourceFileInfo[];
  hasErrors: boolean;
  errorCount: number;
  warningCount: number;
  output?: string;
  filteredOutput?: string;
}

export interface SourceFileInfo {
  path: string;
  mtime: number;
  size: number;
}

export interface TscCacheOptions {
  enabled: boolean;
  cacheDir: string;
  maxAge: number; // in milliseconds
}

export interface OptimizedTscOptions {
  concurrency?: number;
  stopOnError?: boolean;
  verbose?: boolean;
  copyLogs?: boolean;
  cache?: boolean;
  incremental?: boolean;
  autoConcurrency?: boolean;
  skipUnchanged?: boolean;
  buildMode?: boolean;
}

export interface PackageDiscoveryResult {
  packages: PackageInfo[];
  monorepoRoot: string;
  discoveryTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface TscExecutionResult {
  package: PackageInfo;
  success: boolean;
  skipped: boolean;
  cached: boolean;
  totalErrors: number;
  totalWarnings: number;
  filteredErrors: number;
  filteredWarnings: number;
  output: string;
  filteredOutput: string;
  executionTime: number;
}
