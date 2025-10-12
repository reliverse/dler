import { relinka } from "@reliverse/relinka";
import type { Package } from "./monorepo-mod";

export interface GraphNode {
  id: string;
  package: Package;
  children: GraphNode[];
}

export class DependencyGraph {
  private readonly root: GraphNode;
  private readonly nodeMap: Map<string, GraphNode> = new Map();

  constructor(packages: Package[]) {
    // Create root node
    this.root = {
      id: "root",
      package: {
        dir: "",
        name: "root",
        dependencyNames: [],
        config: { cache: false, outDir: "dist", include: [], exclude: [] },
      },
      children: [],
    };

    // Create nodes for all packages
    const nodes = packages.map((pkg) => ({
      id: pkg.name,
      package: pkg,
      children: [],
    }));

    // Add all packages to root
    this.root.children = [...nodes];

    // Build node map
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
    }

    // Add dependency relationships
    for (const pkg of packages) {
      const packageNode = this.nodeMap.get(pkg.name);
      if (!packageNode) continue;

      for (const depName of pkg.dependencyNames) {
        const depNode = this.nodeMap.get(depName);
        if (depNode) {
          packageNode.children.push(depNode);
        }
      }
    }
  }

  /**
   * Get all packages in build order (dependencies first)
   */
  getOverallBuildOrder(): Package[] {
    const visited = new Set<string>();
    const result: Package[] = [];

    for (const child of this.root.children) {
      this.depthFirstSearch(child, visited, result);
    }

    return result;
  }

  /**
   * Get dependencies for a specific package in build order
   */
  getPackageDependenciesBuildOrder(packageName: string): Package[] {
    const node = this.nodeMap.get(packageName);
    if (!node) return [];

    const visited = new Set<string>();
    const result: Package[] = [];

    for (const child of node.children) {
      this.depthFirstSearch(child, visited, result);
    }

    return result;
  }

  /**
   * Find the package that contains the current working directory
   */
  findActivePackage(): Package | null {
    const currentDir = process.cwd();

    for (const node of this.root.children) {
      if (currentDir.startsWith(node.package.dir)) {
        return node.package;
      }
    }

    return null;
  }

  /**
   * Print the dependency graph as a tree
   */
  print(): void {
    relinka("log", "Dependency Graph:");
    this.printNode(this.root, 0, true);
  }

  private depthFirstSearch(node: GraphNode, visited: Set<string>, result: Package[]): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    // Process children first
    for (const child of node.children) {
      this.depthFirstSearch(child, visited, result);
    }

    // Add current node (skip root)
    if (node.id !== "root") {
      result.push(node.package);
    }
  }

  private printNode(node: GraphNode, depth: number, isLast: boolean): void {
    const indent = "│ ".repeat(depth);
    const connector = isLast ? "└" : "├";
    const name = node.id === "root" ? "" : node.id;

    if (name) {
      relinka("log", `${indent}${connector} ${name}`);
    }

    if (node.children.length > 0) {
      const lastIndex = node.children.length - 1;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child) {
          this.printNode(child, depth + 1, i === lastIndex);
        }
      }
    }
  }
}
