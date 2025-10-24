// apps/dler/src/cmds/perf/types.ts

export interface PerfOptions {
  target?: string;
  type?: string;
  runs?: number;
  warmup?: number;
  concurrency?: number;
  compare?: boolean;
  output?: string;
  save?: boolean;
  verbose?: boolean;
  cwd?: string;
  ignore?: string | string[];
}

export type PerfAnalysisType =
  | "command"
  | "bundle"
  | "file"
  | "monorepo"
  | "auto";
export type PerfOutputFormat = "console" | "json" | "html" | "all";

export interface BenchmarkResult {
  command: string;
  runs: number;
  warmup: number;
  concurrency: number;
  measurements: Measurement[];
  statistics: Statistics;
  memory: MemoryStats;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface Measurement {
  run: number;
  duration: number;
  memory: MemoryUsage;
  success: boolean;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface Statistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  variance: number;
  standardDeviation: number;
  coefficientOfVariation: number;
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryStats {
  peak: MemoryUsage;
  average: MemoryUsage;
  growth: number;
}

export interface BundleAnalysisResult {
  target: string;
  totalSize: number;
  fileCount: number;
  largestFiles: FileSize[];
  modules: ModuleInfo[];
  duplicates: DuplicateInfo[];
  compressionPotential: number;
  analysisTime: number;
}

export interface FileSize {
  path: string;
  size: number;
  percentage: number;
  type: string;
}

export interface ModuleInfo {
  name: string;
  size: number;
  percentage: number;
  dependencies: string[];
  isExternal: boolean;
}

export interface DuplicateInfo {
  name: string;
  count: number;
  totalSize: number;
  locations: string[];
}

export interface FileSystemAnalysisResult {
  target: string;
  totalFiles: number;
  totalSize: number;
  directoryCount: number;
  maxDepth: number;
  largestFiles: FileSize[];
  largestDirectories: DirectorySize[];
  fileTypes: FileTypeDistribution[];
  compressionPotential: number;
  analysisTime: number;
}

export interface DirectorySize {
  path: string;
  size: number;
  fileCount: number;
  depth: number;
}

export interface FileTypeDistribution {
  extension: string;
  count: number;
  totalSize: number;
  percentage: number;
}

export interface MonorepoAnalysisResult {
  packages: PackageInfo[];
  dependencies: DependencyGraph;
  circularDependencies: CircularDependency[];
  criticalPath: string[];
  buildOrder: string[];
  bottlenecks: Bottleneck[];
  suggestedConcurrency: number;
  analysisTime: number;
}

export interface PackageInfo {
  name: string;
  path: string;
  dependencies: string[];
  dependents: string[];
  buildTime?: number;
  size?: number;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
  levels: string[][];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "dependency" | "devDependency" | "peerDependency";
}

export interface CircularDependency {
  packages: string[];
  cycle: string[];
  severity: "low" | "medium" | "high";
}

export interface Bottleneck {
  package: string;
  type: "slow-build" | "many-dependencies" | "circular-dependency";
  impact: number;
  suggestion: string;
}

export interface PerfReport {
  timestamp: number;
  options: PerfOptions;
  benchmark?: BenchmarkResult;
  bundleAnalysis?: BundleAnalysisResult;
  fileSystemAnalysis?: FileSystemAnalysisResult;
  monorepoAnalysis?: MonorepoAnalysisResult;
  baseline?: BaselineComparison;
}

export interface BaselineComparison {
  exists: boolean;
  improvement?: number;
  regression?: number;
  changes?: ChangeSummary;
}

export interface ChangeSummary {
  duration?: number;
  memory?: number;
  size?: number;
  files?: number;
}

export interface CacheEntry {
  timestamp: number;
  report: PerfReport;
  hash: string;
}

export interface CacheOptions {
  enabled: boolean;
  cacheDir: string;
  maxAge: number;
}

export type AnalysisResult =
  | BundleAnalysisResult
  | FileSystemAnalysisResult
  | MonorepoAnalysisResult;

export type OutputFormat = PerfOutputFormat;
