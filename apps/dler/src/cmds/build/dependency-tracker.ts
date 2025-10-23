// apps/dler/src/cmds/build/dependency-tracker.ts

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";

export interface DependencyInfo {
  filePath: string;
  hash: string;
  dependencies: string[];
  lastModified: number;
}

export interface DependencyGraph {
  [filePath: string]: DependencyInfo;
}

export class DependencyTracker {
  private graph: DependencyGraph = {};
  private visitedFiles = new Set<string>();

  async trackDependencies(entryPoints: string[]): Promise<DependencyGraph> {
    this.graph = {};
    this.visitedFiles.clear();

    for (const entryPoint of entryPoints) {
      await this.trackFile(entryPoint);
    }

    return this.graph;
  }

  private async trackFile(filePath: string): Promise<void> {
    if (this.visitedFiles.has(filePath) || !existsSync(filePath)) {
      return;
    }

    this.visitedFiles.add(filePath);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const stats = require('node:fs').statSync(filePath);
      
      const dependencies = await this.extractDependencies(filePath, content);
      
      this.graph[filePath] = {
        filePath,
        hash,
        dependencies,
        lastModified: stats.mtime.getTime(),
      };

      // Recursively track dependencies
      for (const dep of dependencies) {
        await this.trackFile(dep);
      }
    } catch (error) {
      logger.warn(`Failed to track file ${filePath}: ${error}`);
    }
  }

  private async extractDependencies(filePath: string, content: string): Promise<string[]> {
    const dependencies: string[] = [];
    const dir = resolve(filePath, '..');

    // Extract import/require statements
    const importRegex = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (importPath && typeof importPath === 'string') {
        const resolvedPath = this.resolveImportPath(importPath, dir);
        if (resolvedPath && existsSync(resolvedPath)) {
          dependencies.push(resolvedPath);
        }
      }
    }

    // Extract dynamic imports (already captured in main regex, but just to be explicit)
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath) {
        const resolvedPath = this.resolveImportPath(importPath, dir);
        if (resolvedPath && existsSync(resolvedPath)) {
          dependencies.push(resolvedPath);
        }
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private resolveImportPath(importPath: string, fromDir: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return resolve(fromDir, importPath);
    }

    // Handle absolute imports (skip node_modules for now)
    if (importPath.startsWith('/')) {
      return importPath;
    }

    // Handle package imports - for now, skip these as they're external
    // In a full implementation, you'd resolve these to actual file paths
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    return null;
  }

  getFileHash(filePath: string): string | null {
    return this.graph[filePath]?.hash || null;
  }

  getDependencies(filePath: string): string[] {
    return this.graph[filePath]?.dependencies || [];
  }

  getAllDependencies(filePath: string): string[] {
    const visited = new Set<string>();
    const deps: string[] = [];

    const collectDeps = (currentPath: string) => {
      if (visited.has(currentPath)) return;
      visited.add(currentPath);

      const fileDeps = this.getDependencies(currentPath);
      for (const dep of fileDeps) {
        deps.push(dep);
        collectDeps(dep);
      }
    };

    collectDeps(filePath);
    return deps;
  }

  hasFileChanged(filePath: string): boolean {
    if (!existsSync(filePath)) return true;
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const currentHash = createHash('sha256').update(content).digest('hex');
      const cachedHash = this.getFileHash(filePath);
      
      return currentHash !== cachedHash;
    } catch {
      return true;
    }
  }

  hasAnyDependencyChanged(filePath: string): boolean {
    const deps = this.getAllDependencies(filePath);
    
    for (const dep of deps) {
      if (this.hasFileChanged(dep)) {
        return true;
      }
    }
    
    return false;
  }

  getGraph(): DependencyGraph {
    return { ...this.graph };
  }
}
