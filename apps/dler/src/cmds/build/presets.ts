// apps/dler/src/cmds/build/presets.ts

import type { BuildOptions } from "./types";

export function applyProductionPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    production: true,
    minify: true,
    sourcemap: "none",
    env: "inline",
    splitting: true,
    // Override user settings for production
    dev: false,
    watch: false,
    verbose: false,
  };
}

export function applyDevelopmentPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    dev: true,
    minify: false,
    sourcemap: "inline",
    env: "disable",
    splitting: true,
    watch: true,
    // Override user settings for development
    production: false,
    bytecode: false,
    compile: false,
  };
}

export function applyFrontendPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    target: "browser",
    format: "esm",
    splitting: true,
    html: true,
    cssChunking: true,
    minify: options.production ?? false,
    sourcemap: options.production ? "linked" : "inline",
    // Frontend-specific defaults
    publicAssets: "public",
    // Override conflicting options
    bytecode: false, // Bytecode not supported for browser target
  };
}

export function applyPresets(options: BuildOptions): BuildOptions {
  let result = { ...options };

  // Apply production preset
  if (options.production) {
    result = applyProductionPreset(result);
  }

  // Apply development preset
  if (options.dev) {
    result = applyDevelopmentPreset(result);
  }

  // Apply frontend preset if HTML processing is enabled
  if (options.html || options.target === "browser") {
    result = applyFrontendPreset(result);
  }

  // Handle minification options
  if (typeof result.minify === 'boolean') {
    // Convert boolean minify to granular options
    result.minify = {
      whitespace: result.minify,
      syntax: result.minify,
      identifiers: result.minify,
    };
  } else if (result.minifyWhitespace !== undefined || 
             result.minifySyntax !== undefined || 
             result.minifyIdentifiers !== undefined) {
    // Use granular minify options
    result.minify = {
      whitespace: result.minifyWhitespace ?? true,
      syntax: result.minifySyntax ?? true,
      identifiers: result.minifyIdentifiers ?? true,
    };
  }

  // Handle naming patterns
  if (result.entryNaming || result.chunkNaming || result.assetNaming) {
    result.naming = {
      entry: result.entryNaming,
      chunk: result.chunkNaming,
      asset: result.assetNaming,
    };
  }

  // Handle external packages
  if (result.external && typeof result.external === 'string') {
    result.external = [result.external];
  }

  // Handle drop patterns
  if (result.drop && typeof result.drop === 'string') {
    result.drop = [result.drop];
  }

  // Handle conditions - ensure it's always an array
  if (result.conditions) {
    if (typeof result.conditions === 'string') {
      result.conditions = [result.conditions];
    } else if (!Array.isArray(result.conditions)) {
      result.conditions = [];
    }
  }

  // Handle JSX options
  if ((result as any).jsxRuntime || (result as any).jsxImportSource) {
    result.jsx = {
      runtime: (result as any).jsxRuntime as 'automatic' | 'classic' || 'automatic',
      importSource: (result as any).jsxImportSource,
    };
  }

  // Handle experimental features
  if (result.experimental && typeof result.experimental === 'string') {
    result.experimental = (result.experimental as string).split(',').map((f: string) => f.trim());
  }

  return result;
}

export function applyLibraryPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    target: "bun",
    format: "esm",
    splitting: false,
    minify: false,
    sourcemap: "linked",
    // Library-specific defaults
    packages: "external",
    // Enhanced library features
    generateTypes: true,
    typeCheck: true,
    sideEffects: false,
    // Override conflicting options
    html: false,
    cssChunking: false,
    devServer: false,
  };
}

export function applyReactPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    target: "browser",
    format: "esm",
    splitting: true,
    html: true,
    cssChunking: true,
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
    // React-specific defaults
    minify: options.production ?? false,
    sourcemap: options.production ? "linked" : "inline",
    // Enhanced React features
    reactFastRefresh: !options.production,
    svgAsReact: true,
    cssModules: true,
    // Override conflicting options
    bytecode: false,
  };
}

export function applyNodePreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    target: "node",
    format: "esm",
    splitting: false,
    minify: options.production ?? false,
    sourcemap: options.production ? "none" : "inline",
    // Node.js-specific defaults
    packages: "bundle",
    // Override conflicting options
    html: false,
    cssChunking: false,
    devServer: false,
  };
}

export function applyMonorepoPreset(options: BuildOptions): BuildOptions {
  return {
    ...options,
    // Monorepo-specific defaults
    concurrency: 8,
    stopOnError: false,
    cache: true,
    // Optimize for multiple packages
    minify: options.production ?? false,
    sourcemap: options.production ? "linked" : "inline",
    splitting: true,
  };
}

export function getPresetDescription(preset: 'production' | 'development' | 'library' | 'react' | 'node' | 'monorepo'): string {
  switch (preset) {
    case 'production':
      return 'Optimized for production: minify=true, sourcemap=none, env=inline, splitting=true';
    case 'development':
      return 'Optimized for development: minify=false, sourcemap=inline, env=disable, watch=true';
    case 'library':
      return 'Optimized for libraries: target=bun, format=esm, splitting=false, packages=external';
    case 'react':
      return 'Optimized for React apps: target=browser, format=esm, jsx=automatic, html=true';
    case 'node':
      return 'Optimized for Node.js: target=node, format=esm, splitting=false, packages=bundle';
    case 'monorepo':
      return 'Optimized for monorepos: concurrency=8, cache=true, stopOnError=false';
    default:
      return '';
  }
}
