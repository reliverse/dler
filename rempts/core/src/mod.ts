// Note: createCLI is now async and returns Promise<CLI>
export { createCLI } from "./cli";
export { defineCommand, option } from "./types";
export { defineConfig, remptsConfigSchema, type RemptsConfig } from "./config";
export { loadConfig, type LoadedConfig } from "./config-loader";
export {
  createGeneratedHelpers,
  registerGeneratedStore,
  getGeneratedStores,
  clearGeneratedStores,
  type GeneratedStore,
  type GeneratedCommandMeta,
  type GeneratedOptionMeta,
  type GeneratedExecutor,
} from "./generated";
export { SchemaError } from "@standard-schema/utils";
export { FileCommandLoader, loadCommandsFromDirectory } from "./file-loader";
export type { CommandFileInfo, CommandFileTree, CommandConflict } from "./file-loader";
export type {
  CLI,
  Command,
  Handler,
  HandlerArgs,
  RenderArgs,
  RenderFunction,
  Options,
  CLIOption,
  CommandManifest,
  CommandLoader,
  StandardSchemaV1,
  PluginConfig,
  ResolvedConfig,
  TerminalInfo,
  RuntimeInfo,
  RenderResult,
  RegisteredCommands,
  CommandOptions,
} from "./types";

// Export global flags
export { GLOBAL_FLAGS } from "./global-flags";
export type { GlobalFlags } from "./global-flags";

// Export TUI registry
export { registerTuiRenderer, clearTuiRenderer, getTuiRenderer } from "./tui/registry";

// Note: Plugin system is exported via subpath export
// Usage: import { PluginManager, createPlugin } from '@reliverse/rempts/plugin'

// Export validation utilities
export {
  validateValue,
  validateValues,
  isValueOfType,
  createValidator,
  createBatchValidator,
} from "./validation";

// Export type utilities
export type {
  UnionToIntersection,
  Constrain,
  PickRequired,
  PickOptional,
  ExtractPrimitives,
  ExtractObjects,
  PartialMergeAll,
  MergeAllObjects,
  MergeAll,
  NoInfer,
  IsAny,
  PickAsRequired,
  WithoutEmpty,
  Expand,
  DeepPartial,
  MakeDifferenceOptional,
  IsUnion,
  IsNonEmptyObject,
  Assign,
  IntersectAssign,
} from "./utils/type-helpers";
