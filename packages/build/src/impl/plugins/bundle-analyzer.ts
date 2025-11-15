// packages/build/src/impl/plugins/bundle-analyzer.ts

import { existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { BuildResult, BunBuildConfig, DlerPlugin } from "../types";

export const BundleAnalyzerPlugin: DlerPlugin = {
  name: "bundle-analyzer",
  setup: (buildConfig?: BunBuildConfig) => {
    if (buildConfig?.verbose) {
      logger.debug("Bundle analyzer plugin registered");
    }
  },
  onBuildEnd: async (result: BuildResult) => {
    if (!result.success || result.skipped) {
      return;
    }

    try {
      await analyzeBundle(result);
    } catch (error) {
      logger.warn(
        `Failed to analyze bundle for ${result.package.name}: ${error}`,
      );
    }
  },
};

async function analyzeBundle(result: BuildResult): Promise<void> {
  const pkg = result.package;
  const outputDir = pkg.outputDir;

  if (!existsSync(outputDir)) {
    return;
  }

  // Find all output files
  const glob = new Bun.Glob("**/*");
  const files = Array.from(glob.scanSync({ cwd: outputDir, onlyFiles: true }));

  const analysis = {
    package: pkg.name,
    timestamp: new Date().toISOString(),
    files: [] as Array<{
      name: string;
      size: number;
      type: string;
      gzippedSize?: number;
    }>,
    totals: {
      totalSize: 0,
      totalFiles: 0,
      jsFiles: 0,
      cssFiles: 0,
      assetFiles: 0,
    },
    recommendations: [] as string[],
  };

  // Analyze each file
  for (const file of files) {
    const filePath = join(outputDir, file);
    const stats = statSync(filePath);
    const ext = file.split(".").pop()?.toLowerCase() || "";

    const fileInfo = {
      name: file,
      size: stats.size,
      type: getFileType(ext),
    };

    analysis.files.push(fileInfo);
    analysis.totals.totalSize += stats.size;
    analysis.totals.totalFiles++;

    // Categorize files
    if (ext === "js" || ext === "mjs") {
      analysis.totals.jsFiles++;
    } else if (ext === "css") {
      analysis.totals.cssFiles++;
    } else {
      analysis.totals.assetFiles++;
    }
  }

  // Sort files by size (largest first)
  analysis.files.sort((a, b) => b.size - a.size);

  // Generate recommendations
  generateRecommendations(analysis);

  // Write analysis report
  const reportPath = join(outputDir, "bundle-analysis.json");
  writeFileSync(reportPath, JSON.stringify(analysis, null, 2));

  // Log summary
  logger.info(`📊 Bundle analysis for ${pkg.name}:`);
  logger.info(`   Total size: ${formatBytes(analysis.totals.totalSize)}`);
  logger.info(
    `   Files: ${analysis.totals.totalFiles} (${analysis.totals.jsFiles} JS, ${analysis.totals.cssFiles} CSS, ${analysis.totals.assetFiles} assets)`,
  );

  if (analysis.files.length > 0) {
    const largestFile = analysis.files[0];
    if (largestFile) {
      logger.info(
        `   Largest file: ${largestFile.name} (${formatBytes(largestFile.size)})`,
      );
    }
  }

  if (analysis.recommendations.length > 0) {
    logger.info(`   Recommendations:`);
    for (const rec of analysis.recommendations) {
      logger.info(`     • ${rec}`);
    }
  }

  logger.info(`   Report saved to: ${reportPath}`);
}

function getFileType(ext: string): string {
  const typeMap: Record<string, string> = {
    js: "JavaScript",
    mjs: "JavaScript (ESM)",
    css: "CSS",
    png: "Image (PNG)",
    jpg: "Image (JPEG)",
    jpeg: "Image (JPEG)",
    gif: "Image (GIF)",
    svg: "Image (SVG)",
    webp: "Image (WebP)",
    woff: "Font (WOFF)",
    woff2: "Font (WOFF2)",
    ttf: "Font (TTF)",
    eot: "Font (EOT)",
    html: "HTML",
    json: "JSON",
    txt: "Text",
  };

  return typeMap[ext] || "Unknown";
}

function generateRecommendations(analysis: any): void {
  const { totals, files } = analysis;

  // Check bundle size
  if (totals.totalSize > 1024 * 1024) {
    // 1MB
    analysis.recommendations.push(
      "Bundle size is large (>1MB). Consider code splitting or removing unused code.",
    );
  }

  // Check for large individual files
  const largeFiles = files.filter((f: any) => f.size > 500 * 1024); // 500KB
  if (largeFiles.length > 0) {
    analysis.recommendations.push(
      `Large files detected: ${largeFiles.map((f: any) => f.name).join(", ")}. Consider optimizing or splitting.`,
    );
  }

  // Check for too many files
  if (totals.totalFiles > 50) {
    analysis.recommendations.push(
      "Many files in bundle. Consider consolidating or using code splitting.",
    );
  }

  // Check JS/CSS ratio
  if (totals.jsFiles > 0 && totals.cssFiles > 0) {
    const jsSize = files
      .filter((f: any) => f.type.includes("JavaScript"))
      .reduce((sum: number, f: any) => sum + f.size, 0);
    const cssSize = files
      .filter((f: any) => f.type.includes("CSS"))
      .reduce((sum: number, f: any) => sum + f.size, 0);

    if (cssSize > jsSize) {
      analysis.recommendations.push(
        "CSS is larger than JavaScript. Consider CSS optimization or purging unused styles.",
      );
    }
  }

  // Check for duplicate file types
  const fileTypes = new Map<string, number>();
  files.forEach((f: any) => {
    fileTypes.set(f.type, (fileTypes.get(f.type) || 0) + 1);
  });

  for (const [type, count] of fileTypes) {
    if (count > 10) {
      analysis.recommendations.push(
        `Many ${type} files (${count}). Consider consolidating.`,
      );
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
