// Re-export config utilities for use in dler.config.ts files
export {
  defineConfig,
  type LoadedConfig,
  loadConfig,
  type RemptsConfig,
} from "@reliverse/rempts";

// Re-export utilities
export { findEntry } from "./utils/find-entry";

// Version info
export const version = "0.1.0";

// Re-export utilities for programmatic usage
export { createProject } from "./cmds/rempts/impl/create-project";
export {
  isLocalTemplate,
  processTemplate,
  resolveTemplateSource,
} from "./cmds/rempts/impl/template-engine";
export type {
  CreateOptions,
  ProjectConfig,
  TemplateManifest,
  TemplateVariable,
} from "./cmds/rempts/impl/types";
