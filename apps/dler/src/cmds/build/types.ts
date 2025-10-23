// apps/dler/src/cmds/build/types.ts

export interface PackageInfo {
  name: string;
  path: string;
  hasTsConfig: boolean;
  entryPoints: string[];
  outputDir: string;
  buildConfig?: PackageBuildConfig;
  isFrontendApp?: boolean;
  hasHtmlEntry?: boolean;
  hasPublicDir?: boolean;
}

export interface PackageBuildConfig {
  target?: 'browser' | 'bun' | 'node';
  format?: 'esm' | 'cjs' | 'iife';
  minify?: boolean | MinifyOptions;
  sourcemap?: 'none' | 'linked' | 'inline' | 'external' | boolean;
  splitting?: boolean;
  external?: string | string[];
  bytecode?: boolean;
  drop?: string[];
  packages?: 'bundle' | 'external';
  publicPath?: string;
  root?: string;
  define?: Record<string, string>;
  naming?: NamingOptions;
  env?: 'inline' | 'disable' | `${string}*`;
  plugins?: BunPlugin[];
  banner?: string;
  footer?: string;
  conditions?: string[];
  loader?: Record<string, Loader>;
  ignoreDCEAnnotations?: boolean;
  emitDCEAnnotations?: boolean;
  throw?: boolean;
  jsx?: JSXOptions;
  keepNames?: boolean;
  // New Bun bundler features
  noBundle?: boolean;
  reactFastRefresh?: boolean;
  noClearScreen?: boolean;
  // Windows executable options
  windowsHideConsole?: boolean;
  windowsIcon?: string;
  windowsTitle?: string;
  windowsPublisher?: string;
  windowsVersion?: string;
  windowsDescription?: string;
  windowsCopyright?: string;
  // Experimental features
  app?: boolean;
  serverComponents?: boolean;
  debugDumpServerFiles?: boolean;
  debugNoMinify?: boolean;
  // Frontend-specific options
  html?: boolean | HtmlOptions;
  assets?: AssetOptions;
  devServer?: DevServerOptions;
  cssChunking?: boolean;
  // Enhanced features
  macros?: boolean;
  sideEffects?: boolean | string[];
  bundleAnalyzer?: boolean;
  typeCheck?: boolean;
  generateTypes?: boolean;
  bundleSizeLimit?: number;
  performanceBudget?: PerformanceBudget;
  // Asset optimization
  imageOptimization?: boolean;
  fontOptimization?: boolean;
  cssOptimization?: boolean;
  // Modern loaders
  svgAsReact?: boolean;
  cssModules?: boolean;
  workerSupport?: boolean;
}

export interface MinifyOptions {
  whitespace?: boolean;
  syntax?: boolean;
  identifiers?: boolean;
}

export interface JSXOptions {
  runtime?: 'automatic' | 'classic';
  importSource?: string;
}

export interface NamingOptions {
  chunk?: string;
  entry?: string;
  asset?: string;
}

export interface BuildResult {
  package: PackageInfo;
  success: boolean;
  skipped: boolean;
  output: string;
  errors: string[];
  warnings: string[];
  buildTime: number;
  bundleSize?: number;
  cacheHit?: boolean;
}

export interface BuildSummary {
  totalPackages: number;
  failedPackages: number;
  successfulPackages: number;
  skippedPackages: number;
  hasErrors: boolean;
  results: BuildResult[];
  totalBuildTime: number;
  totalBundleSize: number;
  cacheHits: number;
}

export interface BuildOptions {
  concurrency?: number;
  stopOnError?: boolean;
  verbose?: boolean;
  watch?: boolean;
  target?: 'browser' | 'bun' | 'node';
  format?: 'esm' | 'cjs' | 'iife';
  minify?: boolean | MinifyOptions;
  minifyWhitespace?: boolean;
  minifySyntax?: boolean;
  minifyIdentifiers?: boolean;
  sourcemap?: 'none' | 'linked' | 'inline' | 'external' | boolean;
  splitting?: boolean;
  external?: string | string[];
  bytecode?: boolean;
  drop?: string[];
  packages?: 'bundle' | 'external';
  publicPath?: string;
  root?: string;
  define?: Record<string, string>;
  naming?: NamingOptions;
  env?: 'inline' | 'disable' | `${string}*`;
  banner?: string;
  footer?: string;
  conditions?: string[];
  loader?: Record<string, Loader>;
  ignoreDCEAnnotations?: boolean;
  emitDCEAnnotations?: boolean;
  throw?: boolean;
  jsx?: JSXOptions;
  keepNames?: boolean;
  production?: boolean;
  dev?: boolean;
  compile?: boolean;
  cache?: boolean;
  noCache?: boolean;
  entryNaming?: string;
  chunkNaming?: string;
  assetNaming?: string;
  // New Bun bundler features
  noBundle?: boolean;
  reactFastRefresh?: boolean;
  noClearScreen?: boolean;
  // Windows executable options
  windowsHideConsole?: boolean;
  windowsIcon?: string;
  windowsTitle?: string;
  windowsPublisher?: string;
  windowsVersion?: string;
  windowsDescription?: string;
  windowsCopyright?: string;
  // Experimental features
  app?: boolean;
  serverComponents?: boolean;
  debugDumpServerFiles?: boolean;
  debugNoMinify?: boolean;
  // Frontend-specific options
  html?: boolean | HtmlOptions;
  assets?: AssetOptions;
  devServer?: boolean | DevServerOptions;
  cssChunking?: boolean;
  port?: number;
  open?: boolean;
  publicAssets?: string;
  // Debug and experimental
  debug?: boolean;
  experimental?: string[];
  // Enhanced features
  macros?: boolean;
  sideEffects?: boolean | string[];
  bundleAnalyzer?: boolean;
  typeCheck?: boolean;
  generateTypes?: boolean;
  bundleSizeLimit?: number;
  performanceBudget?: PerformanceBudget;
  // Asset optimization
  imageOptimization?: boolean;
  fontOptimization?: boolean;
  cssOptimization?: boolean;
  // Modern loaders
  svgAsReact?: boolean;
  cssModules?: boolean;
  workerSupport?: boolean;
  // Plugin system
  plugins?: string[];
  // Performance monitoring
  performanceMonitoring?: boolean;
  bundleAnalysis?: boolean;
}

export interface CacheEntry {
  hash: string;
  timestamp: number;
  buildTime: number;
  bundleSize: number;
  outputFiles: string[];
}

export interface CacheOptions {
  enabled: boolean;
  directory: string;
  ttl: number; // Time to live in milliseconds
}

export type Loader = 'js' | 'jsx' | 'ts' | 'tsx' | 'json' | 'toml' | 'file' | 'napi' | 'wasm' | 'text';

export interface BunPlugin {
  name: string;
  setup: (build: any) => void;
}

export interface BuildArtifact {
  path: string;
  loader: Loader;
  hash: string | null;
  kind: 'entry-point' | 'chunk' | 'asset' | 'sourcemap' | 'bytecode';
  sourcemap: BuildArtifact | null;
}

export interface BuildMessage {
  name: 'BuildMessage';
  position: Position | null;
  code: string;
  message: string;
  level: 'error' | 'warning' | 'info' | 'debug' | 'verbose';
  toString(): string;
}

export interface ResolveMessage {
  name: 'ResolveMessage';
  position: Position | null;
  code: string;
  message: string;
  referrer: string;
  specifier: string;
  importKind: 'entry_point' | 'stmt' | 'require' | 'import' | 'dynamic' | 'require_resolve' | 'at' | 'at_conditional' | 'url' | 'internal';
  level: 'error' | 'warning' | 'info' | 'debug' | 'verbose';
  toString(): string;
}

export interface Position {
  file: string;
  line: number;
  column: number;
}

export interface HtmlOptions {
  entryPoints?: string[];
  inject?: boolean;
  minify?: boolean;
}

export interface AssetOptions {
  publicPath?: string;
  copyFiles?: string[];
  imageOptimization?: boolean;
}

export interface DevServerOptions {
  port?: number;
  host?: string;
  hmr?: boolean;
  open?: boolean;
}

export interface PerformanceBudget {
  maxBundleSize?: number;
  maxChunkSize?: number;
  maxAssetSize?: number;
  maxInitialChunkSize?: number;
  maxAsyncChunkSize?: number;
}

export interface DlerPlugin {
  name: string;
  setup: (build: BunBuildConfig) => void;
  onBuildStart?: () => void;
  onBuildEnd?: (result: BuildResult) => void;
  onResolve?: (args: any) => any;
  onLoad?: (args: any) => any;
}

export interface BunBuildConfig {
  entrypoints: string[];
  outdir: string;
  target?: 'browser' | 'bun' | 'node';
  format?: 'esm' | 'cjs' | 'iife';
  sourcemap?: 'none' | 'linked' | 'inline' | 'external' | boolean;
  splitting?: boolean;
  external?: string[];
  bytecode?: boolean;
  drop?: string[];
  packages?: 'bundle' | 'external';
  publicPath?: string;
  root?: string;
  define?: Record<string, string>;
  naming?: NamingOptions;
  env?: 'inline' | 'disable' | `${string}*`;
  banner?: string;
  footer?: string;
  conditions?: string[];
  loader?: Record<string, Loader>;
  ignoreDCEAnnotations?: boolean;
  emitDCEAnnotations?: boolean;
  throw?: boolean;
  jsx?: JSXOptions;
  keepNames?: boolean;
  minify?: boolean | MinifyOptions;
  plugins?: BunPlugin[];
  noBundle?: boolean;
  reactFastRefresh?: boolean;
  noClearScreen?: boolean;
  windowsHideConsole?: boolean;
  windowsIcon?: string;
  windowsTitle?: string;
  windowsPublisher?: string;
  windowsVersion?: string;
  windowsDescription?: string;
  windowsCopyright?: string;
  app?: boolean;
  serverComponents?: boolean;
  debugDumpServerFiles?: boolean;
  debugNoMinify?: boolean;
}

export interface ReliverseConfig {
  build?: {
    // Global build configuration
    global?: PackageBuildConfig;
    // Per-package build configurations
    packages?: Record<string, PackageBuildConfig>;
    // Package patterns for applying configs
    patterns?: Array<{
      pattern: string;
      config: PackageBuildConfig;
    }>;
  };
}
