/**
 * Plugin system public API
 */

export * from './types'
export { PluginManager } from './manager'
export { PluginContext, CommandContext, createEnvironmentInfo } from './context'

// Plugin development utilities
export { createPlugin, createTestPlugin, composePlugins } from './create'

// Plugin testing utilities
export { 
  createMockPluginContext, 
  createMockCommandContext, 
  testPluginHooks, 
  assertPluginBehavior 
} from './testing'

// Re-export for convenience
export type { 
  RemptsPlugin,
  PluginFactory,
  PluginConfig,
  PluginContext as IPluginContext,
  CommandContext as ICommandContext,
  CommandResult,
  PathInfo,
  EnvironmentInfo,
  Middleware
} from './types'