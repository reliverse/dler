/**
 * Zustand store utilities for Rempts plugin system
 */

import { createStore, type StoreApi } from "zustand";

/**
 * Generic Zustand store interface for plugins
 */
export interface PluginStore<TState = any> extends StoreApi<TState> {
  /**
   * Get the current state
   */
  getState(): TState;

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: TState, prevState: TState) => void): () => void;

  /**
   * Set new state
   */
  setState(updater: TState | ((prevState: TState) => TState)): void;

  /**
   * Destroy the store
   */
  destroy(): void;
}

/**
 * Create a Zustand store for a plugin
 */
export function createPluginStore<TState>(initialState: TState): PluginStore<TState> {
  const store = createStore<TState>()(() => initialState);

  return {
    ...store,
    destroy: () => {
      // Zustand stores don't have a built-in destroy method
      // but we provide this for consistency
    },
  };
}

/**
 * Combine multiple plugin stores into a single store
 */
export function combinePluginStores<TCombined>(
  stores: Record<string, PluginStore<any>>
): PluginStore<TCombined> {
  // Create initial combined state
  const initialState = Object.keys(stores).reduce((acc, key) => {
    const store = stores[key];
    if (store) {
      acc[key] = store.getState();
    }
    return acc;
  }, {} as any);

  const combinedStore = createStore<TCombined>()(() => initialState);

  // Subscribe to all individual stores and update combined store
  const unsubscribers = Object.keys(stores).map((key) => {
    const store = stores[key];
    if (store) {
      return store.subscribe((state) => {
        combinedStore.setState((prevState: TCombined) => ({
          ...prevState,
          [key]: state,
        }));
      });
    }
    return () => {}; // Return empty unsubscribe function if store is undefined
  });

  return {
    ...combinedStore,
    destroy: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
  };
}

/**
 * Type helper for plugin store state
 */
export type PluginStoreState<TStore extends PluginStore<any>> = ReturnType<TStore["getState"]>;

/**
 * Middleware for logging store changes (useful for debugging)
 */
export function createLoggingMiddleware<TState>() {
  return (config: any) => (set: any, get: any, api: any) =>
    config(
      (...args: any[]) => {
        console.log("Store before:", get());
        set(...args);
        console.log("Store after:", get());
      },
      get,
      api
    );
}

/**
 * Create a store with logging enabled
 */
export function createPluginStoreWithLogging<TState>(
  initialState: TState,
  enableLogging = false
): PluginStore<TState> {
  if (enableLogging) {
    const store = createStore<TState>()(createLoggingMiddleware<TState>()(() => initialState));

    return {
      ...store,
      destroy: () => {},
    };
  }

  return createPluginStore(initialState);
}
