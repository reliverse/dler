// apps/dler/src/cmds/build/html-processor.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { PackageInfo } from "./types";

export interface HTMLProcessorOptions {
  minify?: boolean;
  injectAssets?: boolean;
  publicPath?: string;
}

export class HTMLProcessor {
  private options: HTMLProcessorOptions;

  constructor(options: HTMLProcessorOptions = {}) {
    this.options = {
      minify: false,
      injectAssets: true,
      publicPath: '/',
      ...options,
    };
  }

  async processHTML(pkg: PackageInfo, outputDir: string): Promise<void> {
    const htmlFiles = pkg.entryPoints.filter(ep => ep.endsWith('.html'));
    
    if (htmlFiles.length === 0) {
      return;
    }

    for (const htmlFile of htmlFiles) {
      await this.processHTMLFile(htmlFile, outputDir);
    }
  }

  private async processHTMLFile(htmlPath: string, outputDir: string): Promise<void> {
    try {
      const content = readFileSync(htmlPath, 'utf-8');
      let processedContent = content;

      // Extract and process script tags
      processedContent = await this.processScriptTags(processedContent, htmlPath, outputDir);

      // Extract and process link tags (CSS)
      processedContent = await this.processLinkTags(processedContent, htmlPath, outputDir);

      // Inject built assets if enabled
      if (this.options.injectAssets) {
        processedContent = await this.injectBuiltAssets(processedContent, outputDir);
      }

      // Minify HTML if enabled
      if (this.options.minify) {
        processedContent = this.minifyHTML(processedContent);
      }

      // Write processed HTML to output directory
      const outputFileName = basename(htmlPath);
      const outputPath = join(outputDir, outputFileName);
      writeFileSync(outputPath, processedContent, 'utf-8');

      logger.info(`📄 Processed HTML: ${htmlPath} → ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to process HTML file ${htmlPath}: ${error}`);
    }
  }

  private async processScriptTags(content: string, htmlPath: string, outputDir: string): Promise<string> {
    const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
    
    return content.replace(scriptRegex, (match, src) => {
      // Check if this is a local script file
      if (src.startsWith('./') || src.startsWith('../') || src.startsWith('/')) {
        const scriptPath = resolve(dirname(htmlPath), src);
        
        // Check if the script was built and exists in output
        const builtScriptPath = this.findBuiltAsset(scriptPath, outputDir, ['.js', '.mjs']);
        if (builtScriptPath) {
          const relativePath = this.getRelativePath(htmlPath, builtScriptPath);
          return match.replace(src, relativePath);
        }
      }
      
      return match;
    });
  }

  private async processLinkTags(content: string, htmlPath: string, outputDir: string): Promise<string> {
    const linkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/g;
    
    return content.replace(linkRegex, (match, href) => {
      // Check if this is a local CSS file
      if (href.startsWith('./') || href.startsWith('../') || href.startsWith('/')) {
        const cssPath = resolve(dirname(htmlPath), href);
        
        // Check if the CSS was built and exists in output
        const builtCssPath = this.findBuiltAsset(cssPath, outputDir, ['.css']);
        if (builtCssPath) {
          const relativePath = this.getRelativePath(htmlPath, builtCssPath);
          return match.replace(href, relativePath);
        }
      }
      
      return match;
    });
  }

  private async injectBuiltAssets(content: string, outputDir: string): Promise<string> {
    // Find all built JS files
    const jsFiles = this.findBuiltFiles(outputDir, ['.js', '.mjs']);
    const cssFiles = this.findBuiltFiles(outputDir, ['.css']);

    let injectedContent = content;

    // Inject CSS files
    if (cssFiles.length > 0) {
      const cssLinks = cssFiles.map(cssFile => {
        const relativePath = this.getRelativePathFromOutput(cssFile, outputDir);
        return `    <link rel="stylesheet" href="${relativePath}">`;
      }).join('\n');

      // Insert before closing </head> tag
      injectedContent = injectedContent.replace(
        /<\/head>/i,
        `${cssLinks}\n  </head>`
      );
    }

    // Inject JS files
    if (jsFiles.length > 0) {
      const jsScripts = jsFiles.map(jsFile => {
        const relativePath = this.getRelativePathFromOutput(jsFile, outputDir);
        return `    <script src="${relativePath}"></script>`;
      }).join('\n');

      // Insert before closing </body> tag
      injectedContent = injectedContent.replace(
        /<\/body>/i,
        `${jsScripts}\n  </body>`
      );
    }

    return injectedContent;
  }

  private findBuiltAsset(originalPath: string, outputDir: string, extensions: string[]): string | null {
    const baseName = basename(originalPath, extensions.find(ext => originalPath.endsWith(ext)) || '');
    
    for (const ext of extensions) {
      const possiblePath = join(outputDir, `${baseName}${ext}`);
      if (existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return null;
  }

  private findBuiltFiles(outputDir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    try {
      const { readdirSync, statSync } = require('node:fs');
      const items = readdirSync(outputDir);
      
      for (const item of items) {
        const itemPath = join(outputDir, item);
        const stats = statSync(itemPath);
        
        if (stats.isFile()) {
          const ext = extensions.find(e => item.endsWith(e));
          if (ext) {
            files.push(itemPath);
          }
        }
      }
    } catch (error) {
      // Ignore directory read errors
    }

    return files;
  }

  private getRelativePath(fromPath: string, toPath: string): string {
    const fromDir = dirname(fromPath);
    const relativePath = require('node:path').relative(fromDir, toPath);
    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  }

  private getRelativePathFromOutput(filePath: string, outputDir: string): string {
    const relativePath = require('node:path').relative(outputDir, filePath);
    return this.options.publicPath + relativePath.replace(/\\/g, '/');
  }

  private minifyHTML(content: string): string {
    // Basic HTML minification
    return content
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+>/g, '>') // Remove whitespace before closing tags
      .replace(/>\s+/g, '>') // Remove whitespace after opening tags
      .trim();
  }
}

export async function processHTMLForPackage(
  pkg: PackageInfo,
  outputDir: string,
  options: HTMLProcessorOptions = {}
): Promise<void> {
  const processor = new HTMLProcessor(options);
  await processor.processHTML(pkg, outputDir);
}
