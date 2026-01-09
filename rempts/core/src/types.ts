import type { StandardSchemaV1 } from "@standard-schema/spec";

export type RenderResult = unknown;

export interface TuiRenderOptions {
  exitOnCtrlC?: boolean;
  targetFps?: number;
  enableMouseMovement?: boolean;
  [key: string]: unknown;
}

export interface RenderArgs<TFlags = Record<string, unknown>, TStore = {}>
  extends HandlerArgs<TFlags, TStore> {
  command: Command<any, TStore>;
  rendererOptions?: TuiRenderOptions;
}

export type RenderFunction<TFlags = Record<string, unknown>, TStore = {}> = (
  args: RenderArgs<TFlags, TStore>
) => RenderResult;

// Core Rempts types
/**
 * CLI instance with plugin type information
 */
export interface CLI<TStore = {}> {
  /**
   * Initialize the CLI (load config, etc)
   */
  init(): Promise<void>;

  /**
   * Run the CLI with given arguments
   */
  run(argv?: string[]): Promise<void>;

  /**
   * Execute a command programmatically
   *
   * With generated types, provides full type safety for command names and options
   */
  execute(commandName: string, args?: string[]): Promise<void>;
  execute<T extends keyof RegisteredCommands>(
    commandName: T,
    options: CommandOptions<T>
  ): Promise<void>;
  execute<T extends keyof RegisteredCommands>(
    commandName: T,
    args: string[],
    options: CommandOptions<T>
  ): Promise<void>;

  /**
   * Add a global before hook that runs before command execution
   * This provides a simple API for setup/initialization tasks
   */
  before(hook: BeforeHook<TStore>): void;

  /**
   * Add a global after hook that runs after command execution
   */
  after(hook: AfterHook<TStore>): void;
}

// generic Command type that carries options type information
interface BaseCommand<
  TOptions extends Options = Options,
  TStore = {},
  TName extends string = string,
> {
  name: TName;
  description: string;
  options?: TOptions;
  commands?: Command<any, TStore, any>[];
  alias?: string | string[];
  handler?: Handler<InferOptions<TOptions>, TStore, TName>;
  render?: RenderFunction<InferOptions<TOptions>, TStore>;
}

export type Command<
  TOptions extends Options = Options,
  TStore = {},
  TName extends string = string,
> =
  | (BaseCommand<TOptions, TStore, TName> & {
      handler: Handler<InferOptions<TOptions>, TStore, TName>;
    })
  | (BaseCommand<TOptions, TStore, TName> & {
      render: RenderFunction<InferOptions<TOptions>, TStore>;
    })
  | (BaseCommand<TOptions, TStore, TName> & {
      handler: Handler<InferOptions<TOptions>, TStore, TName>;
      render: RenderFunction<InferOptions<TOptions>, TStore>;
    })
  | (BaseCommand<TOptions, TStore, TName> & {
      commands: Command<any, TStore, any>[];
    });

// Type helper to extract output types from StandardSchemaV1
// Uses StandardSchemaV1.InferOutput which should work with all Standard Schema compatible libraries
type InferSchema<T> = T extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<T> : never;

type InferOptions<T extends Options> = {
  [K in keyof T]: T[K] extends CLIOption<infer S> ? InferSchema<S> : never;
};

// generic Handler type that accepts inferred flags type
export type Handler<
  TFlags = Record<string, unknown>,
  TStore = {},
  TCommandName extends string = string,
> = (args: HandlerArgs<TFlags, TStore, TCommandName>) => void | Promise<void>;

// generic HandlerArgs that accepts flags type
export interface HandlerArgs<
  TFlags = Record<string, unknown>,
  TStore = {},
  TCommandName extends string = string,
> {
  // ✨ Automatic type inference based on command name ✨
  flags: TCommandName extends keyof RegisteredCommands ? CommandOptions<TCommandName> : TFlags;
  positional: string[];
  shell: typeof Bun.$;
  env: typeof process.env;
  cwd: string;
  // Utilities
  prompt: typeof import("@reliverse/rempts-utils").prompt;
  spinner: typeof import("@reliverse/rempts-utils").spinner;
  colors: typeof import("@reliverse/relico").relico;
  // Plugin context (if plugins are loaded)
  context?: import("./plugin/types.js").CommandContext<any>;
  // Data set by global before hooks
  hooks?: Record<string, any>;
  // Terminal information
  terminal: TerminalInfo;
  // Runtime information
  runtime: RuntimeInfo;
}

export interface TerminalInfo {
  width: number;
  height: number;
  isInteractive: boolean;
  isCI: boolean;
  supportsColor: boolean;
  supportsMouse: boolean;
}

export interface RuntimeInfo {
  startTime: number;
  args: string[];
  command: string;
}

// CLI option with metadata - generic to preserve schema type
export interface CLIOption<S extends StandardSchemaV1 = StandardSchemaV1> {
  schema: S;
  short?: string;
  description?: string;
}

// Options must use the CLIOption wrapper
export type Options = Record<string, CLIOption<any>>;

// Define command helper with proper type inference
export function defineCommand<
  TOptions extends Options = Options,
  TStore = {},
  TName extends string = string,
>(
  command: Command<TOptions, TStore> & { name: TName }
): Command<TOptions, TStore> & { name: TName } {
  return command;
}

// Import configuration types from schema
import type { RemptsConfig } from "./config";

export type { RemptsConfig } from "./config";
export { remptsConfigSchema } from "./config";
export type {
  GeneratedCommandMeta,
  GeneratedExecutor,
  GeneratedOptionMeta,
  GeneratedStore,
} from "./generated";

// Plugin configuration type (imported from plugin/types)
export type PluginConfig = import("./plugin/types.js").PluginConfig;

/**
 * Interface for registered commands (augmented by generated types)
 * This will be populated by commands.gen.ts via module augmentation
 *
 * @example
 * // In commands.gen.ts:
 * declare module '@reliverse/rempts-core' {
 *   interface RegisteredCommands extends CommandsByName {}
 * }
 */
export type RegisteredCommands = Record<string, never>;

/**
 * Get command options type from registered commands
 * Uses Standard Schema's InferOutput to extract types from schemas
 */
export type CommandOptions<T extends keyof RegisteredCommands> =
  RegisteredCommands[T] extends Command<infer TOptions, any, any> ? InferOptions<TOptions> : never;

export type CommandFlags<TCommand extends Command<any, any, any>> =
  TCommand extends Command<infer TOptions, any, any> ? InferOptions<TOptions> : never;

/**
 * Get all registered command names
 */
export type RegisteredCommandNames = keyof RegisteredCommands;

// Resolved config after all plugins have run
// Codegen is handled internally and not part of the resolved config
export type ResolvedConfig = Required<
  Omit<RemptsConfig, "build" | "dev" | "test" | "workspace" | "release">
> & {
  build: NonNullable<RemptsConfig["build"]>;
  dev: NonNullable<RemptsConfig["dev"]>;
  test: NonNullable<RemptsConfig["test"]>;
  workspace: NonNullable<RemptsConfig["workspace"]>;
  release: NonNullable<RemptsConfig["release"]>;
};

/**
 * Hook context passed to before/after hooks
 */
export interface HookContext<TStore = {}> {
  /** Global flags parsed from command line */
  flags: Record<string, unknown>;
  /** Store from plugins (if any) */
  store: TStore;
  /** Environment variables */
  env: typeof process.env;
  /** Current working directory */
  cwd: string;
  /** Set data that will be available to command handlers */
  set(key: string, value: any): void;
  /** Get data that was set by hooks */
  get(key: string): any;
}

/**
 * Before hook function type
 */
export type BeforeHook<TStore = {}> = (context: HookContext<TStore>) => void | Promise<void>;

/**
 * After hook function type
 */
export type AfterHook<TStore = {}> = (
  context: HookContext<TStore> & { exitCode: number; error?: Error }
) => void | Promise<void>;

/**
 * Rich validation error with context information
 */
export class RemptsValidationError extends Error {
  constructor(
    message: string,
    readonly context: {
      option: string;
      value: unknown;
      command: string;
      expectedType: string;
      hint?: string;
    }
  ) {
    super(message);
    this.name = "RemptsValidationError";
  }

  override toString(): string {
    return `${this.name}: Invalid option '${this.context.option}' for command '${this.context.command}'
    
Expected: ${this.context.expectedType}
Received: ${typeof this.context.value} (${JSON.stringify(this.context.value)})
${this.context.hint ? `\nHint: ${this.context.hint}` : ""}`;
  }
}

// Helper to create a CLI option with metadata
export function option<S extends StandardSchemaV1>(
  schema: S,
  metadata?: { short?: string; description?: string }
): CLIOption<S> {
  return {
    schema,
    ...metadata,
  };
}
