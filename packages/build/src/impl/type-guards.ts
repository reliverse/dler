// packages/build/src/impl/type-guards.ts

import type { PackageBuildConfig } from "@reliverse/dler-config/impl/build";
import type { 
  BuildOptions, 
  JSXOptions,
  MinifyOptions, 
  NamingOptions
} from "./types";

export function isBuildOptions(obj: any): obj is BuildOptions {
  return obj && typeof obj === 'object';
}

export function isPackageBuildConfig(obj: any): obj is PackageBuildConfig {
  return obj && typeof obj === 'object';
}

export function isMinifyOptions(obj: any): obj is MinifyOptions {
  if (typeof obj === 'boolean') return true;
  if (!obj || typeof obj !== 'object') return false;
  
  return (
    obj.whitespace === undefined || typeof obj.whitespace === 'boolean' &&
    obj.syntax === undefined || typeof obj.syntax === 'boolean' &&
    obj.identifiers === undefined || typeof obj.identifiers === 'boolean'
  );
}

export function isJSXOptions(obj: any): obj is JSXOptions {
  if (!obj || typeof obj !== 'object') return false;
  
  return (
    obj.runtime === undefined || (obj.runtime === 'automatic' || obj.runtime === 'classic') &&
    obj.importSource === undefined || typeof obj.importSource === 'string'
  );
}

export function isNamingOptions(obj: any): obj is NamingOptions {
  if (!obj || typeof obj !== 'object') return false;
  
  return (
    obj.chunk === undefined || typeof obj.chunk === 'string' &&
    obj.entry === undefined || typeof obj.entry === 'string' &&
    obj.asset === undefined || typeof obj.asset === 'string'
  );
}

export function isValidTarget(target: any): target is 'browser' | 'bun' | 'node' {
  return target === 'browser' || target === 'bun' || target === 'node';
}

export function isValidFormat(format: any): format is 'esm' | 'cjs' | 'iife' {
  return format === 'esm' || format === 'cjs' || format === 'iife';
}

export function isValidSourcemap(sourcemap: any): sourcemap is 'none' | 'linked' | 'inline' | 'external' {
  return sourcemap === 'none' || sourcemap === 'linked' || sourcemap === 'inline' || sourcemap === 'external';
}

export function isValidLoader(loader: any): loader is 'js' {
  const validLoaders = ['js'];
  return validLoaders.includes(loader);
}

export function isValidEnv(env: any): env is 'inline' | 'disable' | `${string}*` {
  if (typeof env !== 'string') return false;
  return env === 'inline' || env === 'disable' || env.endsWith('*');
}

export function isValidPackages(packages: any): packages is 'bundle' | 'external' {
  return packages === 'bundle' || packages === 'external';
}

export function isStringArray(arr: any): arr is string[] {
  return Array.isArray(arr) && arr.every(item => typeof item === 'string');
}

export function isStringOrStringArray(value: any): value is string | string[] {
  return typeof value === 'string' || isStringArray(value);
}

export function validateBuildConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isBuildOptions(config)) {
    errors.push('Invalid build configuration object');
    return { valid: false, errors };
  }

  // Validate target
  if (config.target && !isValidTarget(config.target)) {
    errors.push(`Invalid target: ${config.target}. Must be 'browser', 'bun', or 'node'`);
  }

  // Validate format
  if (config.format && !isValidFormat(config.format)) {
    errors.push(`Invalid format: ${config.format}. Must be 'esm', 'cjs', or 'iife'`);
  }

  // Validate sourcemap
  if (config.sourcemap && !isValidSourcemap(config.sourcemap)) {
    errors.push(`Invalid sourcemap: ${config.sourcemap}. Must be 'none', 'linked', 'inline', or 'external'`);
  }

  // Validate minify options
  if (config.minify && !isMinifyOptions(config.minify)) {
    errors.push('Invalid minify options. Must be boolean or object with whitespace, syntax, identifiers properties');
  }

  // Validate JSX options
  if (config.jsx && !isJSXOptions(config.jsx)) {
    errors.push('Invalid JSX options. Must have runtime (automatic|classic) and optional importSource (string)');
  }

  // Validate naming options
  if (config.naming && !isNamingOptions(config.naming)) {
    errors.push('Invalid naming options. Must have chunk, entry, asset properties as strings');
  }

  // Validate external packages
  if (config.external && !isStringOrStringArray(config.external)) {
    errors.push('Invalid external packages. Must be string or array of strings');
  }

  // Validate drop patterns
  if (config.drop && !isStringArray(config.drop)) {
    errors.push('Invalid drop patterns. Must be array of strings');
  }

  // Validate conditions
  if (config.conditions && !isStringOrStringArray(config.conditions)) {
    errors.push('Invalid conditions. Must be string or array of strings');
  }

  // Validate packages
  if (config.packages && !isValidPackages(config.packages)) {
    errors.push(`Invalid packages: ${config.packages}. Must be 'bundle' or 'external'`);
  }

  // Validate env
  if (config.env && !isValidEnv(config.env)) {
    errors.push('Invalid env. Must be "inline", "disable", or string ending with "*"');
  }

  // Validate loader
  if (config.loader && typeof config.loader === 'object') {
    for (const [ext, loader] of Object.entries(config.loader)) {
      if (!isValidLoader(loader)) {
        errors.push(`Invalid loader for extension ${ext}: ${loader}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeBuildConfig(config: any): BuildOptions {
  const sanitized: any = { ...config };

  // Sanitize target
  if (sanitized.target && !isValidTarget(sanitized.target)) {
    sanitized.target = 'bun';
  }

  // Sanitize format
  if (sanitized.format && !isValidFormat(sanitized.format)) {
    sanitized.format = 'esm';
  }

  // Sanitize sourcemap
  if (sanitized.sourcemap && !isValidSourcemap(sanitized.sourcemap)) {
    sanitized.sourcemap = 'none';
  }

  // Sanitize minify
  if (sanitized.minify && !isMinifyOptions(sanitized.minify)) {
    sanitized.minify = Boolean(sanitized.minify);
  }

  // Sanitize external
  if (sanitized.external && !isStringOrStringArray(sanitized.external)) {
    delete sanitized.external;
  }

  // Sanitize drop
  if (sanitized.drop && !isStringArray(sanitized.drop)) {
    delete sanitized.drop;
  }

  // Sanitize conditions
  if (sanitized.conditions && !isStringOrStringArray(sanitized.conditions)) {
    delete sanitized.conditions;
  }

  // Sanitize packages
  if (sanitized.packages && !isValidPackages(sanitized.packages)) {
    sanitized.packages = 'bundle';
  }

  // Sanitize env
  if (sanitized.env && !isValidEnv(sanitized.env)) {
    sanitized.env = 'disable';
  }

  return sanitized as BuildOptions;
}
