// apps/dler/src/cmds/perf/analysis/monorepo.ts

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import { createIgnoreFilter } from "@reliverse/dler-matcher";
import {
  getWorkspacePatterns,
  hasWorkspaces,
  readPackageJSON,
} from "@reliverse/dler-pkg-tsc";
import type {
  Bottleneck,
  CircularDependency,
  DependencyEdge,
  DependencyGraph,
  MonorepoAnalysisResult,
  PackageInfo,
} from "../types";

export interface MonorepoAnalysisOptions {
  cwd?: string;
  ignore?: string | string[];
  verbose?: boolean;
  includeDevDependencies?: boolean;
  analyzeBuildOrder?: boolean;
}

export class MonorepoAnalyzer {
  private options: MonorepoAnalysisOptions;
  private packages: PackageInfo[] = [];
  private dependencyGraph: DependencyGraph = {
    nodes: [],
    edges: [],
    levels: [],
  };

  constructor(options: MonorepoAnalysisOptions) {
    this.options = options;
  }

  async analyze(): Promise<MonorepoAnalysisResult> {
    const startTime = Date.now();
    const { cwd, verbose } = this.options;

    if (verbose) {
      logger.info("🔍 Analyzing monorepo structure...");
    }

    // Find monorepo root or single package
    const monorepoRoot = await this.findMonorepoRoot(cwd);
    
    if (!monorepoRoot) {
      // Not a monorepo, try to analyze single package
      const currentDir = cwd || process.cwd();
      const singlePkg = await this.discoverSinglePackage(currentDir);
      if (singlePkg) {
        this.packages = [singlePkg];
        if (verbose) {
          logger.info(`   Single package root: ${currentDir}`);
          logger.info("   Found 1 package");
        }
      } else {
        throw new Error(
          'No monorepo or valid package found. Ensure package.json has "workspaces" field or contains a valid "name" field.',
        );
      }
    } else {
      if (verbose) {
        logger.info(`   Monorepo root: ${monorepoRoot}`);
      }

      // Discover packages
      this.packages = await this.discoverPackages(monorepoRoot);
    }

    if (verbose) {
      logger.info(`   Found ${this.packages.length} packages`);
    }

    // Build dependency graph
    this.dependencyGraph = await this.buildDependencyGraph();

    // Analyze circular dependencies
    const circularDependencies = this.findCircularDependencies();

    // Calculate build order
    const buildOrder = this.calculateBuildOrder();

    // Find critical path
    const criticalPath = this.findCriticalPath();

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks();

    // Suggest optimal concurrency
    const suggestedConcurrency = this.suggestOptimalConcurrency();

    const analysisTime = Date.now() - startTime;

    if (verbose) {
      logger.info(`   Analysis completed in ${analysisTime}ms`);
    }

    return {
      packages: this.packages,
      dependencies: this.dependencyGraph,
      circularDependencies,
      criticalPath,
      buildOrder,
      bottlenecks,
      suggestedConcurrency,
      analysisTime,
    };
  }

  private async findMonorepoRoot(startDir?: string): Promise<string | null> {
    let currentDir = resolve(startDir ?? process.cwd());

    while (currentDir !== "/") {
      const pkgPath = join(currentDir, "package.json");

      if (existsSync(pkgPath)) {
        const pkg = await readPackageJSON(currentDir);
        if (pkg && hasWorkspaces(pkg)) {
          return currentDir;
        }
      }

      const parentDir = resolve(currentDir, "..");
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    return null;
  }

  private async discoverPackages(monorepoRoot: string): Promise<PackageInfo[]> {
    const rootPkg = await readPackageJSON(monorepoRoot);
    if (!rootPkg) {
      throw new Error("Could not read root package.json");
    }

    const patterns = getWorkspacePatterns(rootPkg);
    if (!patterns.length) {
      throw new Error("No workspace patterns found in package.json");
    }

    const packages: PackageInfo[] = [];
    const seenPaths = new Set<string>();

    for (const pattern of patterns) {
      const glob = new Bun.Glob(pattern);
      const matches = glob.scanSync({ cwd: monorepoRoot, onlyFiles: false });

      for (const match of matches) {
        const packagePath = resolve(monorepoRoot, match);
        if (seenPaths.has(packagePath)) continue;
        seenPaths.add(packagePath);

        const pkgInfo = await this.resolvePackageInfo(packagePath);
        if (pkgInfo) {
          packages.push(pkgInfo);
        }
      }
    }

    // Filter out the monorepo root to prevent analyzing it
    const filteredPackages = packages.filter(pkg => {
      const normalizedPkgPath = resolve(pkg.path);
      const normalizedRootPath = resolve(monorepoRoot);
      return normalizedPkgPath !== normalizedRootPath;
    });

    // Apply ignore filters
    if (this.options.ignore) {
      const ignoreFilter = createIgnoreFilter(this.options.ignore);
      return ignoreFilter(filteredPackages);
    }

    return filteredPackages;
  }

  private async discoverSinglePackage(packagePath: string): Promise<PackageInfo | null> {
    try {
      const pkg = await readPackageJSON(packagePath);
      if (!pkg || !pkg.name) return null;

      const dependencies = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...(this.options.includeDevDependencies
          ? Object.keys(pkg.devDependencies ?? {})
          : []),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ];

      return {
        name: pkg.name,
        path: packagePath,
        dependencies,
        dependents: [], // Will be filled later
        buildTime: 0,
        size: 0,
      };
    } catch {
      return null;
    }
  }

  private async resolvePackageInfo(
    packagePath: string,
  ): Promise<PackageInfo | null> {
    const pkgJsonPath = join(packagePath, "package.json");
    if (!existsSync(pkgJsonPath)) return null;

    try {
      const pkg = await readPackageJSON(packagePath);
      if (!pkg?.name) return null;

      const dependencies = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...(this.options.includeDevDependencies
          ? Object.keys(pkg.devDependencies ?? {})
          : []),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ];

      return {
        name: pkg.name,
        path: packagePath,
        dependencies,
        dependents: [], // Will be filled later
        buildTime: 0, // Would need to measure actual build time
        size: 0, // Would need to calculate package size
      };
    } catch {
      return null;
    }
  }

  private async buildDependencyGraph(): Promise<DependencyGraph> {
    const nodes = this.packages.map((pkg) => pkg.name);
    const edges: DependencyEdge[] = [];

    // Build dependency edges
    for (const pkg of this.packages) {
      for (const dep of pkg.dependencies) {
        // Check if dependency is within the monorepo
        const depPkg = this.packages.find((p) => p.name === dep);
        if (depPkg) {
          edges.push({
            from: pkg.name,
            to: dep,
            type: "dependency",
          });

          // Add to dependents
          depPkg.dependents.push(pkg.name);
        }
      }
    }

    // Calculate levels (topological sort)
    const levels = this.calculateLevels(nodes, edges);

    return {
      nodes,
      edges,
      levels,
    };
  }

  private calculateLevels(
    nodes: string[],
    edges: DependencyEdge[],
  ): string[][] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node, 0);
      graph.set(node, []);
    }

    // Build graph and calculate in-degrees
    for (const edge of edges) {
      const current = inDegree.get(edge.to) ?? 0;
      inDegree.set(edge.to, current + 1);

      const neighbors = graph.get(edge.from) ?? [];
      neighbors.push(edge.to);
      graph.set(edge.from, neighbors);
    }

    // Topological sort
    const levels: string[][] = [];
    const queue: string[] = [];

    // Start with nodes that have no dependencies
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const currentLevel: string[] = [];
      const nextQueue: string[] = [];

      for (const node of queue) {
        currentLevel.push(node);

        // Process neighbors
        const neighbors = graph.get(node) ?? [];
        for (const neighbor of neighbors) {
          const degree = inDegree.get(neighbor) ?? 0;
          inDegree.set(neighbor, degree - 1);

          if (degree - 1 === 0) {
            nextQueue.push(neighbor);
          }
        }
      }

      levels.push(currentLevel);
      queue.length = 0;
      queue.push(...nextQueue);
    }

    return levels;
  }

  private findCircularDependencies(): CircularDependency[] {
    const circular: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const pkg of this.packages) {
      if (!visited.has(pkg.name)) {
        const cycle = this.detectCycle(pkg.name, visited, recursionStack, []);
        if (cycle.length > 0) {
          circular.push({
            packages: cycle,
            cycle,
            severity: this.calculateCycleSeverity(cycle),
          });
        }
      }
    }

    return circular;
  }

  private detectCycle(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
  ): string[] {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const pkg = this.packages.find((p) => p.name === node);
    if (pkg) {
      for (const dep of pkg.dependencies) {
        const depPkg = this.packages.find((p) => p.name === dep);
        if (depPkg) {
          if (!visited.has(dep)) {
            const cycle = this.detectCycle(dep, visited, recursionStack, [
              ...path,
            ]);
            if (cycle.length > 0) {
              return cycle;
            }
          } else if (recursionStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            return path.slice(cycleStart);
          }
        }
      }
    }

    recursionStack.delete(node);
    return [];
  }

  private calculateCycleSeverity(cycle: string[]): "low" | "medium" | "high" {
    if (cycle.length <= 2) return "low";
    if (cycle.length <= 4) return "medium";
    return "high";
  }

  private calculateBuildOrder(): string[] {
    const order: string[] = [];

    for (const level of this.dependencyGraph.levels) {
      order.push(...level);
    }

    return order;
  }

  private findCriticalPath(): string[] {
    // Simple heuristic: packages with the most dependents
    const dependentCounts = new Map<string, number>();

    for (const pkg of this.packages) {
      dependentCounts.set(pkg.name, pkg.dependents.length);
    }

    return Array.from(dependentCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }

  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Find packages with many dependencies
    for (const pkg of this.packages) {
      if (pkg.dependencies.length > 10) {
        bottlenecks.push({
          package: pkg.name,
          type: "many-dependencies",
          impact: pkg.dependencies.length,
          suggestion: `Consider splitting ${pkg.name} - it has ${pkg.dependencies.length} dependencies`,
        });
      }
    }

    // Find circular dependencies
    const circularDeps = this.findCircularDependencies();
    for (const circular of circularDeps) {
      bottlenecks.push({
        package: circular.packages[0]!,
        type: "circular-dependency",
        impact: circular.packages.length,
        suggestion: `Resolve circular dependency: ${circular.cycle.join(" → ")}`,
      });
    }

    // Find slow packages (heuristic based on dependents)
    for (const pkg of this.packages) {
      if (pkg.dependents.length > 5) {
        bottlenecks.push({
          package: pkg.name,
          type: "slow-build",
          impact: pkg.dependents.length,
          suggestion: `Optimize ${pkg.name} - it blocks ${pkg.dependents.length} other packages`,
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private suggestOptimalConcurrency(): number {
    // Simple heuristic based on dependency levels
    const maxLevel = this.dependencyGraph.levels.length;
    const avgLevelSize = this.packages.length / maxLevel;

    // Suggest concurrency based on level size and CPU cores
    const cpuCores = require("node:os").cpus().length;
    const suggested = Math.min(Math.ceil(avgLevelSize), cpuCores);

    return Math.max(1, suggested);
  }
}

export const analyzeMonorepo = async (
  options: MonorepoAnalysisOptions,
): Promise<MonorepoAnalysisResult> => {
  const analyzer = new MonorepoAnalyzer(options);
  return analyzer.analyze();
};

export const createMonorepoAnalyzer = (
  options: MonorepoAnalysisOptions,
): MonorepoAnalyzer => {
  return new MonorepoAnalyzer(options);
};
