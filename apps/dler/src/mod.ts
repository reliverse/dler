// Re-export config utilities for use in dler.config.ts files
export {
  defineConfig,
  type LoadedConfig,
  loadConfig,
  type RemptsConfig,
} from "@reliverse/rempts-core";

// Re-export utilities
export { findEntry } from "./utils/find-entry";

// Version info
export const version = "0.1.0";
