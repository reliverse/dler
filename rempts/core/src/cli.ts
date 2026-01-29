import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { relico } from "@reliverse/relico";
import { getDotPath, SchemaError } from "@standard-schema/utils";
import { type RemptsConfigStrict, remptsConfigSchema, remptsConfigStrictSchema } from "./config";
import { type LoadedConfig, loadConfig } from "./config-loader";
import { createFileCommandLoader } from "./file-loader";
import { GLOBAL_FLAGS, type GlobalFlags } from "./global-flags";
import { parseArgs } from "./parser";
import {
  createPluginManager,
  loadPlugins,
  runAfterCommand,
  runBeforeCommand,
  runConfigResolved,
  runSetup,
} from "./plugin/manager";
import type { CommandContext, MergePluginStores, Plugin, PluginConfig } from "./plugin/types";
import { getTuiRenderer } from "./tui/registry";
import type {
  AfterHook,
  BeforeHook,
  CLI,
  CLIOption,
  Command,
  HookContext,
  InferMergedOptions,
  MergedOptions,
  Options,
  RemptsConfig,
  ResolvedConfig,
  RuntimeInfo,
  TerminalInfo,
} from "./types";

export async function createApp<
  TPlugins extends readonly Plugin[] = [],
  TDefaultCommand extends string | undefined = undefined,
>(
  options: {
    /**
     * CLI configuration override
     */
    config?: Partial<RemptsConfig> & {
      plugins?: TPlugins;
    };
    /**
     * Default command to run when no arguments are provided
     */
    defaultCommand?: TDefaultCommand;
    /**
     * Whether to auto-initialize commands from config
     * @default true
     */
    autoInit?: boolean;
    /**
     * Custom config directory (overrides --cwd detection)
     */
    configDir?: string;
    /**
     * Entry file path (e.g., import.meta.path or __filename)
     * If not provided, will be auto-detected from call stack
     * Commands directory will be <entry-file-dir>/cmds
     */
    entryFile?: string;
  } = {}
): Promise<CLI<MergePluginStores<TPlugins>>> {
  const {
    config: configOverride,
    defaultCommand,
    autoInit = true,
    configDir: customConfigDir,
    entryFile,
  } = options;

  // Auto-detect config directory from --cwd flag or current directory
  let configDir = customConfigDir || process.cwd();

  if (!customConfigDir) {
    // Parse --cwd flag before loading config
    const args = process.argv.slice(2);
    const cwdIndex = args.indexOf("--cwd");
    if (cwdIndex !== -1 && cwdIndex + 1 < args.length && args[cwdIndex + 1]) {
      const cwdArg = args[cwdIndex + 1] as string;
      configDir = cwdArg.startsWith("/") ? cwdArg : resolve(process.cwd(), cwdArg);
      // Remove --cwd and its value from args
      args.splice(cwdIndex, 2);
      // Update process.argv to reflect the changes
      process.argv = [process.argv[0] || "", process.argv[1] || "", ...args];
    } else {
      // No --cwd provided, try to auto-discover config location
      try {
        // First try current directory
        await loadConfig(process.cwd());
        configDir = process.cwd();
      } catch {
        // If not found, try apps/dler relative to current directory (monorepo support)
        const monorepoConfigDir = resolve(process.cwd(), "apps/dler");
        try {
          await loadConfig(monorepoConfigDir);
          configDir = monorepoConfigDir;
        } catch {
          // If still not found, keep original cwd (will fail with proper error message)
          configDir = process.cwd();
        }
      }
    }
  }

  // Load config from the detected directory
  let loadedConfigData: LoadedConfig | null = null;
  try {
    loadedConfigData = await loadConfig(configDir);
  } catch {
    // Config not found, will use override only
  }

  // Create final config by merging loaded config with override
  const finalConfigOverride = (() => {
    // Start with loaded config or override
    let baseConfig = loadedConfigData || configOverride;

    if (loadedConfigData && configOverride) {
      // Merge loaded config with override, ensuring plugins type compatibility
      const { plugins: overridePlugins, ...overrideRest } = configOverride;
      baseConfig = {
        ...loadedConfigData,
        ...overrideRest,
        // Override plugins only if explicitly provided in configOverride
        ...(overridePlugins !== undefined ? { plugins: overridePlugins as any } : {}),
      } as any;
    }

    // Resolve relative paths in config to absolute paths based on config directory
    function resolveConfigPaths(obj: any, baseDir: string): any {
      if (typeof obj === "string" && obj.startsWith("./")) {
        return resolve(baseDir, obj);
      }
      if (Array.isArray(obj)) {
        return obj.map((item) => resolveConfigPaths(item, baseDir));
      }
      if (obj && typeof obj === "object") {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = resolveConfigPaths(value, baseDir);
        }
        return result;
      }
      return obj;
    }

    if (baseConfig) {
      baseConfig = resolveConfigPaths(baseConfig, configDir);
    }

    // Ensure commands directory is resolved relative to configDir if it exists
    if (baseConfig?.commands?.directory && typeof baseConfig.commands.directory === "string") {
      (baseConfig as any).commands.directory = baseConfig.commands.directory.startsWith(".")
        ? resolve(configDir, baseConfig.commands.directory)
        : baseConfig.commands.directory;
    }

    return baseConfig as
      | (Partial<RemptsConfig> & {
          plugins?: TPlugins;
        })
      | undefined;
  })();

  const cli = await createCLI(finalConfigOverride || {}, entryFile);

  // Load commands from directory (if autoInit)
  if (autoInit) {
    await cli.init();
  }

  // Handle default command injection
  if (defaultCommand) {
    const originalRun = cli.run.bind(cli);
    cli.run = async (argv = process.argv.slice(2)) => {
      // If no arguments or only flags, inject default command
      if (argv.length === 0 || argv[0]?.startsWith("-")) {
        process.argv.splice(2, 0, defaultCommand);
        argv = [defaultCommand, ...argv];
      }
      // If first arg is not a flag and not the default command, it's a project name - inject default command
      else if (argv[0] && !argv[0].startsWith("-") && argv[0] !== defaultCommand) {
        process.argv.splice(2, 0, defaultCommand);
        argv = [defaultCommand, ...argv];
      }

      return originalRun(argv);
    };
  }

  return cli;
}

/**
 * Get entry file path from call stack
 * Tries to find the first file that's not in rempts-core
 */
function getEntryFileFromStack(): string | undefined {
  try {
    const stack = new Error("Stack trace").stack;
    if (!stack) return undefined;

    const lines = stack.split("\n");
    // Skip first line (Error message) and second line (this function)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Match file paths in stack traces
      // Bun format: at function (file:///path/to/file.ts:line:col)
      // Node format: at function (/path/to/file.ts:line:col)
      const match = line.match(/\(?(file:\/\/\/?|)([^:]+\.(ts|js|mjs)):\d+:\d+\)?/);
      if (match) {
        const filePath = match[2];
        if (filePath && !filePath.includes("rempts-core") && !filePath.includes("node_modules")) {
          // Convert file:// URL to path if needed
          if (filePath.startsWith("file://")) {
            return fileURLToPath(filePath);
          }
          return filePath;
        }
      }
    }
  } catch (_error) {
    // Ignore errors in stack parsing
  }
  return undefined;
}

export async function createCLI<TPlugins extends readonly Plugin[] = []>(
  configOverride?: Partial<RemptsConfig> & {
    plugins?: TPlugins;
  },
  entryFile?: string
): Promise<CLI<MergePluginStores<TPlugins>>> {
  type TStore = MergePluginStores<TPlugins>;

  // Auto-load config from dler.config.ts (optional)
  let loadedConfigData: LoadedConfig | null = null;
  try {
    loadedConfigData = await loadConfig();
  } catch {
    // Config file is optional - if not found, use override or defaults
    loadedConfigData = null;
  }

  // Use loaded config or create from override
  let baseConfig =
    loadedConfigData || (remptsConfigSchema.assert(configOverride || {}) as LoadedConfig);

  // Determine commands directory from entry file
  // Commands directory is always <entry-file-dir>/cmds
  let cmdsDir: string;
  const detectedEntryFile = entryFile || getEntryFileFromStack();

  if (detectedEntryFile) {
    // Resolve entry file to absolute path
    const entryFilePath = detectedEntryFile.startsWith("file://")
      ? fileURLToPath(detectedEntryFile)
      : resolve(detectedEntryFile);
    const entryDir = dirname(entryFilePath);
    cmdsDir = join(entryDir, "cmds");
  } else {
    // Fallback: use config if provided, otherwise use process.cwd()/cmds
    if (baseConfig.commands?.directory) {
      cmdsDir = resolve(baseConfig.commands.directory);
    } else {
      cmdsDir = join(process.cwd(), "cmds");
    }
  }

  // Override commands directory in config (entry file takes precedence)
  baseConfig = {
    ...baseConfig,
    commands: {
      ...baseConfig.commands,
      directory: cmdsDir,
    },
  };

  const loadedConfig: RemptsConfig = baseConfig;

  // Merge override config on top of loaded config
  const mergedConfig = {
    ...loadedConfig,
    ...configOverride,
    // Deep merge plugins arrays
    plugins: configOverride?.plugins || loadedConfig.plugins || [],
  };

  // Validate and coerce config - only require name/version if they are explicitly provided
  let fullConfig: RemptsConfigStrict;
  try {
    // If name and version are not provided, create a minimal config with defaults
    if (mergedConfig.name && mergedConfig.version) {
      fullConfig = remptsConfigStrictSchema.assert(mergedConfig);
    } else {
      const minimalConfig = {
        name: mergedConfig.name || "cli",
        version: mergedConfig.version || "1.0.0",
        ...mergedConfig,
      };
      fullConfig = remptsConfigStrictSchema.assert(minimalConfig);
    }
  } catch (error) {
    throw new Error(
      "[rempts] Invalid config: " + (error instanceof Error ? error.message : String(error))
    );
  }

  const commands = new Map<string, Command<any, any>>();
  const commandSources = new Map<string, "directory">(); // Track where commands come from
  // Prefix tree for fast subcommand discovery: parentName -> Set<subcommandFullName>
  const subcommandIndex = new Map<string, Set<string>>();

  // Global before/after hooks
  const beforeHooks: BeforeHook<TStore>[] = [];
  const afterHooks: AfterHook<TStore>[] = [];

  // Global hook context storage (shared across commands)
  let globalHookContext: Record<string, any> = {};

  // Helper to get terminal information
  function getTerminalInfo(): TerminalInfo {
    const isInteractive = process.stdout.isTTY;
    const isCI = !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS
    );

    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24,
      isInteractive,
      isCI,
      supportsColor: isInteractive && !isCI && process.env.TERM !== "dumb",
      supportsMouse: isInteractive && !isCI && process.env.TERM_PROGRAM !== "Apple_Terminal",
    };
  }
  const pluginManagerState = createPluginManager<TStore>();

  // Load plugins if configured
  if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
    await loadPlugins(pluginManagerState, mergedConfig.plugins as any as PluginConfig[]);

    // Run setup hooks - this may modify config
    const { config: updatedConfig, commands: pluginCommands } = await runSetup(
      pluginManagerState,
      fullConfig
    );
    // Re-validate after plugins potentially modified config
    fullConfig = remptsConfigStrictSchema.assert(updatedConfig);

    // Register plugin commands (if any)
    // Note: Since @reliverse/dler rempts is file-based only, plugins should register commands from files
    // Plugin commands are deprecated - use file-based commands instead
    if (pluginCommands.length > 0) {
      console.warn(
        "Warning: Plugin command registration is deprecated. " +
          "Rempts is file-based only - register commands via file structure: <cmds-dir>/<cmd-name>/cmd.{ts,js,mjs}"
      );
      // For backward compatibility, try to extract name from command metadata
      // But this won't work reliably since commands don't have names anymore
      pluginCommands.forEach((cmd) => {
        // Try to get name from command metadata or use a fallback
        const cmdName = (cmd as any).name || "unknown";
        if (cmdName === "unknown") {
          console.warn("Skipping plugin command without name - use file-based commands instead");
          return;
        }
        registerCommand(cmdName, cmd, [], "directory");
      });
    }
  }

  // Create resolved config with defaults
  const resolvedConfig: ResolvedConfig = {
    name: fullConfig.name,
    version: fullConfig.version,
    description: fullConfig.description || "",
    commands: fullConfig.commands || {},
    build: fullConfig.build || {
      targets: ["native"],
      compress: false,
      minify: false,
      sourcemap: true,
    },
    dev: fullConfig.dev || {
      watch: true,
      inspect: false,
    },
    test: fullConfig.test || {
      pattern: ["**/*.test.ts", "**/*.spec.ts"],
      coverage: false,
      watch: false,
    },
    workspace: fullConfig.workspace || {
      versionStrategy: "fixed",
    },
    release: fullConfig.release || {
      npm: true,
      github: false,
      tagFormat: "v{{version}}",
      conventionalCommits: true,
    },
    plugins: fullConfig.plugins || [],
  };

  // Run configResolved hooks
  if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
    await runConfigResolved(pluginManagerState, resolvedConfig);
  }

  // Helper to register a command and its aliases
  // Commands are file-based only - name is always inferred from file path
  function registerCommand(
    name: string,
    cmd: Command<any, any>,
    path: string[] = [],
    source: "directory" = "directory"
  ) {
    const fullName = [...path, name].join(" ");

    // Skip if command already exists
    // This prevents conflicts when the same command is registered from multiple sources
    // (e.g., file loading or duplicate files)
    // File-loaded commands take precedence
    if (commands.has(fullName)) {
      return;
    }

    commands.set(fullName, cmd);
    commandSources.set(fullName, source);

    // Update subcommand index for fast subcommand discovery
    // Performance: O(depth) where depth is command nesting level
    // For "a b c", add it to indices for "a" and "a b"
    // This enables O(1) lookup of parent -> Set<subcommands> instead of O(n) scan
    const nameParts = fullName.split(" ");
    // Skip empty parts (shouldn't happen, but be defensive)
    const validParts = nameParts.filter((part) => part.length > 0);
    for (let i = 0; i < validParts.length - 1; i++) {
      const parentName = validParts.slice(0, i + 1).join(" ");
      if (!subcommandIndex.has(parentName)) {
        subcommandIndex.set(parentName, new Set());
      }
      subcommandIndex.get(parentName)!.add(fullName);
    }

    // Register aliases
    if (cmd.alias) {
      const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
      aliases.forEach((alias) => {
        const aliasPath = [...path, alias].join(" ");
        // Skip if alias already exists (prevents duplicate registration)
        if (commands.has(aliasPath)) {
          return;
        }
        commands.set(aliasPath, cmd);
        commandSources.set(aliasPath, source);

        // Update subcommand index for aliases so they can discover subcommands too
        // If this command has subcommands, make them discoverable via alias
        const aliasParts = aliasPath.split(" ").filter((part) => part.length > 0);
        for (let i = 0; i < aliasParts.length - 1; i++) {
          const parentName = aliasParts.slice(0, i + 1).join(" ");
          if (!subcommandIndex.has(parentName)) {
            subcommandIndex.set(parentName, new Set());
          }
          // Add the original command name to the alias parent's index
          subcommandIndex.get(parentName)!.add(fullName);
        }
        // If this command itself has subcommands, add them to alias index
        const subcommandNames = subcommandIndex.get(fullName);
        if (subcommandNames) {
          if (!subcommandIndex.has(aliasPath)) {
            subcommandIndex.set(aliasPath, new Set());
          }
          // Copy all subcommands to the alias index
          for (const subCmdName of subcommandNames) {
            subcommandIndex.get(aliasPath)!.add(subCmdName);
          }
        }
      });
    }

    // Note: Nested commands are already registered individually from files
    // Parent commands just group them together - no need to re-register
  }

  // Helper to find command by path
  // Returns command name (from map key) and command object
  // Performance: O(depth) where depth is the number of command parts
  // Uses Map.get() which is O(1), so total is O(depth) - optimal for arbitrary nesting
  function findCommand(args: string[]): {
    command: Command<any, any> | undefined;
    commandName: string | undefined;
    remainingArgs: string[];
  } {
    // Try to find the deepest matching command
    // Start from longest path (most specific) and work backwards
    // This ensures we match "a b c" before "a b" when args = ["a", "b", "c"]
    for (let i = args.length; i > 0; i--) {
      const cmdPath = args.slice(0, i).join(" ");
      const command = commands.get(cmdPath);
      if (command) {
        return { command, commandName: cmdPath, remainingArgs: args.slice(i) };
      }
    }
    return { command: undefined, commandName: undefined, remainingArgs: args };
  }

  // Helper to show help for a command
  // Name comes from the commands map key (inferred from file path)
  function showHelp(cmdName?: string, cmd?: Command<any, TStore>, path: string[] = []) {
    if (cmd && cmdName) {
      // Show command-specific help
      const fullPath = [...path, cmdName].join(" ");
      console.log(relico.bold(`Usage: ${fullConfig.name} ${fullPath} [options]`));
      console.log(`\n${relico.dim(cmd.description)}`);

      if (cmd.options && Object.keys(cmd.options).length > 0) {
        console.log(`\n${relico.bold("Options:")}`);
        for (const [name, opt] of Object.entries(cmd.options)) {
          const option = opt as CLIOption<any>;
          const flag = `--${name}${option.short ? `, -${option.short}` : ""}`;
          const description = option.description || "";
          console.log(`  ${relico.yellow(flag.padEnd(20))} ${relico.dim(description)}`);
        }
      }

      // Discover subcommands using prefix tree index
      // Performance: O(k) where k is the number of direct subcommands (not all commands)
      // Much faster than scanning all commands O(n) where n is total command count
      const subcommandNames = subcommandIndex.get(fullPath);
      const subCommands: Array<{ name: string; command: Command<any, any> }> = [];
      if (subcommandNames) {
        const parentDepth = fullPath.split(" ").length;
        for (const subCmdFullName of subcommandNames) {
          // Only include direct children (depth = parentDepth + 1)
          // This filters out grandchildren like "a b c d" when parent is "a b"
          if (subCmdFullName.split(" ").length === parentDepth + 1) {
            const subCmdName = subCmdFullName.slice(fullPath.length + 1);
            const command = commands.get(subCmdFullName);
            if (command) {
              subCommands.push({ name: subCmdName, command });
            }
          }
        }
      }

      if (subCommands.length > 0) {
        console.log(`\n${relico.bold("Subcommands:")}`);
        for (const { name: subCmdName, command: subCmd } of subCommands) {
          console.log(`  ${relico.green(subCmdName.padEnd(20))} ${relico.dim(subCmd.description)}`);
        }
      }
    } else {
      // Show root help
      console.log(relico.bold(relico.cyan(`${fullConfig.name} v${fullConfig.version}`)));
      if (fullConfig.description) {
        console.log(relico.dim(fullConfig.description));
      }
      console.log(`\n${relico.bold("Commands:")}`);

      // Show only top-level commands (names that don't contain spaces)
      for (const [name, command] of commands) {
        if (!(name.includes(" ") || command.alias?.includes(name))) {
          console.log(`  ${relico.green(name.padEnd(20))} ${relico.dim(command.description)}`);
        }
      }
    }
  }

  function ensureRenderAvailable(commandName: string, command: Command<any, any>) {
    if (!command.render) {
      throw new Error(`Command ${commandName} does not support TUI rendering.`);
    }
    if (!getTuiRenderer()) {
      throw new Error(
        `TUI renderer not registered. Import '@reliverse/rempts-tui/register' or call registerTuiRenderer before running commands with render.`
      );
    }
  }

  // Auto-load commands from config if specified
  async function loadFromConfig() {
    // Load from directory if specified
    if (fullConfig.commands?.directory) {
      try {
        // Use the already resolved commands directory
        const cmdsDir = fullConfig.commands.directory;

        const fileLoader = createFileCommandLoader();
        const commandTree = await fileLoader.loadFromDirectory(cmdsDir);
        const fileCommands = await fileLoader.loadCommandsFromTree(commandTree);

        // Register all commands from the directory structure
        // Name is inferred from file path: <cmds-dir>/<cmd-name>/cmd.{ts,js,mjs}
        fileCommands.forEach(({ name, command }) => {
          registerCommand(name, command, [], "directory");
        });
      } catch (error) {
        console.error(
          `Failed to load commands from directory ${fullConfig.commands.directory}:`,
          error
        );
        throw error; // Re-throw to prevent CLI from starting with invalid config
      }
    }
  }

  async function runCommandInternal(
    commandName: string,
    command: Command<any, any>,
    argv: string[],
    providedFlags?: Record<string, unknown>
  ) {
    let context: CommandContext<any> | undefined;
    let resultParsed: { flags: unknown; positional: string[] } | undefined;

    try {
      const mergedOptions = {
        ...GLOBAL_FLAGS,
        ...(command.options || {}),
      } as MergedOptions<(typeof command.options & Options) | Options>;
      const parsed = providedFlags
        ? (() => {
            // Parse with empty args for defaults, then overlay provided flags
            // This keeps behavior consistent with execute(options)
            return parseArgs([], mergedOptions, commandName).then(
              (p) => (Object.assign(p.flags, providedFlags), p)
            );
          })()
        : parseArgs(argv, mergedOptions, commandName);
      resultParsed = await parsed;
      const { prompt, spinner } = await import("@reliverse/rempts-utils");

      if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
        context = await runBeforeCommand(
          pluginManagerState,
          commandName,
          command,
          providedFlags ? [] : resultParsed.positional,
          resultParsed.flags as Record<string, any>
        );
      }

      // Run global before hooks
      if (beforeHooks.length > 0) {
        // Reset global hook context for this command
        globalHookContext = {};

        const hookContext: HookContext<TStore> = {
          flags: resultParsed.flags as Record<string, unknown>,
          store: context?.store?.getState() || ({} as TStore),
          env: process.env,
          cwd: process.cwd(),
          set: (key: string, value: any) => {
            globalHookContext[key] = value;
          },
          get: (key: string) => {
            return globalHookContext[key];
          },
        };

        for (const hook of beforeHooks) {
          await hook(hookContext);
        }
      }

      const terminalInfo = getTerminalInfo();
      const globalFlags = resultParsed.flags as GlobalFlags & Record<string, unknown>;
      const runtimeInfo: RuntimeInfo = {
        startTime: Date.now(),
        args: providedFlags ? [] : argv,
        command: commandName,
      };

      let render = false;
      if (command.render) {
        if ((globalFlags as Record<string, unknown>)["no-tui"]) {
          render = false;
        } else if (
          (globalFlags as Record<string, unknown>).tui ||
          (globalFlags as Record<string, unknown>).interactive
        ) {
          render = true;
        } else {
          render = terminalInfo.isInteractive && !terminalInfo.isCI;
        }
      }

      if (render) {
        ensureRenderAvailable(commandName, command);
        await getTuiRenderer<Record<string, unknown>, TStore>()?.({
          command,
          flags: resultParsed.flags as Record<string, unknown>,
          positional: resultParsed.positional,
          shell: Bun.$,
          env: process.env,
          cwd: process.cwd(),
          prompt,
          spinner,
          colors: relico,
          terminal: terminalInfo,
          runtime: runtimeInfo,
          ...(context ? { context } : {}),
          ...(Object.keys(globalHookContext).length > 0 ? { hooks: globalHookContext } : {}),
        });
      } else {
        if (!command.handler) {
          throw new Error("Command does not provide a handler for non-TUI execution");
        }
        // Type assertion: flags are validated and typed by parseArgs
        const typedFlags = resultParsed.flags as InferMergedOptions<Options>;
        await command.handler({
          flags: typedFlags,
          positional: resultParsed.positional,
          shell: Bun.$,
          env: process.env,
          cwd: process.cwd(),
          prompt,
          spinner,
          colors: relico,
          terminal: terminalInfo,
          runtime: runtimeInfo,
          ...(context ? { context } : {}),
          ...(Object.keys(globalHookContext).length > 0 ? { hooks: globalHookContext } : {}),
        });
      }

      if (mergedConfig.plugins && mergedConfig.plugins.length > 0 && context) {
        await runAfterCommand(pluginManagerState, context, { exitCode: 0 });
      }

      // Run global after hooks
      if (afterHooks.length > 0) {
        const hookContext: HookContext<TStore> & { exitCode: number } = {
          flags: resultParsed.flags as Record<string, unknown>,
          store: context?.store?.getState() || ({} as TStore),
          env: process.env,
          cwd: process.cwd(),
          set: () => {}, // Not used in after hooks
          get: () => undefined, // Not used in after hooks
          exitCode: 0,
        };

        for (const hook of afterHooks) {
          await hook(hookContext);
        }
      }
    } catch (error) {
      if (mergedConfig.plugins && mergedConfig.plugins.length > 0 && context) {
        await runAfterCommand(pluginManagerState, context, { exitCode: 1 });
      }

      // Run global after hooks on error
      if (afterHooks.length > 0) {
        const hookContext: HookContext<TStore> & {
          exitCode: number;
          error?: Error;
        } = {
          flags: (resultParsed?.flags as Record<string, unknown> | undefined) || {},
          store: context?.store?.getState() || ({} as TStore),
          env: process.env,
          cwd: process.cwd(),
          set: () => {}, // Not used in after hooks
          get: () => undefined, // Not used in after hooks
          exitCode: 1,
          error: error instanceof Error ? error : new Error(String(error)),
        };

        for (const hook of afterHooks) {
          await hook(hookContext);
        }
      }

      if (error instanceof SchemaError) {
        console.error(relico.red("Validation Error:"));
        const generalErrors: string[] = [];
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = getDotPath(issue);
          if (path) {
            if (!fieldErrors[path]) {
              fieldErrors[path] = [];
            }
            fieldErrors[path].push(issue.message);
          } else {
            generalErrors.push(issue.message);
          }
        }
        for (const [field, messages] of Object.entries(fieldErrors)) {
          console.error(relico.dim(`  ${field}:`));
          for (const message of messages) {
            console.error(relico.dim(`    • ${message}`));
          }
        }
        for (const message of generalErrors) {
          console.error(relico.dim(`  • ${message}`));
        }
        process.exit(1);
      } else if (error instanceof Error) {
        console.error(relico.red(`Error: ${error.message}`));
        process.exit(1);
      }
      throw error;
    }
  }

  const api = {
    // Internal method for command registration (not part of public API)
    command<TCommandStore = any>(name: string, cmd: Command<any, TCommandStore>) {
      registerCommand(name, cmd, [], "directory");
    },

    async init() {
      await loadFromConfig();
    },

    async run(argv = process.argv.slice(2)) {
      if (argv.length === 0) {
        showHelp(undefined, undefined, []);
        return;
      }

      // Handle -- separator: split args before and after --
      const separatorIndex = argv.indexOf("--");
      const commandArgs = separatorIndex >= 0 ? argv.slice(0, separatorIndex) : argv;
      const passthroughArgs = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : [];

      // Handle version flag (only check before -- separator)
      if (commandArgs.includes("--version") || commandArgs.includes("-v")) {
        console.log(relico.bold(relico.cyan(`${fullConfig.name} v${fullConfig.version}`)));
        return;
      }

      // Handle help flags (only check before -- separator)
      if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
        const helpIndex = Math.max(commandArgs.indexOf("--help"), commandArgs.indexOf("-h"));
        const cmdArgs = commandArgs.slice(0, helpIndex);

        if (cmdArgs.length === 0) {
          showHelp(undefined, undefined, []);
        } else {
          const { command, commandName, remainingArgs: _remainingArgs } = findCommand(cmdArgs);
          if (command && commandName) {
            const pathParts = commandName.split(" ").slice(0, -1);
            showHelp(commandName, command, pathParts);
          } else {
            console.error(`Unknown command: ${cmdArgs.join(" ")}`);
            process.exit(1);
          }
        }
        return;
      }

      // Find and execute command
      const { command, commandName, remainingArgs } = findCommand(commandArgs);

      if (!(command && commandName)) {
        console.error(`Unknown command: ${commandArgs[0]}`);
        process.exit(1);
      }

      // If command has subcommands but no handler, show help
      // Use prefix tree index for O(1) lookup instead of scanning all commands
      const hasSubcommands =
        subcommandIndex.has(commandName) &&
        Array.from(subcommandIndex.get(commandName)!).some(
          (name) => name.split(" ").length === commandName.split(" ").length + 1
        );
      if (!(command.handler || command.render) && hasSubcommands) {
        const pathParts = commandName.split(" ").slice(0, -1);
        showHelp(commandName, command, pathParts);
        return;
      }

      if (command.handler || command.render) {
        // Combine remaining args from command parsing with passthrough args
        const allArgs = [...remainingArgs, ...passthroughArgs];
        await runCommandInternal(commandName, command, allArgs);
      }
    },

    async execute(
      commandName: string,
      argsOrOptions?: string[] | Record<string, any>,
      options?: Record<string, any>
    ) {
      // Parse command name to handle nested commands (git/sync -> git sync)
      const commandPath = commandName.replace(/\//g, " ").split(" ");
      const { command, commandName: foundCommandName, remainingArgs } = findCommand(commandPath);
      if (!(command && foundCommandName)) {
        throw new Error(`Command '${commandName}' not found`);
      }

      // Handle different overload patterns
      let finalArgs: string[] = [];
      let finalOptions: Record<string, any> = {};

      if (argsOrOptions && !Array.isArray(argsOrOptions)) {
        // Pattern: execute(commandName, options)
        finalOptions = argsOrOptions as Record<string, any>;
      } else if (Array.isArray(argsOrOptions) && options) {
        // Pattern: execute(commandName, args, options)
        finalArgs = argsOrOptions;
        finalOptions = options;
      } else if (Array.isArray(argsOrOptions)) {
        // Pattern: execute(commandName, args)
        finalArgs = argsOrOptions;
      }

      // If options object provided, use directly as flags
      if (Object.keys(finalOptions).length > 0) {
        // Merge global flags with command options
        const mergedOptions = {
          ...GLOBAL_FLAGS,
          ...(command.options || {}),
        } as MergedOptions<(typeof command.options & Options) | Options>;

        // Parse with empty args to get defaults, then merge options
        const parsed = await parseArgs([], mergedOptions, foundCommandName);
        Object.assign(parsed.flags, finalOptions);

        const { prompt, spinner } = await import("@reliverse/rempts-utils");

        // Run beforeCommand hooks if plugins are loaded
        let context: CommandContext<TStore> | undefined;
        if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
          context = await runBeforeCommand(
            pluginManagerState,
            foundCommandName,
            command,
            [],
            parsed.flags
          );
        }

        // Run global before hooks
        if (beforeHooks.length > 0) {
          // Reset global hook context for this command
          globalHookContext = {};

          const hookContext: HookContext<TStore> = {
            flags: parsed.flags,
            store: context?.store?.getState() || ({} as TStore),
            env: process.env,
            cwd: process.cwd(),
            set: (key: string, value: any) => {
              globalHookContext[key] = value;
            },
            get: (key: string) => {
              return globalHookContext[key];
            },
          };

          for (const hook of beforeHooks) {
            await hook(hookContext);
          }
        }

        // Create runtime info
        const runtimeInfo: RuntimeInfo = {
          startTime: Date.now(),
          args: [],
          command: foundCommandName,
        };

        const terminalInfo = getTerminalInfo();

        if (command.handler) {
          // Type assertion: flags are validated and typed by parseArgs
          const typedFlags = parsed.flags as InferMergedOptions<
            (typeof command.options & Options) | Options
          >;
          await command.handler({
            flags: typedFlags,
            positional: [],
            shell: Bun.$,
            env: process.env,
            cwd: process.cwd(),
            prompt,
            spinner,
            colors: relico,
            terminal: terminalInfo,
            runtime: runtimeInfo,
            ...(context ? { context } : {}),
            ...(Object.keys(globalHookContext).length > 0 ? { hooks: globalHookContext } : {}),
          });
        }

        // Run afterCommand hooks if plugins are loaded
        if (mergedConfig.plugins && mergedConfig.plugins.length > 0 && context) {
          await runAfterCommand(pluginManagerState, context, { exitCode: 0 });
        }

        // Run global after hooks
        if (afterHooks.length > 0) {
          const hookContext: HookContext<TStore> & { exitCode: number } = {
            flags: parsed.flags,
            store: context?.store?.getState() || ({} as TStore),
            env: process.env,
            cwd: process.cwd(),
            set: () => {}, // Not used in after hooks
            get: () => undefined, // Not used in after hooks
            exitCode: 0,
          };

          for (const hook of afterHooks) {
            await hook(hookContext);
          }
        }
        return;
      }

      // Parse string args normally
      const args = finalArgs.length > 0 ? finalArgs : (argsOrOptions as string[] | undefined) || [];
      // Use the already found command and remaining args
      const foundCommand = command;
      const finalArgsToUse = [...remainingArgs, ...args];

      // Execute the command using the same logic as the run method
      if (foundCommand.handler || foundCommand.render) {
        await runCommandInternal(foundCommandName, foundCommand, finalArgsToUse);
      }
    },

    before(hook: BeforeHook<TStore>) {
      beforeHooks.push(hook);
    },

    after(hook: AfterHook<TStore>) {
      afterHooks.push(hook);
    },
  };

  return api;
}
