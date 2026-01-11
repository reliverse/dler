// apps/dler/src/cmds/unused/impl.ts

import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createIncludeFilter } from "@reliverse/matcha";
import path from "@reliverse/pathkit";
import { logger } from "@reliverse/relinka";
import { hasWorkspaces, readPackageJSON } from "@reliverse/typerso";

export interface UnusedOptions {
  target?: string;
  w?: boolean;
  scope?: "dev" | "prod" | "peer" | "optional";
  ignore?: string[];
  includePeer: boolean;
  cwd?: string;
  verbose: boolean;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  rootPath: string;
  rootPackageJson: any;
  workspacePackages?: string[];
}

// ============================================================================
// Monorepo Detection (reused from add command)
// ============================================================================

// Cache for monorepo detection results
const monorepoCache = new Map<string, MonorepoInfo>();

async function detectMonorepo(startDir?: string): Promise<MonorepoInfo> {
  const cwd = resolve(startDir ?? process.cwd());

  // Check cache first
  if (monorepoCache.has(cwd)) {
    return monorepoCache.get(cwd)!;
  }

  let currentDir = cwd;

  // Walk up the directory tree looking for workspaces
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (existsSync(packageJsonPath)) {
      const packageJson = await readPackageJSON(currentDir);

      if (packageJson && hasWorkspaces(packageJson)) {
        // Found monorepo root
        const workspacePackages = await discoverWorkspacePackages(currentDir, packageJson);
        const result = {
          isMonorepo: true,
          rootPath: currentDir,
          rootPackageJson: packageJson,
          workspacePackages,
        };
        // Cache the result
        monorepoCache.set(cwd, result);
        return result;
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // No monorepo found, treat as single package
  const packageJsonPath = path.join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error("No package.json found in current directory or any parent directory");
  }

  const packageJson = await readPackageJSON(cwd);
  if (!packageJson) {
    throw new Error("Could not read package.json");
  }

  const result = {
    isMonorepo: false,
    rootPath: cwd,
    rootPackageJson: packageJson,
  };

  // Cache the result
  monorepoCache.set(cwd, result);
  return result;
}

// Cache for workspace packages
const workspaceCache = new Map<string, string[]>();

// ============================================================================
// Build Tool Detection
// ============================================================================

function hasBiomeConfig(rootPath: string): boolean {
  return (
    existsSync(path.join(rootPath, "biome.json")) || existsSync(path.join(rootPath, "biome.jsonc"))
  );
}

function hasTurboConfig(rootPath: string): boolean {
  return existsSync(path.join(rootPath, "turbo.json"));
}

async function discoverWorkspacePackages(
  monorepoRoot: string,
  rootPackageJson: any
): Promise<string[]> {
  // Check cache first
  if (workspaceCache.has(monorepoRoot)) {
    return workspaceCache.get(monorepoRoot)!;
  }

  const packages: string[] = [];

  if (!rootPackageJson.workspaces?.packages) {
    workspaceCache.set(monorepoRoot, packages);
    return packages;
  }

  const patterns = Array.isArray(rootPackageJson.workspaces.packages)
    ? rootPackageJson.workspaces.packages
    : [];

  // Batch read all package.json files to reduce I/O operations
  const packagePaths: string[] = [];
  const validationPromises: Promise<boolean>[] = [];

  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // Handle glob patterns
      const glob = new Bun.Glob(pattern);
      const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

      for (const match of matches) {
        const packagePath = resolve(monorepoRoot, match);
        packagePaths.push(packagePath);
        validationPromises.push(isValidWorkspacePackage(packagePath));
      }
    } else {
      // Handle direct paths
      const packagePath = resolve(monorepoRoot, pattern);
      packagePaths.push(packagePath);
      validationPromises.push(isValidWorkspacePackage(packagePath));
    }
  }

  // Wait for all validations to complete
  const validationResults = await Promise.all(validationPromises);

  // Collect valid packages
  for (let i = 0; i < packagePaths.length; i++) {
    if (validationResults[i]) {
      packages.push(packagePaths[i]!);
    }
  }

  // Cache the result
  workspaceCache.set(monorepoRoot, packages);
  return packages;
}

async function isValidWorkspacePackage(packagePath: string): Promise<boolean> {
  const packageJsonPath = path.join(packagePath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = await readPackageJSON(packagePath);
  return !!packageJson?.name;
}

// ============================================================================
// Target Package Resolution (adapted from add command)
// ============================================================================

function containsGlobPattern(str: string): boolean {
  return str.includes("*") || str.includes("?") || str.includes("[") || str.includes("{");
}

function containsMultipleTargets(str: string): boolean {
  return str.includes(" ") && str.trim().split(/\s+/).length > 1;
}

interface TargetPackageInfo {
  packagePath: string;
  packageJson: any;
}

interface MultipleTargetsInfo {
  targets: TargetPackageInfo[];
  isMultiple: true;
}

interface PackageInfo {
  name: string;
  path: string;
  json: any;
  packagePath: string;
  packageJson: any;
}

// Cache for package info
const packageInfoCache = new Map<string, PackageInfo[]>();

async function getPackageInfo(monorepoInfo: MonorepoInfo): Promise<PackageInfo[]> {
  if (packageInfoCache.has(monorepoInfo.rootPath)) {
    return packageInfoCache.get(monorepoInfo.rootPath)!;
  }

  const packages: PackageInfo[] = [];

  if (monorepoInfo.isMonorepo) {
    // Add root package if it has dependencies
    if (hasDependencies(monorepoInfo.rootPackageJson)) {
      packages.push({
        name: monorepoInfo.rootPackageJson.name || "root",
        path: monorepoInfo.rootPath,
        json: monorepoInfo.rootPackageJson,
        packagePath: monorepoInfo.rootPath,
        packageJson: monorepoInfo.rootPackageJson,
      });
    }

    // Add workspace packages
    if (monorepoInfo.workspacePackages) {
      for (const packagePath of monorepoInfo.workspacePackages) {
        const packageJson = await readPackageJSON(packagePath);
        if (packageJson && hasDependencies(packageJson)) {
          packages.push({
            name: packageJson.name || "unnamed",
            path: packagePath,
            json: packageJson,
            packagePath,
            packageJson,
          });
        }
      }
    }
  } else {
    // Single package
    packages.push({
      name: monorepoInfo.rootPackageJson.name || "project",
      path: monorepoInfo.rootPath,
      json: monorepoInfo.rootPackageJson,
      packagePath: monorepoInfo.rootPath,
      packageJson: monorepoInfo.rootPackageJson,
    });
  }

  packageInfoCache.set(monorepoInfo.rootPath, packages);
  return packages;
}

function hasDependencies(packageJson: any): boolean {
  return !!(
    packageJson.dependencies ||
    packageJson.devDependencies ||
    packageJson.peerDependencies ||
    packageJson.optionalDependencies
  );
}

async function resolveTargetPackages(
  monorepoInfo: MonorepoInfo,
  targetOption?: string,
  w?: boolean
): Promise<TargetPackageInfo[]> {
  const allPackages = await getPackageInfo(monorepoInfo);

  if (!(targetOption || w)) {
    // Default: check current directory package, or all packages if in monorepo root
    const currentDir = process.cwd();
    const currentPackage = allPackages.find((pkg) => pkg.path === currentDir);

    if (currentPackage) {
      return [currentPackage];
    }

    // If not in a specific package, check all packages
    return allPackages;
  }

  if (w) {
    // Root package only
    const rootPackage = allPackages.find((pkg) => pkg.path === monorepoInfo.rootPath);
    return rootPackage ? [rootPackage] : [];
  }

  if (targetOption) {
    if (containsGlobPattern(targetOption) || containsMultipleTargets(targetOption)) {
      // Handle glob patterns or multiple targets
      const targets: string[] = [];
      if (containsMultipleTargets(targetOption)) {
        targets.push(...targetOption.trim().split(/\s+/));
      } else {
        targets.push(targetOption);
      }

      const matchedPackages: TargetPackageInfo[] = [];
      const filter = createIncludeFilter(targets);

      const matchingPackages = filter(allPackages);
      matchedPackages.push(...matchingPackages);

      return matchedPackages;
    } else {
      // Single target
      const pkg = allPackages.find(
        (p) =>
          p.name === targetOption ||
          relative(monorepoInfo.rootPath, p.path) === targetOption ||
          p.path === resolve(monorepoInfo.rootPath, targetOption)
      );

      return pkg ? [pkg] : [];
    }
  }

  return [];
}

// ============================================================================
// Source Code Analysis
// ============================================================================

interface DependencyUsage {
  [packageName: string]: {
    used: boolean;
    locations: string[];
  };
}

function getSourceFiles(packagePath: string, rootPath: string): string[] {
  const files: string[] = [];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

  const skipDirs = ["node_modules", ".git", "dist", "build", ".cache", "coverage", ".turbo"];

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!skipDirs.includes(entry)) {
            scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(entry);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  scanDir(packagePath);
  return files;
}

function analyzePackageScripts(packageJson: any): Set<string> {
  const usedPackages = new Set<string>();

  if (packageJson.scripts) {
    for (const script of Object.values(packageJson.scripts) as string[]) {
      // Check for build tool usage in scripts
      const buildTools = ["biome", "turbo", "ultracite"];
      for (const tool of buildTools) {
        if (script.includes(tool)) {
          // Handle scoped packages
          if (tool === "biome") {
            usedPackages.add("@biomejs/biome");
          } else {
            usedPackages.add(tool);
          }
        }
      }
    }
  }

  return usedPackages;
}

function analyzeSourceFile(filePath: string, packageJson: any): Set<string> {
  const usedPackages = new Set<string>();
  const packageName = packageJson.name || "";

  try {
    const content = require("node:fs").readFileSync(filePath, "utf8");

    // Common import patterns
    const importPatterns = [
      // ES6 imports
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      // Dynamic imports
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Require statements
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // TypeScript type imports
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of importPatterns) {
      let match = pattern.exec(content);
      while (match !== null) {
        const importedPackage = match[1];

        if (!importedPackage) continue;

        // Skip relative imports and file extensions
        if (!(importedPackage.startsWith(".") || path.extname(importedPackage))) {
          // Handle scoped packages (@scope/package -> @scope/package)
          // Handle sub-path imports (package/subpath -> package)
          const basePackage = importedPackage.split("/")[0];
          if (basePackage && basePackage.startsWith("@")) {
            // Scoped package - take first two parts
            const parts = importedPackage.split("/");
            if (parts.length >= 2) {
              usedPackages.add(`${parts[0]}/${parts[1]}`);
            }
          } else if (basePackage) {
            usedPackages.add(basePackage);
          }
        }
        match = pattern.exec(content);
      }
    }

    // Also check for package.json references in code (like bin scripts, etc.)
    if (content.includes(packageName)) {
      // If the package references itself, that's not a dependency usage
      usedPackages.delete(packageName);
    }
  } catch (error) {
    // Skip files we can't read
  }

  return usedPackages;
}

function collectAllDependencies(
  packageJson: any,
  scope?: "dev" | "prod" | "peer" | "optional",
  includePeer: boolean = false
): { [key: string]: string } {
  const allDeps: { [key: string]: string } = {};

  const depTypes = [
    { key: "dependencies", type: "prod" },
    { key: "devDependencies", type: "dev" },
    { key: "peerDependencies", type: "peer" },
    { key: "optionalDependencies", type: "optional" },
  ];

  for (const { key, type } of depTypes) {
    if (packageJson[key] && (!scope || scope === type)) {
      if (type === "peer" && !includePeer) {
        continue; // Skip peer dependencies unless explicitly requested
      }
      Object.assign(allDeps, packageJson[key]);
    }
  }

  return allDeps;
}

// ============================================================================
// Main Function
// ============================================================================

export async function findUnusedDependencies(options: UnusedOptions): Promise<void> {
  const monorepoInfo = await detectMonorepo(options.cwd);
  const targetPackages = await resolveTargetPackages(monorepoInfo, options.target, options.w);

  if (targetPackages.length === 0) {
    logger.warn("No packages found to analyze");
    return;
  }

  // Check configuration files
  const hasBiome = hasBiomeConfig(monorepoInfo.rootPath);
  const hasTurbo = hasTurboConfig(monorepoInfo.rootPath);

  let totalUnused = 0;
  const results: Array<{
    packageName: string;
    packagePath: string;
    unusedDeps: Array<{ name: string; scope: string; version: string }>;
  }> = [];

  for (const targetPackage of targetPackages) {
    if (options.verbose) {
      logger.log(`Analyzing ${targetPackage.packageJson.name || "unnamed package"}...`);
    }

    const sourceFiles = getSourceFiles(targetPackage.packagePath, monorepoInfo.rootPath);
    const usedPackages = new Set<string>();

    // Analyze all source files
    for (const file of sourceFiles) {
      const fileUsedPackages = analyzeSourceFile(file, targetPackage.packageJson);
      for (const pkg of fileUsedPackages) {
        usedPackages.add(pkg);
      }
    }

    // Analyze package.json scripts for build tool usage
    const scriptUsedPackages = analyzePackageScripts(targetPackage.packageJson);
    for (const pkg of scriptUsedPackages) {
      usedPackages.add(pkg);
    }

    // Add build tools detected via configuration files
    if (hasBiome) {
      usedPackages.add("@biomejs/biome");
      usedPackages.add("ultracite"); // ultracite is the biome preset system
    }
    if (hasTurbo) {
      usedPackages.add("turbo");
    }

    // Get all dependencies based on scope filter
    const allDeps = collectAllDependencies(
      targetPackage.packageJson,
      options.scope,
      options.includePeer
    );

    // Find unused dependencies
    const unusedDeps: Array<{ name: string; scope: string; version: string }> = [];

    for (const [depName, depVersion] of Object.entries(allDeps)) {
      // Skip ignored packages
      if (options.ignore?.includes(depName)) {
        continue;
      }

      // Check if dependency is used
      if (!usedPackages.has(depName)) {
        // Determine which scope this dependency belongs to
        let scope = "unknown";
        if (targetPackage.packageJson.dependencies?.[depName]) {
          scope = "prod";
        } else if (targetPackage.packageJson.devDependencies?.[depName]) {
          scope = "dev";
        } else if (targetPackage.packageJson.peerDependencies?.[depName]) {
          scope = "peer";
        } else if (targetPackage.packageJson.optionalDependencies?.[depName]) {
          scope = "optional";
        }

        unusedDeps.push({
          name: depName,
          scope,
          version: depVersion as string,
        });
      }
    }

    if (unusedDeps.length > 0) {
      results.push({
        packageName: targetPackage.packageJson.name || "unnamed package",
        packagePath: targetPackage.packagePath,
        unusedDeps,
      });
      totalUnused += unusedDeps.length;
    }
  }

  // Display results
  if (results.length === 0) {
    logger.success("✅ No unused dependencies found!");
    return;
  }

  logger.log(`\n📦 Found ${totalUnused} unused dependencies across ${results.length} packages:\n`);

  // Group unused dependencies by package for better rm command suggestions
  const packageSuggestions: Array<{
    packageName: string;
    packagePath: string;
    relativePath: string;
    depsByScope: Record<string, string[]>;
    allDeps: Array<{ name: string; scope: string; version: string }>;
  }> = [];

  for (const result of results) {
    const relativePath = relative(process.cwd(), result.packagePath);
    const depsByScope: Record<string, string[]> = {};
    const allDeps: Array<{ name: string; scope: string; version: string }> = [];

    for (const dep of result.unusedDeps) {
      if (!depsByScope[dep.scope]) {
        depsByScope[dep.scope] = [];
      }
      depsByScope[dep.scope]!.push(dep.name);
      allDeps.push(dep);
    }

    packageSuggestions.push({
      packageName: result.packageName,
      packagePath: result.packagePath,
      relativePath,
      depsByScope,
      allDeps,
    });
  }

  // Display results with package details
  for (const suggestion of packageSuggestions) {
    logger.log(`📁 ${suggestion.packageName} (${suggestion.relativePath}):`);

    for (const dep of suggestion.allDeps) {
      logger.log(`  ❌ ${dep.name}@${dep.version} (${dep.scope})`);
    }
    logger.log("");
  }

  // Generate specific dler rm commands for each package
  logger.log("🔧 Suggested removal commands:");

  for (const suggestion of packageSuggestions) {
    const packageTarget =
      suggestion.relativePath === "package.json" ? "." : suggestion.relativePath;

    // Group by scope for cleaner commands
    for (const [scope, deps] of Object.entries(suggestion.depsByScope)) {
      if (deps.length > 0) {
        const scopeFlag = scope === "prod" ? "" : ` --${scope}`;
        const depList = deps.join(" ");
        logger.log(`  bun dler rm ${depList} --target "${packageTarget}"${scopeFlag}`);
      }
    }

    logger.log("");
  }

  logger.log(`💡 Use --ignore flag to exclude specific packages from analysis`);
  logger.log(
    `💡 If some dep is used, but was marked as unused, please create an issue: https://github.com/reliverse/dler/issues`
  );
}
