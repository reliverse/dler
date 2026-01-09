/**
 * Plugin loader implementation - functional approach
 */

import { join } from "node:path";
import type { Plugin, PluginConfig } from "./types";

export interface PluginLoader {
  loadPlugin(config: PluginConfig): Promise<Plugin>;
  validatePlugin(plugin: Plugin): void;
}

/**
 * Check if a value is a valid plugin function
 */
function isPluginFunction(obj: any): obj is Plugin {
  return obj && typeof obj === "function";
}

/**
 * Load plugin from file path
 */
async function loadFromPath(path: string): Promise<Plugin> {
  try {
    // Handle both absolute and relative paths
    const resolvedPath = path.startsWith(".") ? join(process.cwd(), path) : path;

    // Dynamic import
    const module = await import(resolvedPath);

    // Handle various export styles
    const plugin = module.default || module.plugin || module;

    // If it's a factory function, call it without options
    if (typeof plugin === "function" && !isPluginFunction(plugin)) {
      return plugin();
    }

    // Validate it's a plugin function
    if (!isPluginFunction(plugin)) {
      throw new Error("Module does not export a valid plugin");
    }

    return plugin;
  } catch (error: any) {
    throw new Error(`Failed to load plugin from ${path}: ${error.message}`);
  }
}

/**
 * Create a plugin loader
 */
export function createPluginLoader(): PluginLoader {
  return {
    /**
     * Load a plugin from various configuration formats
     */
    async loadPlugin(config: PluginConfig): Promise<Plugin> {
      // String path - dynamic import
      if (typeof config === "string") {
        return loadFromPath(config);
      }

      // Plugin function - use directly
      if (isPluginFunction(config)) {
        return config;
      }

      // Function - call it (legacy factory support)
      if (typeof config === "function") {
        return config();
      }

      // Array - function with options
      if (Array.isArray(config) && config.length === 2) {
        const [factory, options] = config;
        if (typeof factory === "function") {
          return factory(options);
        }
      }

      throw new Error(`Invalid plugin configuration: ${JSON.stringify(config)}`);
    },

    /**
     * Validate loaded plugin
     */
    validatePlugin(plugin: Plugin): void {
      // Validate that it's a function
      if (typeof plugin !== "function") {
        throw new Error("Plugin must be a function");
      }

      // Call the plugin to get hooks and validate them
      try {
        const hooks = plugin();

        // Check hook types
        const hookNames = ["setup", "configResolved", "beforeCommand", "afterCommand"];
        for (const hook of hookNames) {
          const value = hooks[hook as keyof typeof hooks];
          if (value !== undefined && typeof value !== "function") {
            throw new Error(`Plugin hook ${hook} must be a function`);
          }
        }
      } catch (error: any) {
        throw new Error(`Plugin validation failed: ${error.message}`);
      }
    },
  };
}
