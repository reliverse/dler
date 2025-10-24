// apps/dler/src/cmds/perf/analysis/filesystem.ts

import { existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type {
  DirectorySize,
  FileSize,
  FileSystemAnalysisResult,
  FileTypeDistribution,
} from "../types";
import { formatBytes } from "../utils/formatter";

export interface FileSystemAnalysisOptions {
  target: string;
  verbose?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
}

export class FileSystemAnalyzer {
  private options: FileSystemAnalysisOptions;
  private fileCount = 0;
  private totalSize = 0;
  private directoryCount = 0;
  private maxDepth = 0;
  private files: FileSize[] = [];
  private directories: DirectorySize[] = [];
  private fileTypes = new Map<string, { count: number; totalSize: number }>();

  constructor(options: FileSystemAnalysisOptions) {
    this.options = options;
  }

  async analyze(): Promise<FileSystemAnalysisResult> {
    const startTime = Date.now();
    const { target, verbose } = this.options;

    if (verbose) {
      logger.info(`🔍 Analyzing filesystem: ${target}`);
    }

    // Check if target exists
    const targetPath = resolve(target);
    if (!existsSync(targetPath)) {
      throw new Error(`Target not found: ${target}`);
    }

    const stat = statSync(targetPath);

    if (stat.isFile()) {
      await this.analyzeFile(targetPath, 0);
    } else {
      await this.analyzeDirectory(targetPath, 0);
    }

    // Sort results
    this.files.sort((a, b) => b.size - a.size);
    this.directories.sort((a, b) => b.size - a.size);

    // Calculate file type distribution
    const fileTypeDistribution: FileTypeDistribution[] = Array.from(
      this.fileTypes.entries(),
    )
      .map(([extension, info]) => ({
        extension,
        count: info.count,
        totalSize: info.totalSize,
        percentage: (info.totalSize / this.totalSize) * 100,
      }))
      .sort((a, b) => b.totalSize - a.totalSize);

    // Calculate compression potential
    const compressionPotential = this.calculateCompressionPotential();

    const analysisTime = Date.now() - startTime;

    if (verbose) {
      logger.info(`   Analysis completed in ${analysisTime}ms`);
      logger.info(
        `   Files: ${this.fileCount}, Directories: ${this.directoryCount}, Size: ${formatBytes(this.totalSize)}`,
      );
    }

    return {
      target,
      totalFiles: this.fileCount,
      totalSize: this.totalSize,
      directoryCount: this.directoryCount,
      maxDepth: this.maxDepth,
      largestFiles: this.files.slice(0, 20), // Top 20
      largestDirectories: this.directories.slice(0, 20), // Top 20
      fileTypes: fileTypeDistribution,
      compressionPotential,
      analysisTime,
    };
  }

  private async analyzeFile(filePath: string, depth: number): Promise<void> {
    try {
      const stat = statSync(filePath);
      const ext = extname(filePath);

      // Check exclude patterns
      if (this.shouldExclude(filePath)) {
        return;
      }

      this.fileCount++;
      this.totalSize += stat.size;
      this.maxDepth = Math.max(this.maxDepth, depth);

      // Add to files list
      this.files.push({
        path: filePath,
        size: stat.size,
        percentage: 0, // Will be calculated later
        type: this.getFileType(ext),
      });

      // Update file type statistics
      const extension = ext || "no-extension";
      const existing = this.fileTypes.get(extension);
      if (existing) {
        existing.count++;
        existing.totalSize += stat.size;
      } else {
        this.fileTypes.set(extension, {
          count: 1,
          totalSize: stat.size,
        });
      }
    } catch (error) {
      // Skip files we can't access
      if (this.options.verbose) {
        logger.warn(`Cannot access file ${filePath}:`, error);
      }
    }
  }

  private async analyzeDirectory(
    dirPath: string,
    depth: number,
  ): Promise<void> {
    try {
      this.directoryCount++;
      this.maxDepth = Math.max(this.maxDepth, depth);

      // Check exclude patterns
      if (this.shouldExclude(dirPath)) {
        return;
      }

      let dirSize = 0;
      let dirFileCount = 0;

      // Scan directory contents
      const glob = new Bun.Glob("**/*");
      const matches = glob.scanSync({
        cwd: dirPath,
        onlyFiles: false,
        dot: this.options.includeHidden ?? false,
      });

      for (const match of matches) {
        const fullPath = join(dirPath, match);

        try {
          const stat = statSync(fullPath);

          if (stat.isFile()) {
            await this.analyzeFile(fullPath, depth + 1);
            dirSize += stat.size;
            dirFileCount++;
          } else if (stat.isDirectory()) {
            await this.analyzeDirectory(fullPath, depth + 1);
          }
        } catch (error) {
          // Skip files/directories we can't access
          if (this.options.verbose) {
            logger.warn(`Cannot access ${fullPath}:`, error);
          }
        }
      }

      // Add directory to list
      this.directories.push({
        path: dirPath,
        size: dirSize,
        fileCount: dirFileCount,
        depth,
      });
    } catch (error) {
      // Skip directories we can't access
      if (this.options.verbose) {
        logger.warn(`Cannot access directory ${dirPath}:`, error);
      }
    }
  }

  private shouldExclude(path: string): boolean {
    const { excludePatterns = [] } = this.options;

    for (const pattern of excludePatterns) {
      if (path.includes(pattern)) {
        return true;
      }
    }

    // Default exclusions
    const defaultExclusions = [
      "node_modules",
      ".git",
      ".next",
      ".nuxt",
      ".expo",
      "dist",
      "build",
      "coverage",
      ".cache",
      ".turbo",
    ];

    for (const exclusion of defaultExclusions) {
      if (path.includes(exclusion)) {
        return true;
      }
    }

    return false;
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
      ".d.ts": "TypeScript Declarations",
      ".md": "Markdown",
      ".txt": "Text",
      ".yml": "YAML",
      ".yaml": "YAML",
      ".xml": "XML",
      ".pdf": "PDF",
      ".zip": "ZIP",
      ".tar": "TAR",
      ".gz": "GZIP",
    };

    return typeMap[extension] ?? "Unknown";
  }

  private calculateCompressionPotential(): number {
    if (this.totalSize === 0) return 0;

    let compressibleSize = 0;

    for (const [extension, info] of this.fileTypes) {
      // Files that typically compress well
      const compressibleExtensions = [
        ".js",
        ".mjs",
        ".cjs",
        ".ts",
        ".jsx",
        ".tsx",
        ".json",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".html",
        ".svg",
        ".md",
        ".txt",
        ".yml",
        ".yaml",
        ".xml",
      ];

      if (compressibleExtensions.includes(extension)) {
        compressibleSize += info.totalSize;
      }
    }

    // Estimate 60-80% compression for text files
    const estimatedCompression = compressibleSize * 0.7;
    return (estimatedCompression / this.totalSize) * 100;
  }
}

export const analyzeFileSystem = async (
  options: FileSystemAnalysisOptions,
): Promise<FileSystemAnalysisResult> => {
  const analyzer = new FileSystemAnalyzer(options);
  return analyzer.analyze();
};

export const createFileSystemAnalyzer = (
  options: FileSystemAnalysisOptions,
): FileSystemAnalyzer => {
  return new FileSystemAnalyzer(options);
};
