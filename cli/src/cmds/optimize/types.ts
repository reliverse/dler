// cli/src/cmds/optimize/types.ts

export interface PackageMetadata {
  name: string;
  path: string;
  lastModified: number;
}

export interface ImprovementMetadata {
  last_updated: string;
  improvement_type: "build" | "performance" | "DX" | "type-safety" | "bundle-size";
  description: string;
  outcome: string;
  regression_notes: string;
}

export interface PackageEntry {
  [packageName: string]: {
    last_updated: string;
    improvement_type: string;
    description: string;
    outcome: string;
    regression_notes: string;
    changelog?: string[];
  };
}

export interface OptimizationResult {
  success: boolean;
  package: string;
  improvements: string[];
  regressions: string[];
  baseline?: BaselineMetrics;
  after?: BaselineMetrics;
  reverted: boolean;
}

export interface BaselineMetrics {
  buildTime?: number;
  bundleSize?: number;
  typeCoverage?: number;
  testTime?: number;
  [key: string]: number | undefined;
}

export interface OptimizeOptions {
  target?: string;
  dryRun?: boolean;
  tolerance?: number;
  verbose?: boolean;
  cwd?: string;
}

