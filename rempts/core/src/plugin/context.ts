/**
 * Plugin context implementations - functional approach
 */

import type { PluginStore } from "./store.js";
import type { EnvironmentInfo, CommandContext as ICommandContext } from "./types";

/**
 * Create environment info for contexts
 */
export function createEnvironmentInfo(): EnvironmentInfo {
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS
  );

  return {
    cwd: process.cwd(),
    home: require("node:os").homedir(),
    temp: require("node:os").tmpdir(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    isCI,
    // Initialize plugin-extended properties with defaults
    isAIAgent: false,
    aiAgents: [],
  };
}

// Plugin context is now created internally in the plugin manager
// to avoid interface mismatches

/**
 * Create command context for command execution
 */
export function createCommandContext<TStore = {}>(
  command: string,
  commandDef: any,
  args: string[],
  flags: Record<string, any>,
  env: EnvironmentInfo,
  store?: PluginStore<TStore>
): ICommandContext<TStore> {
  return {
    command,
    commandDef,
    args,
    flags,
    env,
    store,

    /**
     * Type-safe store value access
     * Provides compile-time type checking for store properties
     */
    getStoreValue(key: keyof TStore | string | number | symbol): any {
      if (!store) return undefined;
      const state = store.getState();
      return (state as any)[key];
    },

    /**
     * Type-safe store value update
     * Provides compile-time type checking for store property updates
     */
    setStoreValue(key: keyof TStore | string | number | symbol, value: any): void {
      if (!store) return;
      store.setState((prevState: TStore) => ({
        ...prevState,
        [key]: value,
      }));
    },

    /**
     * Check if a store property exists
     */
    hasStoreValue(key: keyof TStore | string | number | symbol): boolean {
      if (!store) return false;
      const state = store.getState();
      return key in (state as object);
    },
  };
}
