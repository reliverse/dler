/**
 * Plugin system public API
 */

export {
  createCommandContext,
  createEnvironmentInfo,
} from "./context";
// Plugin development utilities
export { composePlugins, createPlugin, createTestPlugin } from "./create";
export {
  createPluginManager,
  getPlugin,
  getPlugins,
  loadPlugins,
  runAfterCommand,
  runBeforeCommand,
  runConfigResolved,
  runSetup,
} from "./manager";
// Store utilities
export {
  combinePluginStores,
  createPluginStore,
  createPluginStoreWithLogging,
  type PluginStore,
  type PluginStoreState,
} from "./store";
// Plugin testing utilities
export {
  assertPluginBehavior,
  createMockCommandContext,
  createMockPluginContext,
  testPluginHooks,
} from "./testing";
// Re-export for convenience
export type {
  CommandContext as ICommandContext,
  CommandResult,
  EnvironmentInfo,
  MergePluginStores,
  MergeStores,
  Middleware,
  PathInfo,
  Plugin,
  PluginConfig,
  PluginContext as IPluginContext,
  PluginFactory,
  PluginHooks,
} from "./types";
export * from "./types";
