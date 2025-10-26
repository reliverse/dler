// apps/dler/src/cmds/perf/analysis/bundle.ts

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type {
  BundleAnalysisResult,
  DuplicateInfo,
  FileSize,
  ModuleInfo,
} from "../types";

export interface BundleAnalysisOptions {
  target: string;
  verbose?: boolean;
  includeSourceMaps?: boolean;
  analyzeDependencies?: boolean;
}

export class BundleAnalyzer {
  private options: BundleAnalysisOptions;

  constructor(options: BundleAnalysisOptions) {
    this.options = options;
  }

  async analyze(): Promise<BundleAnalysisResult> {
    const startTime = Date.now();
    const { target, verbose } = this.options;

    if (verbose) {
      logger.info(`🔍 Analyzing bundle: ${target}`);
    }

    // Check if target is a file or directory
    const targetPath = resolve(target);
    if (!existsSync(targetPath)) {
      throw new Error(`Target not found: ${target}`);
    }

    const stat = statSync(targetPath);
    let files: string[] = [];

    if (stat.isDirectory()) {
      files = await this.findBundleFiles(targetPath);
    } else {
      files = [targetPath];
    }

    if (files.length === 0) {
      throw new Error(`No bundle files found in: ${target}`);
    }

    if (verbose) {
      logger.info(`   Found ${files.length} bundle files`);
    }

    // Analyze each file
    const fileSizes: FileSize[] = [];
    const modules: ModuleInfo[] = [];
    const duplicates: DuplicateInfo[] = [];

    for (const file of files) {
      const fileSize = await this.analyzeFile(file);
      fileSizes.push(fileSize);

      if (this.options.analyzeDependencies) {
        const fileModules = await this.extractModules(file);
        modules.push(...fileModules);
      }
    }

    // Sort by size
    fileSizes.sort((a, b) => b.size - a.size);

    // Find duplicates
    if (this.options.analyzeDependencies) {
      const duplicateMap = this.findDuplicates(modules);
      duplicates.push(...duplicateMap);
    }

    // Calculate totals
    const totalSize = fileSizes.reduce((sum, file) => sum + file.size, 0);
    const fileCount = fileSizes.length;

    // Calculate compression potential
    const compressionPotential = this.calculateCompressionPotential(files);

    // Update percentages
    fileSizes.forEach((file) => {
      file.percentage = (file.size / totalSize) * 100;
    });

    const analysisTime = Date.now() - startTime;

    if (verbose) {
      logger.info(`   Analysis completed in ${analysisTime}ms`);
    }

    return {
      target,
      totalSize,
      fileCount,
      largestFiles: fileSizes.slice(0, 10), // Top 10
      modules: modules.slice(0, 20), // Top 20 modules
      duplicates: duplicates.slice(0, 10), // Top 10 duplicates
      compressionPotential,
      analysisTime,
    };
  }

  private async findBundleFiles(dir: string): Promise<string[]> {
    const bundleExtensions = [".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx"];
    const files: string[] = [];

    try {
      const glob = new Bun.Glob("**/*");
      const matches = glob.scanSync({ cwd: dir, onlyFiles: true });

      for (const match of matches) {
        const fullPath = join(dir, match);
        const ext = extname(match);

        if (bundleExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.warn(`Error scanning directory ${dir}:`, error);
    }

    return files;
  }

  private async analyzeFile(filePath: string): Promise<FileSize> {
    const stat = statSync(filePath);
    const ext = extname(filePath);

    return {
      path: filePath,
      size: stat.size,
      percentage: 0, // Will be calculated later
      type: this.getFileType(ext),
    };
  }

  private getFileType(extension: string): string {
    const typeMap: Record<string, string> = {
      ".js": "JavaScript",
      ".mjs": "ES Module",
      ".cjs": "CommonJS",
      ".ts": "TypeScript",
      ".jsx": "React JSX",
      ".tsx": "React TSX",
      ".json": "JSON",
      ".css": "CSS",
      ".scss": "SCSS",
      ".sass": "Sass",
      ".less": "Less",
      ".html": "HTML",
      ".svg": "SVG",
      ".png": "PNG",
      ".jpg": "JPEG",
      ".jpeg": "JPEG",
      ".gif": "GIF",
      ".webp": "WebP",
      ".woff": "WOFF",
      ".woff2": "WOFF2",
      ".ttf": "TrueType",
      ".eot": "EOT",
      ".map": "Source Map",
    };

    return typeMap[extension] ?? "Unknown";
  }

  private async extractModules(filePath: string): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];

    try {
      const content = readFileSync(filePath, "utf-8");

      // Simple regex-based module extraction
      // This is a basic implementation - in practice, you'd want to use a proper AST parser
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      const dependencies = new Set<string>();

      // Extract ES6 imports
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        dependencies.add(match[1]!);
      }

      // Extract CommonJS requires
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.add(match[1]!);
      }

      // Extract dynamic imports
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        dependencies.add(match[1]!);
      }

      // Convert to ModuleInfo
      for (const dep of dependencies) {
        const isExternal = !dep.startsWith(".") && !dep.startsWith("/");

        modules.push({
          name: dep,
          size: 0, // Would need to resolve actual size
          percentage: 0,
          dependencies: [],
          isExternal,
        });
      }
    } catch (error) {
      logger.warn(`Error extracting modules from ${filePath}:`, error);
    }

    return modules;
  }

  private findDuplicates(modules: ModuleInfo[]): DuplicateInfo[] {
    const moduleMap = new Map<
      string,
      { count: number; totalSize: number; locations: string[] }
    >();

    for (const module of modules) {
      const key = module.name;
      const existing = moduleMap.get(key);

      if (existing) {
        existing.count++;
        existing.totalSize += module.size;
        existing.locations.push(module.name);
      } else {
        moduleMap.set(key, {
          count: 1,
          totalSize: module.size,
          locations: [module.name],
        });
      }
    }

    const duplicates: DuplicateInfo[] = [];

    for (const [name, info] of moduleMap) {
      if (info.count > 1) {
        duplicates.push({
          name,
          count: info.count,
          totalSize: info.totalSize,
          locations: info.locations,
        });
      }
    }

    return duplicates.sort((a, b) => b.totalSize - a.totalSize);
  }

  private calculateCompressionPotential(files: string[]): number {
    // Simple heuristic based on file types
    let totalSize = 0;
    let compressibleSize = 0;

    for (const file of files) {
      const stat = statSync(file);
      const ext = extname(file);

      totalSize += stat.size;

      // Files that typically compress well
      const compressibleExtensions = [
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".json",
        ".css",
        ".html",
        ".svg",
      ];
      if (compressibleExtensions.includes(ext)) {
        compressibleSize += stat.size;
      }
    }

    if (totalSize === 0) return 0;

    // Estimate 60-80% compression for text files
    const estimatedCompression = compressibleSize * 0.7;
    return (estimatedCompression / totalSize) * 100;
  }
}

export const analyzeBundle = async (
  options: BundleAnalysisOptions,
): Promise<BundleAnalysisResult> => {
  const analyzer = new BundleAnalyzer(options);
  return analyzer.analyze();
};

export const createBundleAnalyzer = (
  options: BundleAnalysisOptions,
): BundleAnalyzer => {
  return new BundleAnalyzer(options);
};
