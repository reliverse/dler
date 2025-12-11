// packages/build/src/impl/constants.ts

/**
 * Default debounce time for file watching rebuilds (in milliseconds)
 */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Default concurrency for parallel package builds
 */
export const DEFAULT_CONCURRENCY = 5;

/**
 * Default dev server port
 */
export const DEFAULT_DEV_SERVER_PORT = 3000;

/**
 * Default dev server host
 */
export const DEFAULT_DEV_SERVER_HOST = "localhost";

/**
 * Always ignored packages (regardless of user configuration)
 */
export const ALWAYS_IGNORED_PACKAGES = ["@reliverse/dler-v1"];

/**
 * Common frontend HTML file patterns
 */
export const FRONTEND_HTML_PATTERNS = [
  "index.html",
  "public/index.html",
  "src/index.html",
  "app.html",
  "public/app.html",
] as const;

/**
 * Common JavaScript/TypeScript entry point patterns
 */
export const JS_ENTRY_PATTERNS = [
  "src/main.ts",
  "src/main.js",
  "src/index.ts",
  "src/index.js",
  "main.ts",
  "main.js",
  "index.ts",
  "index.js",
] as const;

/**
 * Common library entry point patterns
 */
export const LIBRARY_ENTRY_PATTERNS = [
  "src/index.ts",
  "src/mod.ts",
  "index.ts",
  "src/index.js",
  "src/mod.js",
  "index.js",
] as const;

/**
 * Common Go project directories
 */
export const GO_PROJECT_DIRS = ["cmd", "internal", "pkg", "prompts"] as const;

/**
 * Frontend framework package names
 */
export const FRONTEND_FRAMEWORKS = [
  "react",
  "preact",
  "solid-js",
  "lit",
  "alpinejs",
] as const;

/**
 * Default ignore patterns for file watching
 */
export const DEFAULT_IGNORE_PATTERNS = [
  "node_modules/**",
  "dist/**",
  ".git/**",
  "**/*.log",
  "**/.DS_Store",
] as const;
