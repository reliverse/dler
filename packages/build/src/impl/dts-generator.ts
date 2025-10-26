// packages/build/src/impl/dts-generator.ts

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import { readTSConfig } from "@reliverse/dler-pkg-tsc";
import type { CompilationOptions, EntryPointConfig } from 'dts-bundle-generator';
import type { PackageInfo } from "./types";
import type { DtsOptions } from "@reliverse/dler-config/impl/build";
import { 
  getDeclarations, 
  type MkdistDtsOptions 
} from "./providers/mkdist-dts";

export interface DtsGeneratorOptions {
  /** Package information */
  package: PackageInfo;
  /** DTS configuration options */
  dtsOptions: DtsOptions;
  /** Build format (esm, cjs, iife) */
  format?: "esm" | "cjs" | "iife";
  /** Output directory for built files */
  outputDir: string;
}

export interface DtsGeneratorResult {
  success: boolean;
  outputDir?: string;
  error?: string;
  files?: string[];
}

/**
 * Generate TypeScript declaration files using Rslib's recommended approach
 */
export async function generateDeclarations(
  options: DtsGeneratorOptions,
): Promise<DtsGeneratorResult> {
  const { package: pkg, dtsOptions, format = "esm", outputDir } = options;

  try {
    // Check if declaration generation is enabled
    if (dtsOptions.enable === false) {
      return { success: true };
    }

    // Determine output directory for declarations
    const dtsOutputDir = resolveDtsOutputDir(pkg, dtsOptions, outputDir);

    // Ensure output directory exists
    if (!existsSync(dtsOutputDir)) {
      mkdirSync(dtsOutputDir, { recursive: true });
    }

    // Read and validate tsconfig.json
    const tsconfig = await readTSConfig(pkg.path);
    if (!tsconfig) {
      return {
        success: false,
        error: "No tsconfig.json found",
      };
    }

    // Enforce required compiler options for declaration generation
    const enforcedOptions = enforceDeclarationOptions(tsconfig, dtsOptions, format);

    // Route to appropriate provider
    const provider = dtsOptions.provider || 'dts-bundle-generator'; // Default
    
    switch (provider) {
      case 'dts-bundle-generator':
        return await generateWithDtsBundleGenerator(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
      case 'api-extractor':
        return await generateBundledDeclarations(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
      case 'typescript':
        return await generateBundlelessDeclarations(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
      case 'mkdist':
        return await generateWithMkdist(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
      default:
        // Fallback for backwards compatibility
        if (dtsOptions.bundle) {
          return await generateBundledDeclarations(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
        } else {
          return await generateBundlelessDeclarations(pkg, dtsOptions, dtsOutputDir, enforcedOptions);
        }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (dtsOptions.abortOnError !== false) {
      return {
        success: false,
        error: errorMessage,
      };
    } else {
      logger.warn(`⚠️  Declaration generation failed for ${pkg.name}:`);
      logger.warn(`  Error: ${errorMessage}`);
      logger.warn(`  Provider: ${dtsOptions.provider || 'dts-bundle-generator'}`);
      logger.warn(`  Output directory: ${outputDir}`);
      return { success: true };
    }
  }
}

/**
 * Resolve the output directory for declaration files
 * Priority: dts.distPath > declarationDir > output.distPath
 */
function resolveDtsOutputDir(
  pkg: PackageInfo,
  dtsOptions: DtsOptions,
  buildOutputDir: string,
): string {
  // 1. Check dts.distPath configuration
  if (dtsOptions.distPath) {
    return resolve(pkg.path, dtsOptions.distPath);
  }

  // 2. Check tsconfig.json declarationDir
  try {
    const tsconfig = readFileSync(join(pkg.path, "tsconfig.json"), "utf-8");
    const parsed = JSON.parse(tsconfig);
    if (parsed.compilerOptions?.declarationDir) {
      return resolve(pkg.path, parsed.compilerOptions.declarationDir);
    }
  } catch {
    // Ignore tsconfig read errors
  }

  // 3. Fallback to build output directory
  return buildOutputDir;
}

/**
 * Enforce required compiler options for declaration generation
 * Based on Rslib's approach
 */
function enforceDeclarationOptions(
  tsconfig: any,
  dtsOptions: DtsOptions,
  format: string,
): any {
  const enforced = {
    ...tsconfig,
    compilerOptions: {
      ...tsconfig.compilerOptions,
      // Required options for declaration generation
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
    },
  };

  // Add declarationMap for better debugging
  if (dtsOptions.bundle !== true) {
    enforced.compilerOptions.declarationMap = true;
  }

  // Auto-set extension based on format
  if (dtsOptions.autoExtension !== false) {
    switch (format) {
      case "cjs":
        enforced.compilerOptions.declarationDir = enforced.compilerOptions.declarationDir || "dist";
        break;
      case "esm":
        enforced.compilerOptions.declarationDir = enforced.compilerOptions.declarationDir || "dist";
        break;
      default:
        enforced.compilerOptions.declarationDir = enforced.compilerOptions.declarationDir || "dist";
    }
  }

  return enforced;
}

/**
 * Generate bundleless declarations using TypeScript Compiler API
 */
async function generateBundlelessDeclarations(
  pkg: PackageInfo,
  _dtsOptions: DtsOptions,
  outputDir: string,
  tsconfig: any,
): Promise<DtsGeneratorResult> {
  try {
    // Use TypeScript Compiler API
    const ts = await import("typescript");
    
    // Create program
    const program = ts.createProgram(
      pkg.entryPoints.filter(ep => ep.endsWith('.ts') && !ep.endsWith('.d.ts')),
      {
        ...tsconfig.compilerOptions,
        outDir: outputDir,
      },
    );

    // Emit declarations
    const emitResult = program.emit(undefined, undefined, undefined, true);

    if (emitResult.diagnostics.length > 0) {
      const errors = emitResult.diagnostics
        .filter(d => d.category === ts.DiagnosticCategory.Error)
        .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      
      if (errors.length > 0) {
        return {
          success: false,
          error: `TypeScript compilation errors:\n${errors.join('\n')}`,
        };
      }
    }

    // Get generated files
    const generatedFiles = getGeneratedDeclarationFiles(outputDir);

    logger.info(`✅ Generated ${generatedFiles.length} declaration files for ${pkg.name}`);

    return {
      success: true,
      outputDir,
      files: generatedFiles,
    };
  } catch (error) {
    return {
      success: false,
      error: `Bundleless declaration generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** 
 * Generate bundled declarations using API Extractor
 */
async function generateBundledDeclarations(
  pkg: PackageInfo,
  dtsOptions: DtsOptions,
  outputDir: string,
  tsconfig: any,
): Promise<DtsGeneratorResult> {
  try {
    // Check if API Extractor is available
    let apiExtractor;
    try {
      apiExtractor = await import("@microsoft/api-extractor");
    } catch {
      return {
        success: false,
        error: "API Extractor not found. Install @microsoft/api-extractor for bundled declarations.",
      };
    }

    // First generate bundleless declarations
    const bundlelessResult = await generateBundlelessDeclarations(pkg, dtsOptions, outputDir, tsconfig);
    if (!bundlelessResult.success) {
      return bundlelessResult;
    }

    // Create API Extractor config
    const apiExtractorConfig = createApiExtractorConfig(pkg, outputDir);

    // Run API Extractor
    const extractorConfig = apiExtractor.ExtractorConfig.loadFileAndPrepare(apiExtractorConfig);
    const extractorResult = apiExtractor.Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: false,
    });

    if (!extractorResult.succeeded) {
      return {
        success: false,
        error: "API Extractor failed to bundle declarations",
      };
    }

    logger.info(`✅ Generated bundled declaration file for ${pkg.name}`);

    return {
      success: true,
      outputDir,
      files: [join(outputDir, `${pkg.name.split('/').pop() || 'index'}.d.ts`)],
    };
  } catch (error) {
    return {
      success: false,
      error: `Bundled declaration generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create API Extractor configuration
 */
function createApiExtractorConfig(
  pkg: PackageInfo,
  outputDir: string,
): string {
  const configPath = join(pkg.path, "api-extractor.json");
  
  const config = {
    "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
    "mainEntryPointFilePath": join(outputDir, "index.d.ts"),
    "bundledPackages": [],
    "compiler": {
      "tsconfigFilePath": join(pkg.path, "tsconfig.json"),
    },
    "apiReport": {
      "enabled": false,
    },
    "docModel": {
      "enabled": false,
    },
    "dtsRollup": {
      "enabled": true,
      "untrimmedFilePath": join(outputDir, `${pkg.name.split('/').pop() || 'index'}.d.ts`),
    },
    "tsdocMetadata": {
      "enabled": false,
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Get list of generated declaration files
 */
function getGeneratedDeclarationFiles(outputDir: string): string[] {
  const files: string[] = [];
  
  function scanDirectory(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  scanDirectory(outputDir);
  return files;
}

/**
 * Generate declarations using dts-bundle-generator
 */
async function generateWithDtsBundleGenerator(
  pkg: PackageInfo,
  dtsOptions: DtsOptions,
  outputDir: string,
  _tsconfig: any,
): Promise<DtsGeneratorResult> {
  try {
    // Check if dts-bundle-generator is available
    let dtsBundleGenerator;
    try {
      dtsBundleGenerator = await import('dts-bundle-generator');
    } catch {
      return {
        success: false,
        error: "dts-bundle-generator not found. Install dts-bundle-generator for this provider.",
      };
    }

    // Get tsconfig using readTSConfig
    const tsconfig = await readTSConfig(pkg.path);
    if (!tsconfig) {
      return {
        success: false,
        error: "No tsconfig.json found",
      };
    }

    // Prepare entry points
    const entryPoints: EntryPointConfig[] = pkg.entryPoints
      .filter(ep => ep.endsWith('.ts') && !ep.endsWith('.d.ts'))
      .map(filePath => ({
        filePath,
      }));

    if (entryPoints.length === 0) {
      return {
        success: false,
        error: "No valid TypeScript entry points found",
      };
    }

    // Prepare configuration
    const config: CompilationOptions = {
      preferredConfigPath: dtsOptions.dtsBundleGenerator?.preferredConfigPath || join(pkg.path, 'tsconfig.json'),
      ...dtsOptions.dtsBundleGenerator,
    };

    // Generate declarations
    const result = dtsBundleGenerator.generateDtsBundle(entryPoints, config);

    // Write generated files
    const generatedFiles: string[] = [];
    
    for (let i = 0; i < entryPoints.length; i++) {
      const entryPoint = entryPoints[i];
      const content = result[i];
      
      if (!entryPoint || !content) {
        logger.warn(`⚠️  No declaration content generated for entry point ${i}`);
        continue;
      }

      // Calculate relative path from package root, removing 'src/' prefix
      let relativePath = entryPoint.filePath.replace(pkg.path + '/', '').replace(pkg.path + '\\', '');
      // Remove 'src/' prefix if it exists (handle both forward and backward slashes)
      if (relativePath.startsWith('src/') || relativePath.startsWith('src\\')) {
        relativePath = relativePath.substring(4);
      }
      const destPath = join(outputDir, relativePath).replace(/\.ts$/, '.d.ts');
      
      // Ensure directory exists
      const destDir = join(destPath, '..');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // Write file
      writeFileSync(destPath, content);
      generatedFiles.push(destPath);
      
      logger.info(`✅ Generated declaration file: ${destPath} (${content.length} bytes)`);
    }

    if (generatedFiles.length === 0) {
      return {
        success: false,
        error: "No declaration files were generated",
      };
    }

    logger.info(`✅ Generated ${generatedFiles.length} declaration files for ${pkg.name} using dts-bundle-generator`);

    return {
      success: true,
      outputDir,
      files: generatedFiles,
    };
  } catch (error) {
    return {
      success: false,
      error: `dts-bundle-generator failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate declarations using mkdist's VFS approach
 */
async function generateWithMkdist(
  pkg: PackageInfo,
  dtsOptions: DtsOptions,
  outputDir: string,
  _tsconfig: any,
): Promise<DtsGeneratorResult> {
  try {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Create VFS (Virtual File System) from entry points
    const vfs = new Map<string, string>();
    const readErrors: string[] = [];
    
    // Read all TypeScript entry points into VFS
    for (const entryPoint of pkg.entryPoints) {
      if (entryPoint.endsWith('.ts') && !entryPoint.endsWith('.d.ts')) {
        try {
          const content = readFileSync(entryPoint, 'utf-8');
          
          // Basic validation: check if file has any exports
          const hasExports = /export\s+(?:default\s+)?(?:function|class|interface|type|const|let|var|enum|namespace|\*|\{[^}]*\})/m.test(content);
          if (!hasExports) {
            logger.warn(`⚠️  Entry point ${entryPoint} appears to have no exports - this may cause declaration generation to fail`);
          }
          
          vfs.set(entryPoint, content);
        } catch (error) {
          const errorMsg = `Failed to read entry point ${entryPoint}: ${error instanceof Error ? error.message : String(error)}`;
          readErrors.push(errorMsg);
          logger.warn(`⚠️  ${errorMsg}`);
        }
      }
    }

    if (vfs.size === 0) {
      return {
        success: false,
        error: "No valid TypeScript entry points found for mkdist provider",
      };
    }

    // Get mkdist-specific options
    const mkdistOptions: MkdistDtsOptions = dtsOptions.mkdist || {};

    // Generate declarations using mkdist's VFS approach
    const declarations = await getDeclarations(vfs, pkg, dtsOptions, outputDir, mkdistOptions);


    // Write generated declarations to output directory
    const generatedFiles: string[] = [];
    let hasErrors = false;

    for (const [filename, result] of Object.entries(declarations)) {
      if (!result.contents) {
        continue;
      }

      // The filename already contains the correct output path from the TypeScript compiler
      // We just need to ensure it has the .d.ts extension
      const destPath = filename.replace(/\.ts$/, '.d.ts');
      
      
      // Ensure directory exists
      const destDir = join(destPath, '..');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // Write declaration file
      try {
        writeFileSync(destPath, result.contents);
        generatedFiles.push(destPath);
      } catch (error) {
        logger.error(`Failed to write declaration file ${destPath}: ${error instanceof Error ? error.message : String(error)}`);
        hasErrors = true;
      }

      // Log errors if any
      if (result.errors && result.errors.length > 0) {
        hasErrors = true;
        for (const error of result.errors) {
          logger.warn(`⚠️  Declaration error in ${filename}: ${error.message}`);
        }
      }

      logger.info(`✅ Generated declaration file: ${destPath} (${result.contents.length} bytes)`);
    }

    if (generatedFiles.length === 0) {
      // Provide detailed diagnostic information
      const diagnosticInfo = [];
      
      // Check if VFS has any files
      if (vfs.size === 0) {
        diagnosticInfo.push("No TypeScript files found in entry points");
        if (readErrors.length > 0) {
          diagnosticInfo.push(`File read errors: ${readErrors.length}`);
          diagnosticInfo.push(...readErrors.map(error => `  - ${error}`));
        }
      } else {
        diagnosticInfo.push(`Found ${vfs.size} TypeScript files in VFS`);
        if (readErrors.length > 0) {
          diagnosticInfo.push(`File read errors: ${readErrors.length}`);
          diagnosticInfo.push(...readErrors.map(error => `  - ${error}`));
        }
      }
      
      // Check if declarations were generated but not written
      const declarationFiles = Array.from(vfs.keys()).filter(key => key.endsWith('.d.ts'));
      if (declarationFiles.length > 0) {
        diagnosticInfo.push(`Generated ${declarationFiles.length} declaration files in VFS but failed to write them`);
        diagnosticInfo.push(`Declaration files: ${declarationFiles.join(', ')}`);
      } else {
        diagnosticInfo.push("No declaration files were generated in VFS");
      }
      
      // Check for TypeScript compilation errors
      const hasCompilationErrors = Object.values(declarations).some(result => result.errors && result.errors.length > 0);
      if (hasCompilationErrors) {
        diagnosticInfo.push("TypeScript compilation errors detected");
      }
      
      // Check entry points
      const validEntryPoints = pkg.entryPoints.filter(ep => ep.endsWith('.ts') && !ep.endsWith('.d.ts'));
      diagnosticInfo.push(`Entry points processed: ${validEntryPoints.length}`);
      if (validEntryPoints.length > 0) {
        diagnosticInfo.push(`Entry points: ${validEntryPoints.join(', ')}`);
      }
      
      const errorMessage = [
        "No declaration files were generated by mkdist provider",
        "",
        "Diagnostic information:",
        ...diagnosticInfo.map(info => `  • ${info}`),
        "",
        "Troubleshooting suggestions:",
        "  • Ensure your TypeScript files have proper exports",
        "  • Check for TypeScript compilation errors in your source files",
        "  • Verify that your tsconfig.json has 'declaration: true'",
        "  • Try using a different DTS provider (e.g., 'typescript' or 'dts-bundle-generator')",
        "  • Check if your entry points contain valid TypeScript code",
      ].join('\n');
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    if (hasErrors) {
      logger.warn(`⚠️  mkdist generated ${generatedFiles.length} declaration files with some errors`);
    } else {
      logger.info(`✅ Generated ${generatedFiles.length} declaration files for ${pkg.name} using mkdist provider`);
    }

    return {
      success: true,
      outputDir,
      files: generatedFiles,
    };
  } catch (error) {
    return {
      success: false,
      error: `mkdist declaration generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate declarations with experimental tsgo
 */
export async function generateWithTsgo(
  pkg: PackageInfo,
  dtsOptions: DtsOptions,
  outputDir: string,
): Promise<DtsGeneratorResult> {
  try {
    // Check if tsgo is available
    // let tsgo;
    // try {
    //   tsgo = await import("@typescript/native-preview");
    // } catch {
    //   return {
    //     success: false,
    //     error: "tsgo not found. Install @typescript/native-preview for tsgo support.",
    //   };
    // }

    // This is a placeholder - tsgo integration would go here
    // For now, fall back to regular TypeScript Compiler API
    logger.warn("⚠️  tsgo support is experimental and not yet implemented, falling back to TypeScript Compiler API");
    
    return await generateBundlelessDeclarations(pkg, dtsOptions, outputDir, {});
  } catch (error) {
    return {
      success: false,
      error: `tsgo declaration generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
