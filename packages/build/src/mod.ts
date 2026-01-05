// packages/build/src/mod.ts

import { existsSync, mkdirSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  getPackageBuildConfig,
  mergeBuildOptions,
} from "@reliverse/config/impl/build";
import type { DlerConfig } from "@reliverse/config/impl/core";
import {
  findMonorepoRoot,
  loadDlerConfig,
} from "@reliverse/config/impl/discovery";
import { writeErrorLines } from "@reliverse/helpers";
import pMap from "@reliverse/mapkit";
import {
  createIgnoreFilter,
  createIncludeFilter,
  normalizePatterns,
} from "@reliverse/matcha";
import { relinka } from "@reliverse/relinka";
import {
  getWorkspacePatterns,
  preparePackageJsonForPublishing,
  readPackageJSON,
  readTSConfig,
} from "@reliverse/typerso";
import { processAssetsForPackage, processCSSForPackage } from "./impl/assets";
import { BuildCache } from "./impl/cache";
import {
  ALWAYS_IGNORED_PACKAGES,
  FRONTEND_FRAMEWORKS,
  FRONTEND_HTML_PATTERNS,
  GO_PROJECT_DIRS,
  JS_ENTRY_PATTERNS,
  LIBRARY_ENTRY_PATTERNS,
} from "./impl/constants";
import { createDebugLogger } from "./impl/debug";
import { startDevServer } from "./impl/dev-server";
import { processHTMLForPackage } from "./impl/html-processor";
import {
  AssetOptimizationPlugin,
  applyPlugins,
  BundleAnalyzerPlugin,
  CSSModulesPlugin,
  loadPlugins,
  PerformancePlugin,
  pluginRegistry,
  ReactRefreshPlugin,
  SVGAsReactPlugin,
  TypeScriptDeclarationsPlugin,
  WorkerPlugin,
} from "./impl/plugins";
import { validateTSConfig } from "./impl/tsconfig-validator";
import { validateBuildConfig } from "./impl/type-guards";
import type {
  BuildOptions,
  BuildResult,
  BuildSummary,
  DlerPlugin,
  MinifyOptions,
  MkdistOptions,
  PackageInfo,
} from "./impl/types";
import {
  handleGoBuild,
  handleGoOnlyBuild,
} from "./impl/utils/go-build-handler";
import {
  extractErrors,
  extractWarnings,
  formatLogMessages,
} from "./impl/utils/log-extraction";
import { filterPrivatePackages } from "./impl/utils/package-filtering";
import { startWatchMode } from "./impl/watch";

export type { GoBuildOptions } from "@reliverse/config/impl/build";
export type {
  PackageKind,
  RegistryType,
} from "@reliverse/config/impl/publish";
export type { PreparePackageJsonOptions } from "@reliverse/typerso";
export {
  addBinFieldToPackageJson,
  extractPackageName,
  parseBinArgument,
  preparePackageJsonForPublishing,
  transformExportsForBuild,
} from "@reliverse/typerso";
export type {
  DtsGeneratorOptions,
  DtsGeneratorResult,
} from "./impl/dts-generator";
export { generateDeclarations } from "./impl/dts-generator";
export { buildGo } from "./impl/go-build";
export { applyPresets } from "./impl/presets";
export type { MkdistDtsOptions } from "./impl/providers/mkdist-dts";
export type {
  TSConfigValidationOptions,
  TSConfigValidationResult,
} from "./impl/tsconfig-validator";
export {
  logValidationResults,
  validateAllTSConfigs,
  validateTSConfig,
} from "./impl/tsconfig-validator";
export type { BuildOptions } from "./impl/types";
export { validateAndExit } from "./impl/validation";

import { DEFAULT_CONCURRENCY } from "./impl/constants";

// ============================================================================
// Plugin System Initialization
// ============================================================================

// Lazy plugin registration - only register when plugins are needed
let pluginsInitialized = false;
const initializePlugins = (): void => {
  if (pluginsInitialized) return;

  // Register built-in plugins
  pluginRegistry.register(ReactRefreshPlugin);
  pluginRegistry.register(TypeScriptDeclarationsPlugin);
  pluginRegistry.register(AssetOptimizationPlugin);
  pluginRegistry.register(BundleAnalyzerPlugin);
  pluginRegistry.register(CSSModulesPlugin);
  pluginRegistry.register(SVGAsReactPlugin);
  pluginRegistry.register(WorkerPlugin);
  pluginRegistry.register(PerformancePlugin);

  pluginsInitialized = true;
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

// ============================================================================
// Package Discovery
// ============================================================================

const getWorkspacePackages = async (cwd?: string): Promise<PackageInfo[]> => {
  const monorepoRoot = await findMonorepoRoot(cwd);

  // If no monorepo found, check if current directory is a single package
  if (!monorepoRoot) {
    const currentDir = cwd || process.cwd();
    const pkgInfo = await resolvePackageInfo(currentDir, null);

    if (pkgInfo) {
      // Return single package info
      return [pkgInfo];
    }

    // Neither monorepo nor valid package found
    throw new Error(
      "❌ No monorepo or valid package found. Ensure package.json has 'workspaces' field or contains a valid 'name' field.",
    );
  }

  const rootPkg = await readPackageJSON(monorepoRoot);
  if (!rootPkg) {
    throw new Error("❌ Could not read root package.json");
  }

  const patterns = getWorkspacePatterns(rootPkg);

  if (!patterns.length) {
    throw new Error("❌ No workspace patterns found in package.json");
  }

  // Load dler configuration
  const dlerConfig = await loadDlerConfig(monorepoRoot);

  const packages: PackageInfo[] = [];
  const seenPaths = new Set<string>();

  // Process patterns in parallel for better performance
  const patternPromises = patterns.map(async (pattern) => {
    // Check if pattern contains wildcards
    let matches: string[] = [];

    if (pattern.includes("*")) {
      // Pattern with wildcards - use glob
      const glob = new Bun.Glob(pattern);
      matches = Array.from(
        glob.scanSync({ cwd: monorepoRoot, onlyFiles: false }),
      );
    } else {
      // Direct package path (no wildcards)
      matches = [pattern];
    }

    const packagePromises = matches.map(async (match: string) => {
      const packagePath = resolve(monorepoRoot, match);

      if (seenPaths.has(packagePath)) return null;
      seenPaths.add(packagePath);

      return await resolvePackageInfo(packagePath, dlerConfig);
    });

    return await Promise.all(packagePromises);
  });

  const patternResults = await Promise.all(patternPromises);

  // Flatten and filter results
  for (const patternResult of patternResults) {
    for (const pkgInfo of patternResult) {
      if (pkgInfo) {
        packages.push(pkgInfo);
      }
    }
  }

  // Filter out the monorepo root to prevent building it
  const filteredPackages = packages.filter((pkg) => {
    const normalizedPkgPath = resolve(pkg.path);
    const normalizedRootPath = resolve(monorepoRoot);
    return normalizedPkgPath !== normalizedRootPath;
  });

  return filteredPackages;
};

// Cache for package.json reads to avoid multiple file system calls
interface PackageJsonCache {
  name?: string;
  bin?: string | Record<string, string>;
  build?: {
    entrypoints?: string | string[];
  };
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  private?: boolean;
}

const packageJsonCache = new Map<string, PackageJsonCache>();

// Cache for entry point detection results
const entryPointCache = new Map<string, string[]>();

// Helper to check if path contains build artifacts
const isBuildArtifact = (path: string): boolean => {
  return (
    path.includes("/dist/") ||
    path.includes("/build/") ||
    path.includes("\\dist\\") ||
    path.includes("\\build\\")
  );
};

// ============================================================================
// Entry Point Detection
// ============================================================================

const detectEntryPoints = async (packagePath: string): Promise<string[]> => {
  // Check cache first
  const cached = entryPointCache.get(packagePath);
  if (cached !== undefined) {
    return cached;
  }

  // Use cached package.json if available
  let pkg = packageJsonCache.get(packagePath);
  if (!pkg) {
    pkg = await readPackageJSON(packagePath);
    if (pkg) {
      packageJsonCache.set(packagePath, pkg);
    }
  }
  if (!pkg) {
    entryPointCache.set(packagePath, []);
    return [];
  }

  const entryPoints: string[] = [];

  // 1. Check package.json "build" field for explicit config
  if (pkg.build?.entrypoints) {
    const entrypoints = Array.isArray(pkg.build.entrypoints)
      ? pkg.build.entrypoints
      : [pkg.build.entrypoints];
    const result = entrypoints.map((ep: string) => resolve(packagePath, ep));
    entryPointCache.set(packagePath, result);
    return result;
  }

  // 2. Parse package.json "exports" field
  if (pkg.exports) {
    const extractFromExports = (exports: unknown, basePath = ""): void => {
      if (typeof exports === "string") {
        const fullPath = resolve(packagePath, basePath, exports);
        if (existsSync(fullPath) && !isBuildArtifact(fullPath)) {
          entryPoints.push(fullPath);
        }
      } else if (typeof exports === "object" && exports !== null) {
        for (const [key, value] of Object.entries(exports)) {
          if (key === "." || key.startsWith("./")) {
            // Handle subpath exports
            extractFromExports(value, basePath);
          } else if (
            key === "import" ||
            key === "require" ||
            key === "types" ||
            key === "default"
          ) {
            // Handle conditional exports - prioritize import over require, skip types
            if (key !== "types") {
              extractFromExports(value, basePath);
            }
          } else if (typeof value === "object" && value !== null) {
            // Handle nested conditional exports
            extractFromExports(value, basePath);
          } else if (typeof value === "string") {
            // Handle direct string values in export conditions
            const fullPath = resolve(packagePath, basePath, value);
            if (existsSync(fullPath) && !isBuildArtifact(fullPath)) {
              entryPoints.push(fullPath);
            }
          }
        }
      }
    };

    extractFromExports(pkg.exports);
  }

  // 2.5. Check for CLI packages via bin field
  const binEntries = await detectBinEntryPoints(packagePath, pkg);
  if (binEntries.length > 0) {
    entryPoints.push(...binEntries);
  }

  // If we found entries from exports and/or bin, return them
  if (entryPoints.length > 0) {
    const result = [...new Set(entryPoints)];
    entryPointCache.set(packagePath, result);
    return result;
  }

  // 3. Check for frontend app patterns (HTML files)
  for (const pattern of FRONTEND_HTML_PATTERNS) {
    const fullPath = resolve(packagePath, pattern);
    if (existsSync(fullPath)) {
      // For HTML files, also look for associated JS/TS entry points
      const jsEntryPoints = await detectJSEntryPoints(packagePath);
      const result = [fullPath, ...jsEntryPoints];
      entryPointCache.set(packagePath, result);
      return result;
    }
  }

  // 4. Fallback to common library patterns
  for (const pattern of LIBRARY_ENTRY_PATTERNS) {
    const fullPath = resolve(packagePath, pattern);
    if (existsSync(fullPath)) {
      entryPointCache.set(packagePath, [fullPath]);
      return [fullPath];
    }
  }

  entryPointCache.set(packagePath, []);
  return [];
};

const detectJSEntryPoints = async (packagePath: string): Promise<string[]> => {
  const entryPoints: string[] = [];
  for (const pattern of JS_ENTRY_PATTERNS) {
    const fullPath = resolve(packagePath, pattern);
    if (existsSync(fullPath)) {
      entryPoints.push(fullPath);
    }
  }

  return entryPoints;
};

const detectBinEntryPoints = async (
  packagePath: string,
  pkg: PackageJsonCache,
): Promise<string[]> => {
  if (!pkg.bin) return [];

  const binEntries: string[] = [];
  const binField = pkg.bin;

  // bin can be a string or an object
  const binPaths: string[] =
    typeof binField === "string"
      ? [binField]
      : (Object.values(binField) as string[]);

  for (const binPath of binPaths) {
    // bin paths typically point to dist/ output
    // Infer source file by replacing dist/ with src/ and .js with .ts
    // Handle multiple patterns:
    // - "dist/cli.js" -> "src/cli.ts"
    // - "./dist/cli.js" -> "src/cli.ts"
    // - "cli.js" -> "cli.ts" or "src/cli.ts"
    const sourcePath = binPath
      .replace(/^\.\/dist\//, "src/")
      .replace(/^dist\//, "src/")
      .replace(/\.js$/, ".ts");

    // Check multiple potential locations
    const potentialPaths = [
      sourcePath, // Direct conversion
      sourcePath.replace(/^src\//, ""), // Remove src/ prefix
      `src/${sourcePath}`, // Add src/ prefix
    ];

    for (const potential of new Set(potentialPaths)) {
      const fullPath = resolve(packagePath, potential);
      if (existsSync(fullPath)) {
        binEntries.push(fullPath);
        break; // Found it, no need to check others
      }
    }
  }

  return binEntries;
};

const detectFrontendApp = async (
  packagePath: string,
  pkg: PackageJsonCache,
): Promise<boolean> => {
  // Check for HTML files
  for (const pattern of FRONTEND_HTML_PATTERNS) {
    const fullPath = resolve(packagePath, pattern);
    if (existsSync(fullPath)) {
      return true;
    }
  }

  // Check for frontend framework dependencies
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  for (const framework of FRONTEND_FRAMEWORKS) {
    if (allDeps[framework]) {
      return true;
    }
  }

  // Check for public directory (common in frontend apps)
  const publicDir = resolve(packagePath, "public");
  if (existsSync(publicDir) && statSync(publicDir).isDirectory()) {
    return true;
  }

  return false;
};

const detectGoProject = async (packagePath: string): Promise<boolean> => {
  // Quick check: look for main.go in root
  const mainGoPath = resolve(packagePath, "main.go");
  if (existsSync(mainGoPath)) {
    return true;
  }

  // Check for go.mod (indicates Go project)
  const goModPath = resolve(packagePath, "go.mod");
  if (!existsSync(goModPath)) {
    return false;
  }

  // If go.mod exists, check for .go files in the project
  try {
    const entries = await readdir(packagePath, { withFileTypes: true });
    for (const entry of entries) {
      // Check for .go files in root
      if (entry.isFile() && entry.name.endsWith(".go")) {
        return true;
      }
      // Check common Go directories
      if (entry.isDirectory()) {
        if (
          GO_PROJECT_DIRS.includes(
            entry.name as (typeof GO_PROJECT_DIRS)[number],
          )
        ) {
          const subPath = resolve(packagePath, entry.name);
          try {
            const subEntries = await readdir(subPath, { recursive: true });
            if (subEntries.some((name) => name.endsWith(".go"))) {
              return true;
            }
          } catch {
            // Ignore errors reading subdirectory
          }
        }
      }
    }
  } catch {
    // If we can't read the directory but go.mod exists, assume it's a Go project
    // This handles edge cases where permissions might be an issue
    return true;
  }

  return false;
};

// ============================================================================
// Output Directory Resolution
// ============================================================================

const resolveOutputDir = async (packagePath: string): Promise<string> => {
  // 1. Check tsconfig.json compilerOptions.outDir
  try {
    const tsconfig = await readTSConfig(packagePath);
    if (tsconfig?.compilerOptions?.outDir) {
      return resolve(packagePath, tsconfig.compilerOptions.outDir);
    }
  } catch {
    // Ignore tsconfig read errors
  }

  // 2. Fallback to dist/ folder
  return resolve(packagePath, "dist");
};

// ============================================================================
// Package Info Resolution
// ============================================================================

const resolvePackageInfo = async (
  packagePath: string,
  dlerConfig: DlerConfig | null,
): Promise<PackageInfo | null> => {
  const pkgJsonPath = join(packagePath, "package.json");

  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  try {
    // Use cached package.json if available
    let pkg = packageJsonCache.get(packagePath);
    if (!pkg) {
      pkg = await readPackageJSON(packagePath);
      if (pkg) {
        packageJsonCache.set(packagePath, pkg);
      }
    }

    if (!pkg?.name) {
      return null;
    }

    const hasTsConfig = existsSync(join(packagePath, "tsconfig.json"));
    const entryPoints = await detectEntryPoints(packagePath);
    const outputDir = await resolveOutputDir(packagePath);

    // Detect frontend app characteristics
    const isFrontendApp = await detectFrontendApp(packagePath, pkg);
    const hasHtmlEntry = entryPoints.some((ep) => ep.endsWith(".html"));
    const hasPublicDir =
      existsSync(join(packagePath, "public")) &&
      statSync(join(packagePath, "public")).isDirectory();

    // Detect Go project
    const hasGoFiles = await detectGoProject(packagePath);

    const buildConfig = await getPackageBuildConfig(pkg.name, dlerConfig);

    // Detect CLI package (has bin field with at least one entry)
    const isCLI = !!(
      pkg.bin &&
      (typeof pkg.bin === "string" ||
        (typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0))
    );

    return {
      name: pkg.name,
      path: packagePath,
      hasTsConfig,
      entryPoints,
      outputDir,
      buildConfig,
      isFrontendApp,
      hasHtmlEntry,
      hasPublicDir,
      private: pkg.private === true,
      isCLI,
      hasGoFiles,
    };
  } catch {
    return null;
  }
};

// ============================================================================
// Package Filtering
// ============================================================================

const filterPackages = (
  packages: PackageInfo[],
  ignore?: string | string[],
  allowPrivateBuild?: string | string[],
  filter?: string | string[],
): PackageInfo[] => {
  // If filter is provided, use it to include only matching packages (takes precedence over ignore)
  if (filter) {
    const includeFilter = createIncludeFilter(filter);
    const filteredPackages = includeFilter(packages);

    return filterPrivatePackages(filteredPackages, allowPrivateBuild);
  }

  // Combine user-provided ignore patterns with always ignored packages
  const combinedIgnore = ignore
    ? Array.isArray(ignore)
      ? [...ALWAYS_IGNORED_PACKAGES, ...ignore]
      : [...ALWAYS_IGNORED_PACKAGES, ignore]
    : ALWAYS_IGNORED_PACKAGES;

  const ignoreFilter = createIgnoreFilter(combinedIgnore);
  const filteredPackages = ignoreFilter(packages);

  return filterPrivatePackages(filteredPackages, allowPrivateBuild);
};

// ============================================================================
// Standalone Executable Compilation
// ============================================================================

const compileToExecutable = async (
  pkg: PackageInfo,
  _outputs: Bun.BuildArtifact[],
  options: BuildOptions,
): Promise<void> => {
  // Use the original source entry point for compilation
  const entryPoint = pkg.entryPoints[0];
  if (!entryPoint) {
    await relinka.warn(`⚠️  ${pkg.name}: No entry point found for compilation`);
    return;
  }

  const executableName =
    entryPoint
      .split("/")
      .pop()
      ?.split("\\")
      .pop()
      ?.replace(/\.(ts|js|mjs|cjs)$/, "") || "app";
  const executablePath = join(
    pkg.outputDir,
    executableName + (process.platform === "win32" ? ".exe" : ""),
  );

  // Ensure output directory exists
  if (!existsSync(pkg.outputDir)) {
    mkdirSync(pkg.outputDir, { recursive: true });
  }

  await relinka.info(
    `🔨 Compiling ${pkg.name} to executable: ${executablePath}`,
  );

  try {
    const buildConfig: any = {
      entrypoints: [entryPoint],
      outfile: executablePath,
      compile: true,
      target: options.target || "bun",
      format: options.format || "cjs",
    };

    // Add Windows-specific metadata if on Windows
    if (process.platform === "win32") {
      if (options.windowsHideConsole)
        buildConfig.windowsHideConsole = options.windowsHideConsole;
      if (options.windowsIcon) buildConfig.windowsIcon = options.windowsIcon;
      if (options.windowsTitle) buildConfig.windowsTitle = options.windowsTitle;
      if (options.windowsPublisher)
        buildConfig.windowsPublisher = options.windowsPublisher;
      if (options.windowsVersion)
        buildConfig.windowsVersion = options.windowsVersion;
      if (options.windowsDescription)
        buildConfig.windowsDescription = options.windowsDescription;
      if (options.windowsCopyright)
        buildConfig.windowsCopyright = options.windowsCopyright;
    }

    // Use Bun's CLI approach for compilation instead of the API
    const { $ } = await import("bun");

    try {
      // For now, use the basic compilation without Windows-specific options
      // TODO: Add Windows-specific options support later (for some reason build is failing)
      const cmd = $`bun build ${entryPoint} --outfile ${executablePath} --compile --target ${buildConfig.target || "bun"}`;

      await cmd.cwd(pkg.path).quiet();
    } catch (error) {
      await relinka.error(`❌ Bun CLI compilation failed: ${error}`);
      throw error;
    }

    // Check if the executable was actually created
    if (!existsSync(executablePath)) {
      throw new Error(`Executable was not created at ${executablePath}`);
    }

    const stats = statSync(executablePath);
    await relinka.success(
      `✅ ${pkg.name}: Executable created (${formatBytes(stats.size)})`,
    );
  } catch (error) {
    await relinka.error(`❌ ${pkg.name}: Compilation failed - ${error}`);
    throw error;
  }
};

// ============================================================================
// Build Execution
// ============================================================================

const buildWithMkdist = async (
  pkg: PackageInfo,
  options: BuildOptions,
  _bunBuildConfig: any,
): Promise<BuildResult> => {
  const startTime = Date.now();

  try {
    // Import mkdist implementation
    const { mkdist } = await import("./impl/providers/mkdist/make");

    // Configure mkdist options
    // declaration generation is controlled by the jsLoader checking for options.declaration
    // mkdist internally uses typescript.compilerOptions.declaration to control DTS generation
    // srcDir is relative to rootDir, so we pass 'src' to scan the src directory
    const mkdistOptions: MkdistOptions & {
      declaration?: boolean;
    } = {
      srcDir: "src",
      distDir: pkg.outputDir,
      rootDir: pkg.path,
      format: options.format === "cjs" ? "cjs" : "esm",
      ext: options.format === "cjs" ? ".cjs" : ".js",
      cleanDist: false,
      addRelativeDeclarationExtensions: true,
      declaration: true,
      verbose: options.verbose,
      typescript: {
        compilerOptions: {
          // Don't override emitDeclarationOnly here - let mkdist handle it
          // mkdist will set it to true to generate declarations
          allowJs: true,
          skipLibCheck: true,
        },
      },
    };

    // Execute mkdist build
    const { result, duration } = await mkdist(mkdistOptions);

    // Calculate bundle size
    let bundleSize = 0;
    const outputFiles: string[] = [];
    for (const filePath of result.writtenFiles) {
      try {
        const stats = statSync(filePath);
        bundleSize += stats.size;
        outputFiles.push(filePath);
      } catch {
        // Ignore file stat errors
      }
    }

    const buildSuccess = result.errors.length === 0;

    // After successful build, transform package.json (same as Bun bundler)
    // This includes adding the files field, transforming exports, etc.
    if (buildSuccess) {
      try {
        const prepResult = await preparePackageJsonForPublishing(pkg.path, {
          kind: options.kind,
          binDefinitions: options.bin,
          access: "public",
          addPublishConfig: true,
          transformExports: options.replaceExports === true,
        });

        if (!prepResult.success && options.verbose) {
          await relinka.warn(
            `⚠️  ${pkg.name}: Failed to prepare package.json for publishing: ${prepResult.error}`,
          );
        } else if (options.verbose) {
          await relinka.info(
            `📦 ${pkg.name}: Package.json prepared for publishing`,
          );
        }
      } catch (error) {
        await relinka.warn(
          `⚠️  ${pkg.name}: Error preparing package.json for publishing: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Build Go binaries if Go files are detected (skip if tsOnly is set)
      await handleGoBuild(pkg, options, options.verbose ?? false);
    }

    // Return BuildResult
    return {
      package: pkg,
      success: buildSuccess,
      skipped: false,
      output: `Built ${result.writtenFiles.length} files`,
      errors: result.errors.map((e) => e.filename),
      warnings: [],
      buildTime: duration,
      bundleSize,
    };
  } catch (error) {
    const buildTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await relinka.error(
      `❌ ${pkg.name}: mkdist build failed - ${errorMessage}`,
    );

    return {
      package: pkg,
      success: false,
      skipped: false,
      output: errorMessage,
      errors: [errorMessage],
      warnings: [],
      buildTime,
      bundleSize: 0,
    };
  }
};

export const buildPackage = async (
  pkg: PackageInfo,
  options: BuildOptions = {},
  cache?: BuildCache,
): Promise<BuildResult> => {
  // Merge with package-specific config
  const mergedOptions = mergeBuildOptions(options, pkg.buildConfig);

  // If goOnly is set, skip TypeScript build and go straight to Go build
  // This must be checked BEFORE any TypeScript setup to avoid unnecessary processing
  if (mergedOptions.goOnly) {
    const startTime = Date.now();
    if (!pkg.hasGoFiles) {
      // Skip packages without Go files when --go-only is set (not an error)
      return {
        package: pkg,
        success: true,
        skipped: true,
        output: "Skipped (no Go files)",
        errors: [],
        warnings: [],
        buildTime: Date.now() - startTime,
        bundleSize: 0,
      };
    }

    const goResult = await handleGoOnlyBuild(pkg, mergedOptions);
    return {
      package: pkg,
      success: goResult.success,
      skipped: false,
      output: goResult.success
        ? "Go binaries built successfully"
        : `Go build failed: ${goResult.errors.join(", ")}`,
      errors: goResult.errors,
      warnings: [],
      buildTime: Date.now() - startTime,
      bundleSize: 0,
    };
  }

  // Create debug logger
  const debugLogger = createDebugLogger(mergedOptions);
  debugLogger.start();

  const {
    verbose = false,
    bundler,
    target = "node",
    format = "esm",
    minify = false,
    sourcemap = "none",
    splitting = true,
    external,
    bytecode = false,
    drop,
    packages = "bundle",
    publicPath,
    root,
    define,
    naming,
    env = "disable",
    banner,
    footer,
    conditions,
    loader,
    ignoreDCEAnnotations = false,
    emitDCEAnnotations = true,
    throw: throwOnError = false,
    jsx,
    keepNames = false,
    // Frontend-specific options
    assets,
    cssChunking,
    // Enhanced features
    macros = false,
    sideEffects,
    bundleAnalyzer = false,
    typeCheck = false,
    generateTypes = true,
    // bundleSizeLimit, // Used in performance monitoring
    performanceBudget,
    imageOptimization = false,
    fontOptimization = false,
    cssOptimization = false,
    svgAsReact = false,
    cssModules = false,
    workerSupport = false,
    plugins = [],
    performanceMonitoring = false,
    bundleAnalysis = false,
    // TSConfig validation
    validateTsconfig = true,
    strictTsconfig = false,
  } = mergedOptions;

  // Auto-detect frontend app settings
  const isFrontendApp = pkg.isFrontendApp || pkg.hasHtmlEntry;
  const shouldUseCssChunking =
    cssChunking !== false && (cssChunking === true || isFrontendApp);

  // Determine bundler based on package kind and options
  // Default to mkdist, use bun only for browser-app or native-app
  const effectiveBundler =
    bundler ||
    (pkg.buildConfig?.kind === "browser-app" ||
    pkg.buildConfig?.kind === "native-app"
      ? "bun"
      : "mkdist");

  // Set appropriate defaults for frontend apps (but not for compilation)
  // When compiling, always use the configured target/format, not frontend defaults
  const frontendTarget =
    isFrontendApp && !mergedOptions.compile ? "browser" : target;
  const frontendFormat =
    isFrontendApp && !mergedOptions.compile ? "esm" : format;
  const frontendSplitting =
    isFrontendApp && !mergedOptions.compile ? true : splitting;

  // Initialize plugins (lazy registration)
  initializePlugins();

  // Load and apply plugins
  const activePlugins: DlerPlugin[] = [];

  // Auto-load plugins based on options
  if (
    mergedOptions.reactFastRefresh ||
    (isFrontendApp && !mergedOptions.production)
  ) {
    activePlugins.push(ReactRefreshPlugin);
  }
  if (
    generateTypes ||
    typeCheck ||
    (typeof pkg.buildConfig?.dts === "object" && pkg.buildConfig.dts?.enable)
  ) {
    activePlugins.push(TypeScriptDeclarationsPlugin);
  }
  if (imageOptimization || fontOptimization || cssOptimization) {
    activePlugins.push(AssetOptimizationPlugin);
  }
  if (bundleAnalyzer || bundleAnalysis) {
    activePlugins.push(BundleAnalyzerPlugin);
  }
  if (cssModules) {
    activePlugins.push(CSSModulesPlugin);
  }
  if (svgAsReact) {
    activePlugins.push(SVGAsReactPlugin);
  }
  if (workerSupport) {
    activePlugins.push(WorkerPlugin);
  }
  if (performanceMonitoring || performanceBudget) {
    activePlugins.push(PerformancePlugin);
  }

  // Load custom plugins
  if (plugins.length > 0) {
    const customPlugins = loadPlugins(plugins);
    activePlugins.push(...customPlugins);
  }

  // Use the resolved target
  const validTarget = frontendTarget;

  // Validate format
  const validFormat =
    frontendFormat === "cjs" || frontendFormat === "iife"
      ? frontendFormat
      : "esm";

  // Validate sourcemap - handle boolean for backwards compatibility
  let validSourcemap: string | boolean = sourcemap;
  if (typeof sourcemap === "boolean") {
    validSourcemap = sourcemap ? "inline" : "none";
  } else if (
    sourcemap === "linked" ||
    sourcemap === "inline" ||
    sourcemap === "external"
  ) {
    validSourcemap = sourcemap;
  } else {
    validSourcemap = "none";
  }

  if (pkg.entryPoints.length === 0) {
    if (verbose) {
      await relinka.info(`⏭️  Skipping ${pkg.name} (no entry points found)`);
    }
    return {
      package: pkg,
      success: true,
      skipped: true,
      output: "",
      errors: [],
      warnings: [],
      buildTime: 0,
    };
  }

  // Validate tsconfig.json if enabled
  if (validateTsconfig) {
    try {
      const validationResult = await validateTSConfig(pkg, {
        strict: strictTsconfig,
        checkDeclarations: generateTypes || typeCheck,
        checkBuildOutput: true,
      });

      if (!validationResult.valid) {
        if (strictTsconfig) {
          return {
            package: pkg,
            success: false,
            skipped: false,
            output: `TSConfig validation failed: ${validationResult.errors.join(", ")}`,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            buildTime: 0,
          };
        } else {
          // Log warnings but continue
          for (const warning of validationResult.warnings) {
            await relinka.warn(`⚠️  ${pkg.name}: ${warning}`);
          }
          for (const error of validationResult.errors) {
            await relinka.warn(`⚠️  ${pkg.name}: ${error}`);
          }
        }
      } else if (validationResult.warnings.length > 0 && verbose) {
        for (const warning of validationResult.warnings) {
          await relinka.warn(`⚠️  ${pkg.name}: ${warning}`);
        }
      }
    } catch (error) {
      if (strictTsconfig) {
        return {
          package: pkg,
          success: false,
          skipped: false,
          output: `TSConfig validation error: ${error instanceof Error ? error.message : String(error)}`,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
          buildTime: 0,
        };
      } else {
        await relinka.warn(
          `⚠️  ${pkg.name}: TSConfig validation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // Check cache first
  if (cache) {
    const cacheEntry = await cache.get(pkg, mergedOptions);
    if (cacheEntry) {
      if (verbose) {
        await relinka.info(
          `⚡ ${pkg.name}: Using cache (${cacheEntry.buildTime}ms, ${formatBytes(cacheEntry.bundleSize)})`,
        );
      }
      return {
        package: pkg,
        success: true,
        skipped: false,
        output: "",
        errors: [],
        warnings: [],
        buildTime: cacheEntry.buildTime,
        bundleSize: cacheEntry.bundleSize,
        cacheHit: true,
      };
    }
  }

  if (verbose) {
    await relinka.info(`🔨 Building ${pkg.name}...`);
  }

  // Debug logging
  debugLogger.logConfigResolution(pkg, pkg.buildConfig ? "dler" : "default");
  debugLogger.logBuildOptions(mergedOptions, pkg);
  debugLogger.logEntryPoints(pkg);

  const startTime = Date.now();

  try {
    // Validate build options
    const validation = validateBuildConfig(mergedOptions);
    if (!validation.valid) {
      await relinka.warn(
        `⚠️  ${pkg.name}: Invalid build options - ${validation.errors.join(", ")}`,
      );
    }

    const buildConfig: any = {
      entrypoints: pkg.entryPoints,
      outdir: pkg.outputDir,
      target: validTarget,
      format: validFormat,
      sourcemap: validSourcemap,
      splitting: frontendSplitting,
      verbose,
    };

    // Debug logging for native app
    if (pkg.name === "@reliverse/native-app-example") {
      await relinka.info(
        `🔍 Debug: target=${validTarget}, format=${validFormat}, bytecode=${bytecode}`,
      );
    }

    // Apply plugins to build configuration
    applyPlugins(activePlugins, buildConfig);

    // Add JSX configuration
    if (jsx) {
      buildConfig.jsx = jsx;
    }

    // Add keepNames for minification
    if (keepNames) {
      buildConfig.keepNames = keepNames;
    }

    // Configure asset loaders for frontend apps
    if (isFrontendApp) {
      buildConfig.loader = {
        ...loader,
        ".png": "file",
        ".jpg": "file",
        ".jpeg": "file",
        ".gif": "file",
        ".svg": "file",
        ".webp": "file",
        ".ico": "file",
        ".woff": "file",
        ".woff2": "file",
        ".ttf": "file",
        ".eot": "file",
        ".css": "css",
        ...loader,
      };
    }

    // Handle minification options
    if (typeof minify === "boolean") {
      buildConfig.minify = minify;
    } else if (typeof minify === "object" && minify !== null) {
      // Validate minify object structure matches Bun API
      const validMinify: MinifyOptions = {};
      if (minify.whitespace !== undefined)
        validMinify.whitespace = minify.whitespace;
      if (minify.syntax !== undefined) validMinify.syntax = minify.syntax;
      if (minify.identifiers !== undefined)
        validMinify.identifiers = minify.identifiers;
      buildConfig.minify = validMinify;
    }

    // Add all the new options
    if (external) {
      const externalArray = Array.isArray(external) ? external : [external];
      // Always include node-fetch-native to fix giget and c12 import issues
      if (!externalArray.includes("node-fetch-native")) {
        externalArray.push("node-fetch-native");
      }
      buildConfig.external = externalArray;
    } else {
      // Always include node-fetch-native even if no external deps are specified
      buildConfig.external = ["node-fetch-native"];
    }
    if (bytecode) {
      buildConfig.bytecode = bytecode;
    }
    if (drop) {
      buildConfig.drop = Array.isArray(drop) ? drop : [drop];
    }
    if (packages) {
      buildConfig.packages = packages;
    }
    if (publicPath) {
      buildConfig.publicPath = publicPath;
    }
    if (root) {
      buildConfig.root = root;
    }
    if (define) {
      buildConfig.define = define;
    }
    if (naming) {
      buildConfig.naming = naming;
    }
    if (env) {
      buildConfig.env = env;
    }
    if (banner) {
      buildConfig.banner = banner;
    }
    if (footer) {
      buildConfig.footer = footer;
    }
    if (conditions) {
      buildConfig.conditions = Array.isArray(conditions)
        ? conditions
        : [conditions];
    }
    if (loader) {
      buildConfig.loader = loader;
    }
    if (ignoreDCEAnnotations !== undefined) {
      buildConfig.ignoreDCEAnnotations = ignoreDCEAnnotations;
    }
    if (emitDCEAnnotations !== undefined) {
      buildConfig.emitDCEAnnotations = emitDCEAnnotations;
    }
    if (throwOnError !== undefined) {
      buildConfig.throw = throwOnError;
    }

    // Add new Bun bundler features
    if (mergedOptions.noBundle) {
      buildConfig.noBundle = true;
    }
    if (mergedOptions.reactFastRefresh) {
      buildConfig.reactFastRefresh = true;
    }
    if (mergedOptions.noClearScreen) {
      buildConfig.noClearScreen = true;
    }
    if (mergedOptions.windowsHideConsole) {
      buildConfig.windowsHideConsole = true;
    }
    if (mergedOptions.windowsIcon) {
      buildConfig.windowsIcon = mergedOptions.windowsIcon;
    }
    if (mergedOptions.windowsTitle) {
      buildConfig.windowsTitle = mergedOptions.windowsTitle;
    }
    if (mergedOptions.windowsPublisher) {
      buildConfig.windowsPublisher = mergedOptions.windowsPublisher;
    }
    if (mergedOptions.windowsVersion) {
      buildConfig.windowsVersion = mergedOptions.windowsVersion;
    }
    if (mergedOptions.windowsDescription) {
      buildConfig.windowsDescription = mergedOptions.windowsDescription;
    }
    if (mergedOptions.windowsCopyright) {
      buildConfig.windowsCopyright = mergedOptions.windowsCopyright;
    }
    if (mergedOptions.app) {
      buildConfig.app = true;
    }
    if (mergedOptions.serverComponents) {
      buildConfig.serverComponents = true;
    }
    if (mergedOptions.debugDumpServerFiles) {
      buildConfig.debugDumpServerFiles = true;
    }
    if (mergedOptions.debugNoMinify) {
      buildConfig.debugNoMinify = true;
    }

    // Add enhanced features
    if (macros) {
      buildConfig.macros = true;
    }
    if (sideEffects !== undefined) {
      buildConfig.sideEffects = sideEffects;
    }

    // Debug logging for native app
    if (pkg.name === "@reliverse/native-app-example") {
      await relinka.info(
        `🔍 Final build config: ${JSON.stringify(buildConfig, null, 2)}`,
      );
    }

    // Choose bundler based on effective bundler
    if (effectiveBundler === "mkdist") {
      return await buildWithMkdist(pkg, mergedOptions, buildConfig);
    }

    const result = await Bun.build(buildConfig);

    const buildTime = Date.now() - startTime;

    // Calculate bundle size
    let bundleSize = 0;
    const outputFiles: string[] = [];

    if (result.outputs) {
      for (const output of result.outputs) {
        if (output.path) {
          try {
            const stats = statSync(output.path);
            bundleSize += stats.size;
            outputFiles.push(output.path);
          } catch {
            // Ignore file stat errors
          }
        }
      }
    }

    if (!result.success) {
      const errors = extractErrors(result.logs);
      const warnings = extractWarnings(result.logs);

      if (verbose) {
        await relinka.error(`❌ ${pkg.name}: Build failed (${buildTime}ms)`);
        for (const error of errors) {
          await relinka.error(`   ${error}`);
        }
        if (warnings.length > 0) {
          await relinka.warn(`   Warnings:`);
          for (const warning of warnings) {
            await relinka.warn(`   ${warning}`);
          }
        }
      }

      return {
        package: pkg,
        success: false,
        skipped: false,
        output: formatLogMessages(result.logs),
        errors,
        warnings,
        buildTime,
        bundleSize,
      };
    }

    // Build Go binaries if Go files are detected (skip if tsOnly is set)
    if (result.success) {
      await handleGoBuild(pkg, mergedOptions, verbose);
    } else if (verbose && pkg.hasGoFiles) {
      await relinka.info(
        `⏭️  ${pkg.name}: Skipping Go build (TypeScript build failed)`,
      );
    }

    // Process assets for frontend apps
    if (isFrontendApp) {
      try {
        await processAssetsForPackage(pkg, pkg.outputDir, assets);
        await processCSSForPackage(pkg, pkg.outputDir, shouldUseCssChunking);
        await processHTMLForPackage(pkg, pkg.outputDir, {
          minify:
            typeof minify === "boolean"
              ? minify
              : (minify?.whitespace ?? false),
          injectAssets: true,
          publicPath: publicPath || "/",
        });
      } catch (error) {
        await relinka.warn(
          `⚠️  ${pkg.name}: Asset processing failed - ${error}`,
        );
      }
    }

    // Execute plugin onBuildEnd hooks
    for (const plugin of activePlugins) {
      if (plugin.onBuildEnd) {
        try {
          await plugin.onBuildEnd(
            {
              package: pkg,
              success: true,
              skipped: false,
              output: formatLogMessages(result.logs),
              errors: [],
              warnings: extractWarnings(result.logs),
              buildTime,
              bundleSize,
            },
            mergedOptions,
          );
        } catch (error) {
          await relinka.warn(
            `⚠️  ${pkg.name}: Plugin ${plugin.name} onBuildEnd failed - ${error}`,
          );
        }
      }
    }

    // Cache successful build
    if (cache) {
      await cache.set(pkg, mergedOptions, {
        buildTime,
        bundleSize,
        outputFiles,
      });
    }

    // After successful build, check if compilation is requested
    if (mergedOptions.compile && result.success && result.outputs) {
      await compileToExecutable(pkg, result.outputs, mergedOptions);
    }

    // Prepare package.json for publishing (runs for all successful builds)
    // This includes adding the files field, transforming exports, etc.
    if (result.success) {
      try {
        const prepResult = await preparePackageJsonForPublishing(pkg.path, {
          kind: mergedOptions.kind,
          binDefinitions: mergedOptions.bin,
          access: "public",
          addPublishConfig: true,
          transformExports: mergedOptions.replaceExports === true,
        });

        if (!prepResult.success) {
          await relinka.warn(
            `⚠️  ${pkg.name}: Failed to prepare package.json for publishing: ${prepResult.error}`,
          );
        } else if (verbose) {
          await relinka.info(
            `📦 ${pkg.name}: Package.json prepared for publishing`,
          );
        }
      } catch (error) {
        await relinka.warn(
          `⚠️  ${pkg.name}: Error preparing package.json for publishing: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (verbose) {
      await relinka.success(
        `✅ ${pkg.name}: Built successfully (${buildTime}ms, ${formatBytes(bundleSize)})`,
      );
    }

    return {
      package: pkg,
      success: true,
      skipped: false,
      output: formatLogMessages(result.logs),
      errors: [],
      warnings: extractWarnings(result.logs),
      buildTime,
      bundleSize,
    };
  } catch (error) {
    const buildTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await relinka.error(`❌ ${pkg.name}: Build failed - ${errorMessage}`);

    return {
      package: pkg,
      success: false,
      skipped: false,
      output: errorMessage,
      errors: [errorMessage],
      warnings: [],
      buildTime,
      bundleSize: 0,
    };
  }
};

// ============================================================================
// Watch Mode Implementation
// ============================================================================
// Watch mode is now implemented in watch.ts

// ============================================================================
// Result Collection
// ============================================================================

const collectAllResults = async (
  packages: PackageInfo[],
  options: BuildOptions = {},
  cache?: BuildCache,
): Promise<BuildSummary> => {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    stopOnError = false,
    verbose = false,
    watch = false,
  } = options;

  if (watch) {
    // Use the new watch mode implementation
    await startWatchMode(packages, options);
    return new Promise(() => {
      // This will keep the process alive for watch mode
    });
  }

  // Log progress for package processing
  if (!verbose) {
    await relinka.info(`Building ${packages.length} packages...`);
  }

  try {
    const buildResults = await pMap(
      packages,
      async (pkg, index) => {
        if (!verbose) {
          await relinka.info(
            `Building ${pkg.name} (${index + 1}/${packages.length})...`,
          );
        }
        return buildPackage(pkg, options, cache);
      },
      {
        concurrency,
        stopOnError,
      },
    );

    const failedPackages = buildResults.filter(
      (r) => !r.success && !r.skipped,
    ).length;
    const successfulPackages = buildResults.filter((r) => r.success).length;
    const skippedPackages = buildResults.filter((r) => r.skipped).length;
    const totalBuildTime = buildResults.reduce(
      (sum, r) => sum + r.buildTime,
      0,
    );
    const totalBundleSize = buildResults.reduce(
      (sum, r) => sum + (r.bundleSize || 0),
      0,
    );
    const cacheHits = buildResults.filter((r) => r.cacheHit).length;

    return {
      totalPackages: packages.length,
      failedPackages,
      successfulPackages,
      skippedPackages,
      hasErrors: failedPackages > 0,
      results: buildResults,
      totalBuildTime,
      totalBundleSize,
      cacheHits,
    };
  } catch (error) {
    // Handle aggregate errors from pMap when stopOnError is false
    if (error instanceof AggregateError) {
      const buildResults: BuildResult[] = error.errors.map((err, index) => {
        const pkg = packages[index];
        if (!pkg) {
          throw new Error(`Package at index ${index} not found`);
        }

        if (verbose) {
          void relinka.error(
            `❌ ${pkg.name}: Aggregate error - ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        return {
          package: pkg,
          success: false,
          skipped: false,
          output: err instanceof Error ? err.message : String(err),
          errors: [err instanceof Error ? err.message : String(err)],
          warnings: [],
          buildTime: 0,
        };
      });

      const failedPackages = buildResults.filter(
        (r) => !r.success && !r.skipped,
      ).length;
      const successfulPackages = buildResults.filter((r) => r.success).length;
      const skippedPackages = buildResults.filter((r) => r.skipped).length;
      const totalBuildTime = buildResults.reduce(
        (sum, r) => sum + r.buildTime,
        0,
      );
      const totalBundleSize = buildResults.reduce(
        (sum, r) => sum + (r.bundleSize || 0),
        0,
      );
      const cacheHits = buildResults.filter((r) => r.cacheHit).length;

      return {
        totalPackages: packages.length,
        failedPackages,
        successfulPackages,
        skippedPackages,
        hasErrors: failedPackages > 0,
        results: buildResults,
        totalBuildTime,
        totalBundleSize,
        cacheHits,
      };
    }

    // Re-throw other errors
    throw error;
  }
};

// ============================================================================
// Output Formatting
// ============================================================================

const formatOutput = async (
  summary: BuildSummary,
  verbose: boolean,
): Promise<void> => {
  const {
    totalPackages,
    failedPackages,
    successfulPackages,
    skippedPackages,
    totalBuildTime,
    totalBundleSize,
    cacheHits,
  } = summary;

  // Summary header
  await relinka.log("━".repeat(60));
  await relinka.log(`📦 Build Summary:`);
  await relinka.log(`   Total packages: ${totalPackages}`);
  await relinka.log(`   ✅ Built: ${successfulPackages}`);
  await relinka.log(`   ❌ Failed: ${failedPackages}`);
  await relinka.log(`   ⏭️  Skipped: ${skippedPackages}`);
  if (cacheHits > 0) {
    await relinka.log(`   ⚡ Cache hits: ${cacheHits}`);
  }
  await relinka.log(`   ⏱️  Total time: ${totalBuildTime}ms`);
  await relinka.log(`   📦 Total size: ${formatBytes(totalBundleSize)}`);
  await relinka.log("━".repeat(60));

  // Failed packages
  const failed = summary.results.filter((r) => !r.success && !r.skipped);

  if (failed.length > 0) {
    await relinka.error("\n❌ Failed Packages:\n");

    for (const result of failed) {
      await relinka.error(`📦 ${result.package.name} (${result.buildTime}ms)`);
      await relinka.error(
        `   Entry points: ${result.package.entryPoints.join(", ")}`,
      );
      await relinka.error(`   Output dir: ${result.package.outputDir}`);

      if (result.errors.length > 0) {
        await relinka.error("   ─".repeat(30));
        const errorLines = result.errors.map((error) => `   ${error}`);
        writeErrorLines(errorLines);
        await relinka.error("");
      }
    }
  }

  if (verbose) {
    // Successful packages
    const successful = summary.results.filter((r) => r.success && !r.skipped);

    if (successful.length > 0) {
      await relinka.success("\n✅ Successful Packages:\n");
      for (const result of successful) {
        const sizeInfo = result.bundleSize
          ? `, ${formatBytes(result.bundleSize)}`
          : "";
        const cacheInfo = result.cacheHit ? " (cached)" : "";
        await relinka.success(
          `   • ${result.package.name} (${result.buildTime}ms${sizeInfo})${cacheInfo}`,
        );
        if (result.warnings.length > 0) {
          await relinka.log(`     Warnings: ${result.warnings.length}`);
        }
      }
    }

    // Skipped packages
    const skipped = summary.results.filter((r) => r.skipped);

    if (skipped.length > 0) {
      await relinka.info("\n⏭️  Skipped Packages (no entry points):\n");
      for (const result of skipped) {
        await relinka.info(`   • ${result.package.name}`);
      }
    }

    await relinka.log("");
  }
};

// ============================================================================
// Main Entry Point
// ============================================================================

export const runBuildOnAllPackages = async (
  ignore?: string | string[],
  cwd?: string,
  options: BuildOptions = {},
): Promise<BuildSummary> => {
  const {
    verbose = false,
    watch = false,
    cache: enableCache = true,
    noCache = false,
    devServer = false,
    port = 3000,
    open = false,
    allowPrivateBuild,
    filter,
  } = options;

  // Initialize cache
  const cache = enableCache && !noCache ? new BuildCache() : undefined;

  // Log discovery start
  if (verbose) {
    await relinka.info("🔍 Discovering workspace packages...");
  }

  // Execute the main logic
  const result = await (async (): Promise<BuildSummary> => {
    // Discover packages
    const allPackages = await getWorkspacePackages(cwd);

    if (verbose) {
      await relinka.info(`   Found ${allPackages.length} packages`);

      // Check if dler config was loaded
      const dlerConfig = await loadDlerConfig(cwd);
      if (dlerConfig?.build) {
        await relinka.info("   📋 Using dler.ts configuration");
        if (dlerConfig.build.global) {
          await relinka.info("     Global config: ✅");
        }
        if (dlerConfig.build.packages) {
          await relinka.info(
            `     Package configs: ${Object.keys(dlerConfig.build.packages).length}`,
          );
        }
        if (dlerConfig.build.patterns) {
          await relinka.info(
            `     Pattern configs: ${dlerConfig.build.patterns.length}`,
          );
        }
      } else {
        await relinka.info(
          "   ⚙️  No dler.ts found, using default configuration",
        );
      }

      await relinka.info("   Packages found:");
      for (const pkg of allPackages) {
        const entryStatus = pkg.entryPoints.length > 0 ? "✅" : "⏭️";
        const configSource = pkg.buildConfig ? "📋" : "⚙️";
        const frontendStatus = pkg.isFrontendApp ? "🌐" : "📦";
        const htmlStatus = pkg.hasHtmlEntry ? "📄" : "";
        const cliStatus = pkg.isCLI ? "⚡" : "";
        await relinka.info(
          `     ${entryStatus} ${configSource} ${frontendStatus}${htmlStatus}${cliStatus} ${pkg.name} (${pkg.entryPoints.length} entry points)`,
        );
        if (pkg.entryPoints.length > 0) {
          await relinka.info(
            `       Entry points: ${pkg.entryPoints.join(", ")}`,
          );
          await relinka.info(`       Output dir: ${pkg.outputDir}`);
          if (pkg.isFrontendApp) {
            await relinka.info(`       Type: Frontend app`);
            if (pkg.hasHtmlEntry) await relinka.info(`       HTML entry: ✅`);
            if (pkg.hasPublicDir) await relinka.info(`       Public dir: ✅`);
          } else if (pkg.isCLI) {
            await relinka.info(
              `       Type: CLI${pkg.entryPoints.length > 1 ? " (with library exports)" : ""}`,
            );
          } else {
            await relinka.info(`       Type: Library`);
          }
          if (pkg.buildConfig) {
            await relinka.info(
              `       Build config: ${JSON.stringify(pkg.buildConfig, null, 2)
                .split("\n")
                .map((line) => `         ${line}`)
                .join("\n")}`,
            );
          }
        }
      }
      await relinka.info("");
    }

    // Apply filters
    const packages = filterPackages(
      allPackages,
      ignore,
      allowPrivateBuild,
      filter,
    );
    const filteredCount = allPackages.length - packages.length;

    if (filter) {
      const patterns = normalizePatterns(filter);
      await relinka.info(
        `   Filtering to ${packages.length} packages matching: ${patterns.join(", ")}`,
      );
    } else if (filteredCount > 0) {
      const combinedIgnore = ignore
        ? Array.isArray(ignore)
          ? [...ALWAYS_IGNORED_PACKAGES, ...ignore]
          : [...ALWAYS_IGNORED_PACKAGES, ignore]
        : ALWAYS_IGNORED_PACKAGES;

      const patterns = normalizePatterns(combinedIgnore);
      await relinka.info(
        `   Ignoring ${filteredCount} packages matching: ${patterns.join(", ")}`,
      );
    }

    const { concurrency = DEFAULT_CONCURRENCY, stopOnError = false } = options;
    await relinka.info(
      `   Building ${packages.length} packages (concurrency: ${concurrency}, stopOnError: ${stopOnError})...\n`,
    );

    if (watch || devServer) {
      // Dev server mode
      if (devServer) {
        const frontendPackages = packages.filter(
          (pkg) => pkg.isFrontendApp || pkg.hasHtmlEntry,
        );

        if (frontendPackages.length === 0) {
          await relinka.warn("⚠️  No frontend packages found for dev server");
          await relinka.info(
            "   Dev server works best with packages that have HTML entry points",
          );
        }

        await relinka.info(
          `🚀 Starting dev server for ${frontendPackages.length} frontend packages...`,
        );

        try {
          await startDevServer(frontendPackages, options, {
            port,
            open,
            hmr: true,
          });

          // Keep the process running
          return new Promise(() => {
            // This will keep the process alive for dev server mode
          });
        } catch (error) {
          await relinka.error(`❌ Failed to start dev server: ${error}`);
          throw error;
        }
      }

      // Regular watch mode
      return collectAllResults(packages, options);
    }

    if (verbose) {
      await relinka.info("🚀 Starting build process...\n");
    }

    const summary = await collectAllResults(packages, options, cache);

    // Display results
    await formatOutput(summary, verbose);

    return summary;
  })();

  return result;
};
