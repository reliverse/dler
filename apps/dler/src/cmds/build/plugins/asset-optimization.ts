// apps/dler/src/cmds/build/plugins/asset-optimization.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { BuildResult, BunBuildConfig, DlerPlugin, PackageInfo } from "../types";

export const AssetOptimizationPlugin: DlerPlugin = {
  name: "asset-optimization",
  setup: (buildConfig: BunBuildConfig) => {
    // Configure asset loaders
    buildConfig.loader = {
      ...buildConfig.loader,
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.svg': 'file',
      '.webp': 'file',
      '.ico': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.ttf': 'file',
      '.eot': 'file',
    };
    
    logger.debug("Asset optimization plugin applied");
  },
  onBuildEnd: async (result: BuildResult) => {
    if (!result.success || result.skipped) {
      return;
    }

    const pkg = result.package;
    
    // Only optimize assets for frontend apps
    if (!pkg.isFrontendApp) {
      return;
    }

    try {
      await optimizeAssets(pkg, result);
    } catch (error) {
      logger.warn(`Failed to optimize assets for ${pkg.name}: ${error}`);
    }
  },
};

async function optimizeAssets(pkg: PackageInfo, result: BuildResult): Promise<void> {
  const outputDir = pkg.outputDir;
  
  if (!existsSync(outputDir)) {
    return;
  }

  // Find asset files
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  const assetFiles: string[] = [];

  // Use Bun's glob to find asset files
  const glob = new Bun.Glob("**/*");
  const files = Array.from(glob.scanSync({ cwd: outputDir, onlyFiles: true }));

  for (const file of files) {
    const ext = extname(file);
    if (assetExtensions.includes(ext)) {
      assetFiles.push(join(outputDir, file));
    }
  }

  if (assetFiles.length === 0) {
    return;
  }

  logger.info(`🖼️  Optimizing ${assetFiles.length} assets for ${pkg.name}`);

  // Process each asset
  for (const assetFile of assetFiles) {
    try {
      await optimizeAsset(assetFile);
    } catch (error) {
      logger.warn(`Failed to optimize asset ${assetFile}: ${error}`);
    }
  }
}

async function optimizeAsset(assetPath: string): Promise<void> {
  const ext = extname(assetPath).toLowerCase();
  
  switch (ext) {
    case '.svg':
      await optimizeSVG(assetPath);
      break;
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.webp':
      await optimizeImage(assetPath);
      break;
    case '.woff':
    case '.woff2':
    case '.ttf':
    case '.eot':
      await optimizeFont(assetPath);
      break;
    default:
      // No optimization for this file type
      break;
  }
}

async function optimizeSVG(svgPath: string): Promise<void> {
  const content = readFileSync(svgPath, 'utf-8');
  
  // Basic SVG optimization
  let optimized = content
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s+>/g, '>') // Remove whitespace before closing tags
    .replace(/>\s+/g, '>') // Remove whitespace after opening tags
    .trim();

  // Remove comments
  optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');

  // Remove unnecessary attributes
  optimized = optimized.replace(/\s+(xmlns:xlink|xlink:href)="[^"]*"/g, '');

  if (optimized !== content) {
    writeFileSync(svgPath, optimized, 'utf-8');
    logger.debug(`Optimized SVG: ${basename(svgPath)}`);
  }
}

async function optimizeImage(imagePath: string): Promise<void> {
  // Placeholder for image optimization
  // In the future, we would use libraries like sharp or imagemin
  logger.debug(`Image optimization not implemented for: ${basename(imagePath)}`);
}

async function optimizeFont(fontPath: string): Promise<void> {
  // Placeholder for font optimization
  // In the future, we would use font optimization libraries
  logger.debug(`Font optimization not implemented for: ${basename(fontPath)}`);
}
