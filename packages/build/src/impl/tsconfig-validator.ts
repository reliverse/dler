// packages/build/src/impl/tsconfig-validator.ts

import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import { readTSConfig } from "@reliverse/dler-pkg-tsc";
import type { PackageInfo } from "./types";

export interface TSConfigValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface TSConfigValidationOptions {
  /** Whether to make validation errors fatal */
  strict?: boolean;
  /** Whether to check for declaration generation compatibility */
  checkDeclarations?: boolean;
  /** Whether to check for build output compatibility */
  checkBuildOutput?: boolean;
}

/**
 * Validate tsconfig.json for common issues and best practices
 */
export async function validateTSConfig(
  pkg: PackageInfo,
  options: TSConfigValidationOptions = {}
): Promise<TSConfigValidationResult> {
  const { strict = false, checkDeclarations = true, checkBuildOutput = true } = options;
  
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const tsconfigPath = join(pkg.path, "tsconfig.json");
    
    if (!existsSync(tsconfigPath)) {
      if (pkg.hasTsConfig) {
        warnings.push("tsconfig.json referenced but not found");
      }
      return { valid: true, warnings, errors };
    }

    const tsconfig = await readTSConfig(pkg.path);
    if (!tsconfig) {
      errors.push("Could not parse tsconfig.json");
      return { valid: false, warnings, errors };
    }

    const compilerOptions = tsconfig.compilerOptions || {};

    // Check for missing compilerOptions
    if (!tsconfig.compilerOptions) {
      warnings.push("No compilerOptions found in tsconfig.json");
    }

    // Check declaration generation settings
    if (checkDeclarations) {
      if (compilerOptions.declaration === false) {
        warnings.push("declaration: false - TypeScript declaration files will not be generated");
      } else if (compilerOptions.declaration === undefined) {
        warnings.push("declaration not set - consider adding 'declaration: true' for library packages");
      }

      if (compilerOptions.emitDeclarationOnly === true && !compilerOptions.declaration) {
        errors.push("emitDeclarationOnly: true requires declaration: true");
      }

      if (compilerOptions.declaration && !compilerOptions.outDir && !compilerOptions.declarationDir) {
        warnings.push("declaration: true but no outDir or declarationDir specified - declarations will be emitted alongside source files");
      }
    }

    // Check build output settings
    if (checkBuildOutput) {
      if (compilerOptions.outDir) {
        const outDir = compilerOptions.outDir;
        if (outDir.includes("src") || outDir.includes("source")) {
          warnings.push(`outDir '${outDir}' contains 'src' or 'source' - consider using 'dist' or 'build' for output directory`);
        }
      } else {
        warnings.push("No outDir specified - consider adding 'outDir: \"dist\"' for cleaner output structure");
      }

      if (compilerOptions.noEmit === true) {
        warnings.push("noEmit: true - TypeScript will not emit any files (use for type checking only)");
      }

      if (compilerOptions.emitDeclarationOnly === true && compilerOptions.noEmit === true) {
        errors.push("emitDeclarationOnly: true conflicts with noEmit: true");
      }
    }

    // Check for common misconfigurations
    if (compilerOptions.target && !["es2015", "es2016", "es2017", "es2018", "es2019", "es2020", "es2021", "es2022", "esnext"].includes(compilerOptions.target)) {
      warnings.push(`Unusual target '${compilerOptions.target}' - consider using a standard ES target`);
    }

    if (compilerOptions.module && !["commonjs", "amd", "system", "umd", "es6", "es2015", "esnext", "es2020", "es2022", "node16", "nodenext"].includes(compilerOptions.module)) {
      warnings.push(`Unusual module '${compilerOptions.module}' - consider using 'esnext' or 'commonjs'`);
    }

    // Check for missing important options
    if (!compilerOptions.strict) {
      warnings.push("strict mode not enabled - consider adding 'strict: true' for better type safety");
    }

    if (!compilerOptions.skipLibCheck) {
      warnings.push("skipLibCheck not set - consider adding 'skipLibCheck: true' for faster builds");
    }

    // Check for problematic settings
    if (compilerOptions.allowJs === true && !compilerOptions.checkJs) {
      warnings.push("allowJs: true without checkJs: true - JavaScript files will not be type-checked");
    }

    if (compilerOptions.experimentalDecorators === true && !compilerOptions.emitDecoratorMetadata) {
      warnings.push("experimentalDecorators: true without emitDecoratorMetadata - decorator metadata will not be emitted");
    }

    // Check for frontend app specific issues
    if (pkg.isFrontendApp) {
      if (compilerOptions.moduleResolution && !["node", "bundler"].includes(compilerOptions.moduleResolution)) {
        warnings.push(`Frontend app using moduleResolution '${compilerOptions.moduleResolution}' - consider using 'bundler' for modern bundlers`);
      }

      if (compilerOptions.target && ["es5", "es2015"].includes(compilerOptions.target)) {
        warnings.push(`Frontend app using old target '${compilerOptions.target}' - consider using 'es2020' or newer for better performance`);
      }
    }

    // Check for library specific issues
    if (!pkg.isFrontendApp) {
      if (compilerOptions.moduleResolution && compilerOptions.moduleResolution === "bundler") {
        warnings.push("Library using moduleResolution 'bundler' - consider using 'node' for better compatibility");
      }

      if (!compilerOptions.declaration) {
        warnings.push("Library package without declaration: true - consider enabling for better type support");
      }
    }

    const hasErrors = errors.length > 0;
    const isValid = !hasErrors || !strict;

    return { valid: isValid, warnings, errors };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to validate tsconfig.json: ${errorMessage}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate tsconfig.json for all packages in a workspace
 */
export async function validateAllTSConfigs(
  packages: PackageInfo[],
  options: TSConfigValidationOptions = {}
): Promise<{ valid: boolean; results: Array<{ package: string; result: TSConfigValidationResult }> }> {
  const results: Array<{ package: string; result: TSConfigValidationResult }> = [];
  let allValid = true;

  for (const pkg of packages) {
    const result = await validateTSConfig(pkg, options);
    results.push({ package: pkg.name, result });
    
    if (!result.valid) {
      allValid = false;
    }
  }

  return { valid: allValid, results };
}

/**
 * Log validation results in a user-friendly format
 */
export function logValidationResults(
  results: Array<{ package: string; result: TSConfigValidationResult }>,
  verbose: boolean = false
): void {
  for (const { package: packageName, result } of results) {
    if (result.errors.length > 0) {
      logger.error(`❌ ${packageName}: TSConfig validation failed`);
      for (const error of result.errors) {
        logger.error(`   ${error}`);
      }
    } else if (result.warnings.length > 0) {
      logger.warn(`⚠️  ${packageName}: TSConfig validation warnings`);
      for (const warning of result.warnings) {
        logger.warn(`   ${warning}`);
      }
    } else if (verbose) {
      logger.success(`✅ ${packageName}: TSConfig validation passed`);
    }
  }
}
