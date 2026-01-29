/**
 * Config merger plugin for Rempts
 * Loads configuration from multiple sources and merges them
 */

import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPlugin } from "@reliverse/rempts/plugin";
import { deepMerge } from "@reliverse/rempts/utils";

export interface ConfigPluginOptions {
  /**
   * Config file sources to load
   * Supports template variables: {{name}} for app name
   * Default: ['~/.config/{{name}}/config.json', '.{{name}}rc', '.{{name}}rc.json']
   */
  sources?: string[];

  /**
   * Merge strategy
   * - 'deep': Recursively merge objects (default)
   * - 'shallow': Only merge top-level properties
   */
  mergeStrategy?: "shallow" | "deep";

  /**
   * Whether to stop on first found config
   * Default: false (loads and merges all found configs)
   */
  stopOnFirst?: boolean;
}

/**
 * Config merger plugin factory
 */
export const configMergerPlugin = createPlugin<ConfigPluginOptions, {}>((options = {}) => {
  const sources = options.sources || [
    "~/.config/{{name}}/config.json",
    ".{{name}}rc",
    ".{{name}}rc.json",
    ".config/{{name}}.json",
  ];

  return () => ({
    async setup(context) {
      const appName = context.config.name || "rempts";
      const configs: any[] = [];

      for (const source of sources) {
        // Resolve template variables and home directory
        let path = source.replace(/^~/, homedir()).replace(/\{\{name\}\}/g, appName);

        // Resolve relative paths from context cwd
        if (!(path.startsWith("/") || path.startsWith(homedir()))) {
          path = join(context.paths.cwd, path);
        }

        try {
          // Check if file exists
          await access(path);

          // Read and parse config
          const content = await readFile(path, "utf-8");
          let config: any;

          try {
            config = JSON.parse(content);
          } catch (parseError) {
            context.logger.warn(`Failed to parse config file ${path}: ${parseError}`);
            continue;
          }

          configs.push(config);
          context.logger.debug(`Loaded config from ${path}`);

          // Stop if requested
          if (options.stopOnFirst) {
            break;
          }
        } catch {
          // File doesn't exist, skip silently
          context.logger.debug(`Config file not found: ${path}`);
        }
      }

      if (configs.length > 0) {
        // Merge all found configs
        let merged: any;

        if (options.mergeStrategy === "shallow") {
          merged = Object.assign({}, ...configs);
        } else {
          // Deep merge is already available
          merged = deepMerge(...configs);
        }

        context.updateConfig(merged);
        context.logger.info(`Merged ${configs.length} config file(s)`);
      }
    },
  });
});

// Default export for convenience
export default configMergerPlugin;
