/**
 * Core plugin types and interfaces for Rempts
 */

import type { Command, RemptsConfig, ResolvedConfig } from "../types";
import type { Logger } from "../utils/logger";
import type { PluginStore } from "./store";

// Command definition type for plugins
export type CommandDefinition = Command<any>;

/**
 * Functional plugin hooks with store type
 */
export interface PluginHooks<TStore = {}> {
  /** Plugin store - Zustand store instance */
  store?: PluginStore<TStore>;

  /**
   * Setup hook - Called during CLI initialization
   * Can modify configuration and register commands
   */
  setup?: (context: PluginContext) => void | Promise<void>;

  /**
   * Config resolved hook - Called after all configuration is finalized
   * Config is now immutable
   */
  configResolved?: (config: ResolvedConfig) => void | Promise<void>;

  /**
   * Before command hook - Called before command execution
   * Can inject context and validate
   * Uses generic constraints to preserve store type information
   */
  beforeCommand?: (context: CommandContext<any>) => void | Promise<void>;

  /**
   * After command hook - Called after command execution
   * Receives result or error from command
   * Uses generic constraints to preserve store type information
   */
  afterCommand?: (context: CommandContext<any> & CommandResult) => void | Promise<void>;
}

/**
 * Core plugin function that returns hooks
 */
export type Plugin<TStore = {}> = () => PluginHooks<TStore>;

/**
 * Extract store type from plugin hooks
 */
export type StoreOf<P> = P extends PluginHooks<infer S> ? S : {};

/**
 * Merge multiple plugin stores into one type
 */
export type MergeStores<Plugins extends readonly PluginHooks[]> = Plugins extends readonly []
  ? {}
  : Plugins extends readonly [infer First, ...infer Rest]
    ? First extends PluginHooks
      ? Rest extends readonly PluginHooks[]
        ? StoreOf<First> & MergeStores<Rest>
        : StoreOf<First>
      : {}
    : {};

/**
 * Merge stores from plugin functions
 */
export type MergePluginStores<Plugins extends readonly Plugin[]> = Plugins extends readonly []
  ? {}
  : Plugins extends readonly [infer First, ...infer Rest]
    ? First extends Plugin<infer S>
      ? Rest extends readonly Plugin[]
        ? S & MergePluginStores<Rest>
        : S
      : {}
    : {};

/**
 * Plugin factory function type - returns a function that creates hooks
 */
export type PluginFactory<TOptions = any, TStore = {}> = (options?: TOptions) => Plugin<TStore>;

/**
 * Command execution result
 */
export interface CommandResult {
  /** Command return value */
  result?: any;

  /** Error if command failed */
  error?: Error;

  /** Exit code */
  exitCode?: number;
}

/**
 * Plugin configuration types
 */
export type PluginConfig =
  | string // Path to plugin
  | Plugin // Plugin function
  | PluginFactory // Plugin factory function
  | [PluginFactory, any]; // Plugin with options

/**
 * Plugin context available during setup
 */
export interface PluginContext {
  /** Current configuration (being built) */
  readonly config: Partial<RemptsConfig>;

  /** Update configuration */
  updateConfig(partial: Partial<RemptsConfig>): void;

  /** Register a new command */
  registerCommand(command: CommandDefinition): void;

  /** Add global middleware */
  use(middleware: Middleware): void;

  /** Shared storage between plugins */
  readonly store: PluginStore<any>;

  /** Plugin logger */
  readonly logger: Logger;

  /** System paths */
  readonly paths: PathInfo;
}

/**
 * Command execution context
 */
export interface CommandContext<TStore = {}> {
  /** Command name being executed */
  readonly command: string;

  /** The Command object being executed */
  readonly commandDef: Command<any, TStore>;

  /** Positional arguments */
  readonly args: string[];

  /** Parsed flags/options */
  readonly flags: Record<string, any>;

  /** Environment information */
  readonly env: EnvironmentInfo;

  /** Type-safe context store */
  readonly store?: PluginStore<TStore>;

  /** Type-safe store value access */
  getStoreValue<K extends keyof TStore>(key: K): TStore[K];
  getStoreValue(key: string | number | symbol): any;

  /** Type-safe store value update */
  setStoreValue<K extends keyof TStore>(key: K, value: TStore[K]): void;
  setStoreValue(key: string | number | symbol, value: any): void;

  /** Check if a store property exists */
  hasStoreValue<K extends keyof TStore>(key: K): boolean;
  hasStoreValue(key: string | number | symbol): boolean;
}

/**
 * System path information
 */
export interface PathInfo {
  /** Current working directory */
  cwd: string;

  /** User home directory */
  home: string;

  /** Config directory path */
  config: string;
}

/**
 * Environment information
 */
export interface EnvironmentInfo {
  /** Running in CI environment */
  isCI: boolean;

  /** Additional properties that plugins can add */
  [key: string]: any;
}

/**
 * Middleware function type
 */
export type Middleware = (context: CommandContext, next: () => Promise<any>) => Promise<any>;

/**
 * Plugin extension interfaces
 *
 * Note: Plugins should extend these interfaces directly in their own code
 * rather than using module augmentation, as that creates circular dependencies.
 */
