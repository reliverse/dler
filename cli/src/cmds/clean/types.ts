// apps/dler/src/cmds/clean/types.ts

export interface CleanOptions {
  presets?: string;
  custom?: string;
  filter?: string | string[];
  ignore?: string | string[];
  cwd?: string;
  subdirs?: boolean;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  deleteLockFiles?: boolean;
  replaceExports?: boolean;
  replaceExportsIgnorePackages?: string;
}

export interface FileMatch {
  path: string;
  size: number;
  isDirectory: boolean;
  category: string;
}

export interface CleanResult {
  totalFiles: number;
  totalSize: number;
  deletedFiles: number;
  deletedSize: number;
  errors: CleanError[];
  hasErrors: boolean;
  results: PackageCleanResult[];
}

export interface PackageCleanResult {
  package: PackageInfo;
  files: FileMatch[];
  deletedCount: number;
  deletedSize: number;
  errors: CleanError[];
}

export interface PackageInfo {
  name: string;
  path: string;
  isRoot: boolean;
}

export interface CleanError {
  path: string;
  error: string;
  package?: string;
}

export interface PresetCategory {
  name: string;
  description: string;
  patterns: string[];
  order: number; // Lower numbers are deleted first
}

export interface CleanSummary {
  totalPackages: number;
  processedPackages: number;
  totalFiles: number;
  totalSize: number;
  deletedFiles: number;
  deletedSize: number;
  errors: CleanError[];
  hasErrors: boolean;
  results: PackageCleanResult[];
}
