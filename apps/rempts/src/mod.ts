// Re-export utilities for programmatic usage
export { createProject } from "./create-project";
export { processTemplate, resolveTemplateSource, isLocalTemplate } from "./template-engine";
export type { CreateOptions, ProjectConfig, TemplateManifest, TemplateVariable } from "./types";

// Version info
export const version = "0.1.0";
