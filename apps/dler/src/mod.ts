// Re-export config utilities for use in dler.config.ts files
export { loadConfig, type LoadedConfig } from "@reliverse/rempts-core";
export { defineConfig, type RemptsConfig } from "@reliverse/rempts-core";

// Re-export utilities
export { findEntry } from "./utils/find-entry";

// Version info
export const version = "0.1.0";
