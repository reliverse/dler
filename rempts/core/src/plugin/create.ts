/**
 * Plugin development utilities
 */

import { createPluginStore, type PluginStore } from "./store.js";
import type { Plugin, PluginFactory, PluginHooks } from "./types";

/**
 * Create a plugin - supports both direct plugins and plugin factories
 *
 * @example Direct plugin with explicit store type:
 * ```typescript
 * interface MyStore {
 *   count: number
 *   message: string
 * }
 *
 * const myPlugin = createPlugin<MyStore>({
 *   name: 'my-plugin',
 *   store: {
 *     count: 0,
 *     message: ''
 *   },
 *   beforeCommand(context) {
 *     context.store.count++ // TypeScript knows the type!
 *   }
 * })
 * ```
 *
 * @example Plugin factory with options:
 * ```typescript
 * const myPlugin = createPlugin((options: { prefix: string }) => ({
 *   name: 'my-plugin',
 *   store: {
 *     count: 0
 *   },
 *   beforeCommand(context) {
 *     console.log(`${options.prefix}: ${context.store.count}`)
 *   }
 * } satisfies PluginHooks<{ count: number }>))
 *
 * // Use it:
 * myPlugin({ prefix: 'Hello' })
 * ```
 */
// Overload for direct plugin
export function createPlugin<TStore = {}>(plugin: Plugin<TStore>): Plugin<TStore>;

export function createPlugin<TOptions, TStore = {}>(
  factory: (options: TOptions) => Plugin<TStore>
): (options: TOptions) => Plugin<TStore>;

export function createPlugin<T>(input: T): T {
  return input;
}

/**
 * Infer plugin options type from a plugin factory
 *
 * @example
 * ```typescript
 * type Options = InferPluginOptions<typeof myPlugin>
 * ```
 */
export type InferPluginOptions<T> = T extends PluginFactory<infer O, any> ? O : never;

/**
 * Infer plugin store type
 *
 * @example
 * ```typescript
 * type Store = InferPluginStore<typeof myPlugin>
 * ```
 */
export type InferPluginStore<T> =
  T extends Plugin<infer S> ? S : T extends PluginFactory<any, infer S> ? S : {};

/**
 * Create a test plugin for development and testing
 *
 * @example
 * ```typescript
 * const testPlugin = createTestPlugin(
 *   { count: 0, message: '' },
 *   {
 *     beforeCommand(context) {
 *       context.store.count++
 *       console.log(`Count: ${context.store.count}`)
 *     }
 *   }
 * )
 * ```
 */
export function createTestPlugin<TStore = {}>(
  initialState: TStore,
  hooks: Partial<PluginHooks<TStore>>
): Plugin<TStore> {
  return () => ({
    store: createPluginStore(initialState),
    ...hooks,
  });
}

/**
 * Compose multiple plugins into a single plugin
 *
 * @example
 * ```typescript
 * const composedPlugin = composePlugins(
 *   authPlugin({ provider: 'github' }),
 *   loggingPlugin({ level: 'debug' }),
 *   metricsPlugin({ enabled: true })
 * )
 * ```
 */
export function composePlugins<T extends Plugin[]>(...plugins: T): Plugin {
  return () => {
    const hooksArray = plugins.map((plugin) => plugin());

    // Collect all stores from plugins
    const stores: Record<string, PluginStore<any>> = {};
    hooksArray.forEach((hooks, index) => {
      if (hooks.store) {
        stores[`plugin_${index}`] = hooks.store;
      }
    });

    // Create combined store if there are any stores
    const composedStore =
      Object.keys(stores).length > 0
        ? createPluginStore(
            Object.keys(stores).reduce((acc, key) => {
              const store = stores[key];
              if (store) {
                acc[key] = store.getState();
              }
              return acc;
            }, {} as any)
          )
        : undefined;

    return {
      store: composedStore,
      async setup(context) {
        for (const hooks of hooksArray) {
          if (hooks.setup) {
            await hooks.setup(context);
          }
        }
      },
      async configResolved(config) {
        for (const hooks of hooksArray) {
          if (hooks.configResolved) {
            await hooks.configResolved(config);
          }
        }
      },
      async beforeCommand(context) {
        for (const hooks of hooksArray) {
          if (hooks.beforeCommand) {
            await hooks.beforeCommand(context);
          }
        }
      },
      async afterCommand(context) {
        for (const hooks of hooksArray) {
          if (hooks.afterCommand) {
            await hooks.afterCommand(context);
          }
        }
      },
    };
  };
}
