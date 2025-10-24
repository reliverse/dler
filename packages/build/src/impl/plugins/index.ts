// packages/build/src/impl/plugins/index.ts

import { logger } from "@reliverse/dler-logger";
import type { BunBuildConfig, DlerPlugin } from "../types";

export class PluginRegistry {
  private plugins = new Map<string, DlerPlugin>();

  register(plugin: DlerPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn(`Plugin ${plugin.name} is already registered`);
      return;
    }
    this.plugins.set(plugin.name, plugin);
    logger.debug(`Registered plugin: ${plugin.name}`);
  }

  getPlugin(name: string): DlerPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): DlerPlugin[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  clear(): void {
    this.plugins.clear();
  }
}

export const pluginRegistry = new PluginRegistry();

export { AssetOptimizationPlugin } from "./asset-optimization";
export { BundleAnalyzerPlugin } from "./bundle-analyzer";
export { CSSModulesPlugin } from "./css-modules";
export { PerformancePlugin } from "./performance";
// Built-in plugins
export { ReactRefreshPlugin } from "./react-refresh";
export { SVGAsReactPlugin } from "./svg-as-react";
export { TypeScriptDeclarationsPlugin } from "./typescript-declarations";
export { WorkerPlugin } from "./worker";

// Plugin utilities
export function createPlugin(name: string, setup: (build: BunBuildConfig) => void): DlerPlugin {
  return {
    name,
    setup,
  };
}

export function loadPlugins(pluginNames: string[]): DlerPlugin[] {
  const plugins: DlerPlugin[] = [];
  
  for (const name of pluginNames) {
    const plugin = pluginRegistry.getPlugin(name);
    if (plugin) {
      plugins.push(plugin);
    } else {
      logger.warn(`Plugin ${name} not found in registry`);
    }
  }
  
  return plugins;
}

export function applyPlugins(plugins: DlerPlugin[], buildConfig: BunBuildConfig): void {
  for (const plugin of plugins) {
    try {
      plugin.setup(buildConfig);
      logger.debug(`Applied plugin: ${plugin.name}`);
    } catch (error) {
      logger.error(`Failed to apply plugin ${plugin.name}: ${error}`);
    }
  }
}
