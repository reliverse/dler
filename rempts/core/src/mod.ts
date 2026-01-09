// Note: createCLI is now async and returns Promise<CLI>

export { SchemaError } from "@standard-schema/utils";
export { createApp, createCLI } from "./cli";
export { defineConfig, type RemptsConfig, remptsConfigSchema } from "./config";
export { type LoadedConfig, loadConfig } from "./config-loader";
export type {
  CommandConflict,
  CommandFileInfo,
  CommandFileTree,
} from "./file-loader";
export { createFileCommandLoader, loadCommandsFromDirectory } from "./file-loader";
export {
  clearGeneratedStores,
  createGeneratedHelpers,
  type GeneratedCommandMeta,
  type GeneratedExecutor,
  type GeneratedOptionMeta,
  type GeneratedStore,
  getGeneratedStores,
  registerGeneratedStore,
} from "./generated";
export type { GlobalFlags } from "./global-flags";
// Export global flags
export { GLOBAL_FLAGS } from "./global-flags";
// Export TUI registry
export {
  clearTuiRenderer,
  getTuiRenderer,
  registerTuiRenderer,
} from "./tui/registry";
export type {
  CLI,
  CLIOption,
  Command,
  CommandOptions,
  Handler,
  HandlerArgs,
  Options,
  PluginConfig,
  RegisteredCommands,
  RenderArgs,
  RenderFunction,
  RenderResult,
  ResolvedConfig,
  RuntimeInfo,
  StandardSchemaV1,
  TerminalInfo,
} from "./types";
export { defineCommand, option } from "./types";

// Note: Plugin system is exported via subpath export
// Usage: import { PluginManager, createPlugin } from '@reliverse/rempts-core/plugin'

// Export type utilities
export type {
  Assign,
  Constrain,
  DeepPartial,
  Expand,
  ExtractObjects,
  ExtractPrimitives,
  IntersectAssign,
  IsAny,
  IsNonEmptyObject,
  IsUnion,
  MakeDifferenceOptional,
  MergeAll,
  MergeAllObjects,
  NoInfer,
  PartialMergeAll,
  PickAsRequired,
  PickOptional,
  PickRequired,
  UnionToIntersection,
  WithoutEmpty,
} from "./utils/type-helpers";
// Export validation utilities
export {
  createBatchValidator,
  createValidator,
  isValueOfType,
  validateValue,
  validateValues,
} from "./validation";
