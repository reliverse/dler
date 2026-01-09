/**
 * Plugin lifecycle manager - functional implementation
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { RemptsConfig, ResolvedConfig } from "../types";
import { createLogger } from "../utils/logger";
import { deepMerge } from "../utils/merge";
import { createCommandContext, createEnvironmentInfo } from "./context";
import { createPluginLoader } from "./loader";
import { combinePluginStores, type PluginStore } from "./store.js";
import type {
  CommandDefinition,
  CommandResult,
  Middleware,
  Plugin,
  PluginConfig,
  PluginHooks,
} from "./types";

export interface PluginSetupResult {
  config: Partial<RemptsConfig>;
  commands: CommandDefinition[];
  middlewares: Middleware[];
}

export interface PluginManagerState<TStore = {}> {
  plugins: Plugin[];
  pluginHooks: PluginHooks[];
  combinedStore?: PluginStore<TStore>;
  loader: ReturnType<typeof createPluginLoader>;
  logger: ReturnType<typeof createLogger>;
}

/**
 * Create a new plugin manager state
 */
export function createPluginManager<TStore = {}>(): PluginManagerState<TStore> {
  return {
    plugins: [],
    pluginHooks: [],
    combinedStore: undefined,
    loader: createPluginLoader(),
    logger: createLogger("plugin-manager"),
  };
}

/**
 * Load and validate plugins
 */
export async function loadPlugins<TStore>(
  state: PluginManagerState<TStore>,
  configs: PluginConfig[]
): Promise<void> {
  // Load all plugins
  const loadPromises = configs.map(async (config) => {
    try {
      const plugin = await state.loader.loadPlugin(config);
      state.loader.validatePlugin(plugin);
      return plugin;
    } catch (error: any) {
      state.logger.error(`Failed to load plugin: ${error.message}`);
      throw error;
    }
  });

  state.plugins = await Promise.all(loadPromises);

  // Instantiate hooks for all plugins
  state.pluginHooks = state.plugins.map((plugin) => plugin());

  // Combine all plugin stores using Zustand
  const stores: Record<string, PluginStore<any>> = {};
  state.pluginHooks.forEach((hooks, index) => {
    if (hooks.store) {
      stores[`plugin_${index}`] = hooks.store;
    }
  });

  if (Object.keys(stores).length > 0) {
    state.combinedStore = combinePluginStores(stores) as any;
  }

  state.logger.info(`Loaded ${state.plugins.length} plugins`);
}

/**
 * Run setup hooks for all plugins
 */
export async function runSetup<TStore>(
  state: PluginManagerState<TStore>,
  config: Partial<RemptsConfig>
): Promise<PluginSetupResult> {
  // Create a stateful context that can collect results
  const setupState = {
    configUpdates: [] as Partial<RemptsConfig>[],
    commands: [] as CommandDefinition[],
    middlewares: [] as Middleware[],
  };

  const context = {
    config,
    store: state.combinedStore,
    logger: createLogger("plugins"),
    paths: {
      cwd: process.cwd(),
      home: homedir(),
      config: join(homedir(), ".config", config.name || "rempts"),
    },

    updateConfig(partial: Partial<RemptsConfig>): void {
      setupState.configUpdates.push(partial);
    },

    registerCommand(command: CommandDefinition): void {
      setupState.commands.push(command);
    },

    use(middleware: Middleware): void {
      setupState.middlewares.push(middleware);
    },
  };

  // Run all setup hooks
  for (const hooks of state.pluginHooks) {
    if (hooks.setup) {
      state.logger.debug(`Running setup for plugin`);
      try {
        await hooks.setup(context as any);
      } catch (error: any) {
        throw new Error(`Plugin setup failed: ${error.message}`);
      }
    }
  }

  // Merge all config updates
  const mergedConfig =
    setupState.configUpdates.length > 0 ? deepMerge(config, ...setupState.configUpdates) : config;

  return {
    config: mergedConfig,
    commands: setupState.commands,
    middlewares: setupState.middlewares,
  };
}

/**
 * Run configResolved hooks
 */
export async function runConfigResolved<TStore>(
  state: PluginManagerState<TStore>,
  config: ResolvedConfig
): Promise<void> {
  for (const hooks of state.pluginHooks) {
    if (hooks.configResolved) {
      state.logger.debug(`Running configResolved for plugin`);
      try {
        await hooks.configResolved(config);
      } catch (error: any) {
        // Log but don't fail - config is already resolved
        state.logger.error(`Plugin configResolved error: ${error.message}`);
      }
    }
  }
}

/**
 * Run beforeCommand hooks
 */
export async function runBeforeCommand<TStore>(
  state: PluginManagerState<TStore>,
  command: string,
  commandDef: any,
  args: string[],
  flags: Record<string, any>
): Promise<ReturnType<typeof createCommandContext<TStore>>> {
  // Use the combined store directly (Zustand handles immutability)
  const commandStore = state.combinedStore;

  const context = createCommandContext<TStore>(
    command,
    commandDef,
    args,
    flags,
    createEnvironmentInfo(),
    commandStore as any
  );

  // Run all beforeCommand hooks
  for (const hooks of state.pluginHooks) {
    if (hooks.beforeCommand) {
      state.logger.debug(`Running beforeCommand for plugin`);
      try {
        await hooks.beforeCommand(context as any);
      } catch (error: any) {
        throw new Error(`Plugin beforeCommand failed: ${error.message}`);
      }
    }
  }

  return context;
}

/**
 * Run afterCommand hooks
 */
export async function runAfterCommand<TStore>(
  state: PluginManagerState<TStore>,
  context: ReturnType<typeof createCommandContext<TStore>>,
  result: CommandResult
): Promise<void> {
  const fullContext = Object.assign(context, result);

  // Run all afterCommand hooks
  for (const hooks of state.pluginHooks) {
    if (hooks.afterCommand) {
      state.logger.debug(`Running afterCommand for plugin`);
      try {
        await hooks.afterCommand(fullContext as any);
      } catch (error: any) {
        // Log error but don't fail - command already executed
        state.logger.error(`Plugin afterCommand error: ${error.message}`);
      }
    }
  }
}

/**
 * Get loaded plugins (for debugging/listing)
 */
export function getPlugins<TStore>(state: PluginManagerState<TStore>): readonly Plugin[] {
  return state.plugins;
}

/**
 * Get plugin hooks by index
 */
export function getPlugin<TStore>(
  state: PluginManagerState<TStore>,
  index: number
): PluginHooks | undefined {
  return state.pluginHooks[index];
}
