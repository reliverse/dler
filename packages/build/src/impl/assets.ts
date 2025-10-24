// packages/build/src/impl/assets.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { AssetOptions, PackageInfo } from "./types";

export interface AssetProcessor {
  processAssets(pkg: PackageInfo, outputDir: string, options?: AssetOptions): Promise<void>;
}

export class DefaultAssetProcessor implements AssetProcessor {
  async processAssets(
    pkg: PackageInfo, 
    outputDir: string, 
    options: AssetOptions = {}
  ): Promise<void> {
    const { publicPath = "/", copyFiles = [], imageOptimization = false } = options;

    // Copy public directory assets
    if (pkg.hasPublicDir) {
      await this.copyPublicAssets(pkg, outputDir, publicPath);
    }

    // Copy additional files specified in options
    if (copyFiles.length > 0) {
      await this.copyAdditionalFiles(pkg, outputDir, copyFiles, publicPath);
    }

    // Process images if optimization is enabled
    if (imageOptimization) {
      await this.optimizeImages(pkg, outputDir);
    }
  }

  private async copyPublicAssets(
    pkg: PackageInfo, 
    outputDir: string, 
    publicPath: string
  ): Promise<void> {
    const publicDir = join(pkg.path, "public");
    
    if (!existsSync(publicDir)) {
      return;
    }

    const publicOutputDir = join(outputDir, publicPath.replace(/^\//, ""));
    await this.copyDirectory(publicDir, publicOutputDir);
    
    logger.info(`📁 Copied public assets to ${publicOutputDir}`);
  }

  private async copyAdditionalFiles(
    pkg: PackageInfo,
    outputDir: string,
    copyFiles: string[],
    publicPath: string
  ): Promise<void> {
    for (const filePattern of copyFiles) {
      const sourcePath = resolve(pkg.path, filePattern);
      
      if (existsSync(sourcePath)) {
        const fileName = basename(sourcePath);
        const destPath = join(outputDir, publicPath.replace(/^\//, ""), fileName);
        
        // Ensure destination directory exists
        mkdirSync(dirname(destPath), { recursive: true });
        
        copyFileSync(sourcePath, destPath);
        logger.info(`📄 Copied ${filePattern} to ${destPath}`);
      }
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    // Use Bun's glob to find all files in the source directory
    const glob = new Bun.Glob("**/*");
    const files = Array.from(glob.scanSync({ cwd: src, onlyFiles: true }));

    for (const file of files) {
      const srcPath = join(src, file);
      const destPath = join(dest, file);
      
      // Ensure destination directory exists
      mkdirSync(dirname(destPath), { recursive: true });
      
      copyFileSync(srcPath, destPath);
    }
  }

  private async optimizeImages(_pkg: PackageInfo, _outputDir: string): Promise<void> {
    // This is a placeholder for image optimization
    // In the future, we would use libraries like sharp or imagemin
    logger.info("🖼️  Image optimization is not yet implemented");
  }
}

export class CSSProcessor {
  async processCSS(_pkg: PackageInfo, outputDir: string, cssChunking: boolean = false): Promise<void> {
    if (!cssChunking) {
      return;
    }

    // Find all CSS files in the output directory
    const glob = new Bun.Glob("**/*.css");
    const cssFiles = Array.from(glob.scanSync({ cwd: outputDir, onlyFiles: true }));

    if (cssFiles.length === 0) {
      return;
    }

    logger.info(`🎨 Processing ${cssFiles.length} CSS files for chunking`);

    try {
      // Read all CSS files
      const cssContents: Array<{ file: string; content: string }> = [];
      for (const cssFile of cssFiles) {
        const fullPath = join(outputDir, cssFile);
        const content = readFileSync(fullPath, 'utf-8');
        cssContents.push({ file: cssFile, content });
      }

      // Extract common styles and create chunks
      const chunks = this.createCSSChunks(cssContents);

      // Write chunked CSS files
      for (const [chunkName, content] of Object.entries(chunks)) {
        const chunkPath = join(outputDir, `${chunkName}.css`);
        writeFileSync(chunkPath, content, 'utf-8');
        logger.info(`   📄 Created CSS chunk: ${chunkName}.css`);
      }

      // Update original files to reference chunks
      await this.updateCSSReferences(cssFiles, chunks, outputDir);

    } catch (error) {
      logger.warn(`CSS chunking failed: ${error}`);
    }
  }

  private createCSSChunks(cssContents: Array<{ file: string; content: string }>): Record<string, string> {
    const chunks: Record<string, string> = {};
    
    // Simple chunking strategy: group by common prefixes
    const commonStyles = new Map<string, string[]>();
    
    for (const { content } of cssContents) {
      const lines = content.split('\n');
      const commonPrefix = this.extractCommonPrefix(lines);
      
      if (!commonStyles.has(commonPrefix)) {
        commonStyles.set(commonPrefix, []);
      }
      commonStyles.get(commonPrefix)!.push(content);
    }

    // Create chunks
    let chunkIndex = 0;
    for (const [prefix, styles] of commonStyles) {
      const chunkName = prefix ? `chunk-${prefix}` : `chunk-${chunkIndex}`;
      chunks[chunkName] = styles.join('\n\n');
      chunkIndex++;
    }

    return chunks;
  }

  private extractCommonPrefix(lines: string[]): string {
    // Extract common CSS selectors/patterns
    const selectors = lines
      .filter(line => line.trim().startsWith('.') || line.trim().startsWith('#'))
      .map(line => line.trim().split(' ')[0])
      .filter(Boolean);

    if (selectors.length === 0) return '';

    // Find common prefix
    const firstSelector = selectors[0];
    if (!firstSelector) return '';
    
    let commonPrefix = '';
    
    for (let i = 0; i < firstSelector.length; i++) {
      const char = firstSelector[i];
      if (selectors.every(selector => selector && selector[i] === char)) {
        commonPrefix += char;
      } else {
        break;
      }
    }

    return commonPrefix.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  private async updateCSSReferences(cssFiles: string[], _chunks: Record<string, string>, _outputDir: string): Promise<void> {
    // This would update HTML files to reference the new CSS chunks
    // For now, we'll just log what would be updated
    logger.info(`   📝 Would update ${cssFiles.length} CSS files to reference chunks`);
  }
}

export class AssetManifest {
  private manifest: Record<string, string> = {};
  private reverseManifest: Record<string, string> = {};

  addAsset(originalPath: string, hashedPath: string): void {
    this.manifest[originalPath] = hashedPath;
    this.reverseManifest[hashedPath] = originalPath;
  }

  getAssetPath(originalPath: string): string {
    return this.manifest[originalPath] || originalPath;
  }

  getOriginalPath(hashedPath: string): string {
    return this.reverseManifest[hashedPath] || hashedPath;
  }

  async writeManifest(outputDir: string): Promise<void> {
    const manifestPath = join(outputDir, "asset-manifest.json");
    const manifestData = {
      files: this.manifest,
      reverse: this.reverseManifest,
      timestamp: Date.now(),
    };
    writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
    logger.info(`📋 Asset manifest written to ${manifestPath}`);
  }

  async loadManifest(outputDir: string): Promise<void> {
    const manifestPath = join(outputDir, "asset-manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const manifestData = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        this.manifest = manifestData.files || {};
        this.reverseManifest = manifestData.reverse || {};
      } catch (error) {
        logger.warn(`Failed to load asset manifest: ${error}`);
      }
    }
  }
}

export async function processAssetsForPackage(
  pkg: PackageInfo,
  outputDir: string,
  options: AssetOptions = {}
): Promise<void> {
  const processor = new DefaultAssetProcessor();
  await processor.processAssets(pkg, outputDir, options);
}

export async function processCSSForPackage(
  pkg: PackageInfo,
  outputDir: string,
  cssChunking: boolean = false
): Promise<void> {
  const processor = new CSSProcessor();
  await processor.processCSS(pkg, outputDir, cssChunking);
}
