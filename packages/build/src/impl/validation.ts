// packages/build/src/impl/validation.ts

import { logger } from "@reliverse/dler-logger";
import type { BuildOptions } from "./types";

export interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
}

export function validateBuildOptions(options: BuildOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate bundler option
  if (options.bundler && !["bun", "mkdist"].includes(options.bundler)) {
    errors.push({
      field: "bundler",
      message: 'Bundler must be "bun" or "mkdist"',
      suggestion: 'Set --bundler to "bun" or "mkdist"',
    });
  }

  // Validate bytecode requirements
  if (options.bytecode) {
    if (options.format !== "cjs") {
      errors.push({
        field: "bytecode",
        message: 'Bytecode compilation requires format: "cjs"',
        suggestion: "Set --format cjs or remove --bytecode",
      });
    }
    if (options.target !== "bun") {
      errors.push({
        field: "bytecode",
        message: 'Bytecode compilation requires target: "bun"',
        suggestion: "Set --target bun or remove --bytecode",
      });
    }
  }

  // Validate JSX options
  if (options.jsx) {
    if (
      options.jsx.runtime &&
      !["automatic", "classic"].includes(options.jsx.runtime)
    ) {
      errors.push({
        field: "jsx.runtime",
        message: 'JSX runtime must be "automatic" or "classic"',
        suggestion: 'Set --jsxRuntime to "automatic" or "classic"',
      });
    }
    if (
      options.jsx.importSource &&
      typeof options.jsx.importSource !== "string"
    ) {
      errors.push({
        field: "jsx.importSource",
        message: "JSX import source must be a string",
        suggestion:
          'Set --jsxImportSource to a valid package name like "react"',
      });
    }
  }

  // Validate IIFE format requirements
  if (options.format === "iife") {
    if (options.target !== "browser") {
      errors.push({
        field: "format",
        message: 'IIFE format requires target: "browser"',
        suggestion: "Set --target browser or use --format esm/cjs",
      });
    }
    if (options.splitting) {
      errors.push({
        field: "splitting",
        message: "Code splitting is not supported with IIFE format",
        suggestion: "Set --splitting false or use --format esm/cjs",
      });
    }
  }

  // Validate CommonJS format limitations
  if (options.format === "cjs") {
    if (options.target === "browser") {
      errors.push({
        field: "format",
        message: "CommonJS format is not recommended for browser targets",
        suggestion:
          "Use --format esm for browser or --target node for CommonJS",
      });
    }
    // Warn about experimental status
    errors.push({
      field: "format",
      message: "CommonJS format is experimental in Bun",
      suggestion: "Consider using --format esm for better compatibility",
    });
  }

  // Validate IIFE format experimental status
  if (options.format === "iife") {
    errors.push({
      field: "format",
      message: "IIFE format is experimental in Bun",
      suggestion: "Consider using --format esm for better compatibility",
    });
  }

  // Validate production mode conflicts
  if (options.production && options.dev) {
    errors.push({
      field: "production",
      message: "Cannot use both --production and --dev flags",
      suggestion: "Choose either --production or --dev",
    });
  }

  // Validate watch mode with compile
  if (options.watch && options.compile) {
    errors.push({
      field: "watch",
      message: "Watch mode is not supported with --compile",
      suggestion: "Remove --watch or --compile flag",
    });
  }

  // Validate compile target compatibility
  if (options.compile) {
    if (options.target === "browser") {
      errors.push({
        field: "compile",
        message: "Standalone executables cannot be built for browser target",
        suggestion: "Use --target bun or --target node for executables",
      });
    }

    if (options.html) {
      errors.push({
        field: "compile",
        message:
          "HTML processing is not compatible with standalone executables",
        suggestion: "Remove --html or --compile flag",
      });
    }

    // Bytecode is beneficial for executables
    if (
      !options.bytecode &&
      options.format === "cjs" &&
      options.target === "bun"
    ) {
      // This is just a suggestion, not an error
      logger.info(
        "💡 Consider using --bytecode with --compile for faster cold starts",
      );
    }
  }

  // Validate naming patterns
  if (options.entryNaming && !isValidNamingPattern(options.entryNaming)) {
    errors.push({
      field: "entryNaming",
      message: "Invalid entry naming pattern",
      suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
    });
  }

  if (options.chunkNaming && !isValidNamingPattern(options.chunkNaming)) {
    errors.push({
      field: "chunkNaming",
      message: "Invalid chunk naming pattern",
      suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
    });
  }

  if (options.assetNaming && !isValidNamingPattern(options.assetNaming)) {
    errors.push({
      field: "assetNaming",
      message: "Invalid asset naming pattern",
      suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
    });
  }

  // Validate external packages
  if (options.external && Array.isArray(options.external)) {
    for (const ext of options.external) {
      if (typeof ext !== "string" || ext.trim() === "") {
        errors.push({
          field: "external",
          message: "External packages must be non-empty strings",
          suggestion: "Remove empty strings from external array",
        });
        break;
      }
    }
  }

  // Validate drop patterns
  if (options.drop && Array.isArray(options.drop)) {
    for (const drop of options.drop) {
      if (typeof drop !== "string" || drop.trim() === "") {
        errors.push({
          field: "drop",
          message: "Drop patterns must be non-empty strings",
          suggestion: "Remove empty strings from drop array",
        });
        break;
      }
    }
  }

  // Validate concurrency
  if (options.concurrency !== undefined) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      errors.push({
        field: "concurrency",
        message: "Concurrency must be a positive integer",
        suggestion: "Set --concurrency to a number >= 1",
      });
    }
  }

  // Validate dev server options
  if (options.devServer) {
    if (options.target !== "browser") {
      errors.push({
        field: "devServer",
        message: 'Dev server requires target: "browser"',
        suggestion: "Set --target browser or remove --devServer",
      });
    }
    if (options.compile) {
      errors.push({
        field: "devServer",
        message: "Dev server is not supported with --compile",
        suggestion: "Remove --compile or --devServer flag",
      });
    }
  }

  // Validate port
  if (options.port !== undefined) {
    if (
      !Number.isInteger(options.port) ||
      options.port < 1 ||
      options.port > 65535
    ) {
      errors.push({
        field: "port",
        message: "Port must be between 1 and 65535",
        suggestion: "Set --port to a valid port number",
      });
    }
  }

  // Validate HTML mode
  if (options.html && options.target === "node") {
    errors.push({
      field: "html",
      message: 'HTML processing is not supported with target: "node"',
      suggestion: "Use --target browser for HTML processing",
    });
  }

  // Validate CSS chunking
  if (options.cssChunking && options.format === "iife") {
    errors.push({
      field: "cssChunking",
      message: "CSS chunking is not supported with IIFE format",
      suggestion: "Use --format esm or remove --cssChunking",
    });
  }

  // Validate minify options
  if (options.minify && typeof options.minify === "object") {
    const minify = options.minify as any;
    if (
      minify.whitespace !== undefined &&
      typeof minify.whitespace !== "boolean"
    ) {
      errors.push({
        field: "minify.whitespace",
        message: "Minify whitespace option must be boolean",
        suggestion: "Set --minifyWhitespace to true or false",
      });
    }
    if (minify.syntax !== undefined && typeof minify.syntax !== "boolean") {
      errors.push({
        field: "minify.syntax",
        message: "Minify syntax option must be boolean",
        suggestion: "Set --minifySyntax to true or false",
      });
    }
    if (
      minify.identifiers !== undefined &&
      typeof minify.identifiers !== "boolean"
    ) {
      errors.push({
        field: "minify.identifiers",
        message: "Minify identifiers option must be boolean",
        suggestion: "Set --minifyIdentifiers to true or false",
      });
    }
  }

  // Validate loader object
  if (options.loader && typeof options.loader === "object") {
    const validLoaders = [
      "js",
      "jsx",
      "ts",
      "tsx",
      "json",
      "toml",
      "file",
      "napi",
      "wasm",
      "text",
    ];
    for (const [ext, loader] of Object.entries(options.loader)) {
      if (
        typeof loader !== "string" ||
        !validLoaders.includes(loader as string)
      ) {
        errors.push({
          field: "loader",
          message: `Invalid loader for extension .${ext}: ${loader}`,
          suggestion: `Use one of: ${validLoaders.join(", ")}`,
        });
      }
    }
  }

  // Validate env option
  if (options.env && typeof options.env === "string") {
    if (
      options.env !== "inline" &&
      options.env !== "disable" &&
      !options.env.endsWith("*")
    ) {
      errors.push({
        field: "env",
        message: 'env must be "inline", "disable", or a string ending with "*"',
        suggestion: 'Use --env inline, --env disable, or --env "PUBLIC_*"',
      });
    }
  }

  // Validate conditions array
  if (options.conditions && Array.isArray(options.conditions)) {
    for (const condition of options.conditions) {
      if (typeof condition !== "string" || condition.trim() === "") {
        errors.push({
          field: "conditions",
          message: "Conditions must be non-empty strings",
          suggestion: "Remove empty strings from conditions array",
        });
        break;
      }
    }
  }

  // Validate naming options
  if (options.naming) {
    if (options.naming.chunk && !isValidNamingPattern(options.naming.chunk)) {
      errors.push({
        field: "naming.chunk",
        message: "Invalid chunk naming pattern",
        suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
      });
    }
    if (options.naming.entry && !isValidNamingPattern(options.naming.entry)) {
      errors.push({
        field: "naming.entry",
        message: "Invalid entry naming pattern",
        suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
      });
    }
    if (options.naming.asset && !isValidNamingPattern(options.naming.asset)) {
      errors.push({
        field: "naming.asset",
        message: "Invalid asset naming pattern",
        suggestion: "Use valid placeholders: [dir], [name], [ext], [hash]",
      });
    }
  }

  return errors;
}

function isValidNamingPattern(pattern: string): boolean {
  // Check for valid placeholders: [dir], [name], [ext], [hash]
  const validPlaceholders = /\[(dir|name|ext|hash)\]/g;
  const matches = pattern.match(validPlaceholders);

  if (!matches) {
    return false; // Must have at least one placeholder
  }

  // Check for invalid characters or patterns
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(pattern)) {
    return false;
  }

  return true;
}

export function logValidationErrors(errors: ValidationError[]): void {
  if (errors.length === 0) return;

  logger.error("❌ Build configuration validation failed:");
  logger.error("");

  for (const error of errors) {
    logger.error(`   • ${error.field}: ${error.message}`);
    if (error.suggestion) {
      logger.error(`     💡 ${error.suggestion}`);
    }
  }

  logger.error("");
  logger.error("Run with --help to see all available options.");
}

export function validateAndExit(options: BuildOptions): void {
  const errors = validateBuildOptions(options);

  if (errors.length > 0) {
    logValidationErrors(errors);
    process.exit(1);
  }
}
