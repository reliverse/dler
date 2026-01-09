import { resolve } from "node:path";
import { relico } from "@reliverse/relico";
import { getDotPath, SchemaError } from "@standard-schema/utils";
import { type RemptsConfigStrict, remptsConfigSchema, remptsConfigStrictSchema } from "./config";
import { type LoadedConfig, loadConfig } from "./config-loader";
import { createFileCommandLoader } from "./file-loader";
import { loadGeneratedStores } from "./generated";
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
      generated?: string | boolean;
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
  } = {}
): Promise<CLI<MergePluginStores<TPlugins>>> {
  const {
    config: configOverride,
    defaultCommand,
    autoInit = true,
    configDir: customConfigDir,
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

    // Set the generated path to be relative to configDir if not already specified
    if (baseConfig && !(baseConfig as any).generated) {
      (baseConfig as any).generated = resolve(configDir, ".dler/commands.gen.ts");
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
          generated?: string | boolean;
        })
      | undefined;
  })();

  const cli = await createCLI(finalConfigOverride || {});

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

export async function createCLI<TPlugins extends readonly Plugin[] = []>(
  configOverride?: Partial<RemptsConfig> & {
    plugins?: TPlugins;
    generated?: string | boolean; // Optional, defaults to true
  }
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

  // If no commands directory is specified and no config file was loaded,
  // try to auto-detect commands in common locations
  if (!(baseConfig.commands?.directory || loadedConfigData)) {
    // Determine if we're in a development environment (has src/ directory)
    // Check for common development files/directories
    const isDevelopment = await Promise.all([
      Bun.file("./src")
        .exists()
        .catch(() => false),
      Bun.file("./.git")
        .exists()
        .catch(() => false),
      Bun.file("./package.json")
        .exists()
        .catch(() => false),
    ]).then((results) => results.some(Boolean));

    // Prioritize directories based on environment
    const possibleDirs = isDevelopment
      ? ["./src/cmds", "./cmds", "./dist/cmds"] // Development: prefer src/cmds
      : ["./dist/cmds", "./cmds", "./src/cmds"]; // Production: prefer dist/cmds

    // Find all directories that contain commands
    const foundDirs: Array<{ dir: string; fileCount: number }> = [];

    for (const dir of possibleDirs) {
      try {
        const dirPath = resolve(process.cwd(), dir);
        const glob = new Bun.Glob("**/cmd.{ts,js,mjs}");
        const files = await Array.fromAsync(glob.scan({ cwd: dirPath }));
        if (files.length > 0) {
          foundDirs.push({ dir, fileCount: files.length });
        }
      } catch {
        // Continue to next directory
      }
    }

    if (foundDirs.length > 0) {
      // If multiple directories found, use priority order but warn about ambiguity
      const selectedDir = foundDirs[0]!.dir;

      if (foundDirs.length > 1) {
        const dirList = foundDirs.map((d) => `${d.dir} (${d.fileCount} commands)`).join(", ");
        console.warn(
          `⚠️  Multiple command directories found: ${dirList}\n` +
            `   Using: ${selectedDir}\n` +
            `   Consider specifying 'commands.directory' in dler.config.ts to remove this warning.`
        );
      }

      baseConfig = {
        ...baseConfig,
        commands: {
          ...baseConfig.commands,
          directory: selectedDir,
        },
      };
    } else {
      // No commands found, default to the primary directory for the environment
      const defaultDir = isDevelopment ? "./src/cmds" : "./dist/cmds";
      baseConfig = {
        ...baseConfig,
        commands: {
          ...baseConfig.commands,
          directory: defaultDir,
        },
      };
    }
  }

  // Resolve relative commands directory to absolute path
  if (
    baseConfig.commands?.directory &&
    typeof baseConfig.commands.directory === "string" &&
    baseConfig.commands.directory.startsWith("./")
  ) {
    baseConfig.commands.directory = resolve(process.cwd(), baseConfig.commands.directory);
  }

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

  // Auto-load generated types (can be disabled via config)
  const shouldLoadGenerated = configOverride?.generated !== false;
  if (shouldLoadGenerated) {
    const generatedPath =
      typeof configOverride?.generated === "string"
        ? configOverride.generated
        : "./.dler/commands.gen.ts"; // Standard location

    try {
      // If it's a custom path (absolute), use it directly
      // If it's relative, resolve relative to current working directory
      const resolvedPath =
        generatedPath.startsWith("./") || generatedPath.startsWith("../")
          ? new URL(generatedPath, `file://${process.cwd()}/`).href
          : generatedPath.startsWith("/")
            ? `file://${generatedPath}`
            : generatedPath;

      await import(resolvedPath);
      // Side-effect import automatically registers via registerGeneratedStore
    } catch (_error) {
      // Generated types are optional enhancements for developer experience.
      // Don't show warnings to end users - they don't need these types.
    }
  }

  const commands = new Map<string, Command<any, any>>();
  const commandSources = new Map<string, "directory">(); // Track where commands come from

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

    // Register plugin commands
    pluginCommands.forEach((cmd) => registerCommand(cmd, [], "directory"));
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
  function registerCommand(
    cmd: Command<any, any>,
    path: string[] = [],
    source: "directory" = "directory"
  ) {
    const fullName = [...path, cmd.name].join(" ");

    // Check for conflicts - directory commands should not conflict
    if (commands.has(fullName)) {
      throw new Error(
        `Command "${fullName}" is already registered. ` + "Please ensure command names are unique."
      );
    }

    commands.set(fullName, cmd);
    commandSources.set(fullName, source);

    // Register aliases
    if (cmd.alias) {
      const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
      aliases.forEach((alias) => {
        const aliasPath = [...path, alias].join(" ");
        // Check alias conflicts too
        if (commands.has(aliasPath)) {
          throw new Error(`Command alias "${aliasPath}" is already registered.`);
        }
        commands.set(aliasPath, cmd);
        commandSources.set(aliasPath, source);
      });
    }

    // Register nested commands
    if (cmd.commands) {
      cmd.commands.forEach((subCmd) => {
        registerCommand(subCmd, [...path, cmd.name], source);
      });
    }
  }

  // Helper to find command by path
  function findCommand(args: string[]): {
    command: Command<any, any> | undefined;
    remainingArgs: string[];
  } {
    // Try to find the deepest matching command
    for (let i = args.length; i > 0; i--) {
      const cmdPath = args.slice(0, i).join(" ");
      const command = commands.get(cmdPath);
      if (command) {
        return { command, remainingArgs: args.slice(i) };
      }
    }
    return { command: undefined, remainingArgs: args };
  }

  // Helper to show help for a command
  function showHelp(cmd?: Command<any, TStore>, path: string[] = []) {
    if (cmd) {
      // Show command-specific help
      const fullPath = [...path, cmd.name].join(" ");
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

      if (cmd.commands && cmd.commands.length > 0) {
        console.log(`\n${relico.bold("Subcommands:")}`);
        for (const subCmd of cmd.commands) {
          console.log(
            `  ${relico.green(subCmd.name.padEnd(20))} ${relico.dim(subCmd.description)}`
          );
        }
      }
    } else {
      // Show root help
      console.log(relico.bold(relico.cyan(`${fullConfig.name} v${fullConfig.version}`)));
      if (fullConfig.description) {
        console.log(relico.dim(fullConfig.description));
      }
      console.log(`\n${relico.bold("Commands:")}`);

      // Show only top-level commands
      const topLevel = new Set<Command<any, TStore>>();
      for (const [name, command] of commands) {
        if (!(name.includes(" ") || command.alias?.includes(name))) {
          topLevel.add(command);
        }
      }

      for (const command of topLevel) {
        console.log(
          `  ${relico.green(command.name.padEnd(20))} ${relico.dim(command.description)}`
        );
      }
    }
  }

  function ensureRenderAvailable(command: Command<any, any>) {
    if (!command.render) {
      throw new Error(`Command ${command.name} does not support TUI rendering.`);
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
        const commandsDir = fullConfig.commands.directory;

        const fileLoader = createFileCommandLoader();

        // Load commands from the directory
        const commandTree = await fileLoader.loadFromDirectory(commandsDir);
        const commands = await fileLoader.loadCommandsFromTree(commandTree);

        // Register commands
        commands.forEach((cmd) => registerCommand(cmd, [], "directory"));
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
    command: Command<any, any>,
    argv: string[],
    providedFlags?: Record<string, unknown>
  ) {
    let context: CommandContext<any> | undefined;
    let resultParsed: any;

    try {
      const mergedOptions = { ...GLOBAL_FLAGS, ...command.options };
      const parsed = providedFlags
        ? (() => {
            // Parse with empty args for defaults, then overlay provided flags
            // This keeps behavior consistent with execute(options)
            return parseArgs([], mergedOptions, command.name).then(
              (p) => (Object.assign(p.flags, providedFlags), p)
            );
          })()
        : parseArgs(argv, mergedOptions, command.name);
      resultParsed = await parsed;
      const { prompt, spinner } = await import("@reliverse/rempts-utils");

      if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
        context = await runBeforeCommand(
          pluginManagerState,
          command.name,
          command,
          providedFlags ? [] : resultParsed.positional,
          resultParsed.flags
        );
      }

      // Run global before hooks
      if (beforeHooks.length > 0) {
        // Reset global hook context for this command
        globalHookContext = {};

        const hookContext: HookContext<TStore> = {
          flags: resultParsed.flags,
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
        command: command.name,
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
        ensureRenderAvailable(command);
        await getTuiRenderer<Record<string, unknown>, TStore>()?.({
          command,
          flags: resultParsed.flags,
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
        await command.handler({
          flags: resultParsed.flags,
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
          flags: resultParsed.flags,
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
          flags: resultParsed?.flags || {},
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

  const api: CLI<MergePluginStores<TPlugins>> = {
    async init() {
      await loadFromConfig();
    },

    async run(argv = process.argv.slice(2)) {
      if (argv.length === 0) {
        showHelp();
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
          showHelp();
        } else {
          const { command } = findCommand(cmdArgs);
          if (command) {
            showHelp(command, cmdArgs.slice(0, -1));
          } else {
            console.error(`Unknown command: ${cmdArgs.join(" ")}`);
            process.exit(1);
          }
        }
        return;
      }

      // Find and execute command
      const { command, remainingArgs } = findCommand(commandArgs);

      if (!command) {
        console.error(`Unknown command: ${commandArgs[0]}`);
        process.exit(1);
      }

      // If command has subcommands but no handler, show help
      if (!(command.handler || command.render) && command.commands) {
        showHelp(command, commandArgs.slice(0, commandArgs.length - remainingArgs.length - 1));
        return;
      }

      if (command.handler || command.render) {
        // Combine remaining args from command parsing with passthrough args
        const allArgs = [...remainingArgs, ...passthroughArgs];
        await runCommandInternal(command, allArgs);
      }
    },

    async execute(
      commandName: string,
      argsOrOptions?: string[] | Record<string, any>,
      options?: Record<string, any>
    ) {
      // Parse command name to handle nested commands (git/sync -> git sync)
      const commandPath = commandName.replace(/\//g, " ").split(" ");
      const { command, remainingArgs } = findCommand(commandPath);
      if (!command) {
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
          ...command.options,
        };

        // Parse with empty args to get defaults, then merge options
        const parsed = await parseArgs([], mergedOptions, command.name);
        Object.assign(parsed.flags, finalOptions);

        const { prompt, spinner } = await import("@reliverse/rempts-utils");

        // Run beforeCommand hooks if plugins are loaded
        let context: CommandContext<TStore> | undefined;
        if (mergedConfig.plugins && mergedConfig.plugins.length > 0) {
          context = await runBeforeCommand(
            pluginManagerState,
            command.name,
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
          command: command.name,
        };

        const terminalInfo = getTerminalInfo();

        if (command.handler) {
          await command.handler({
            flags: parsed.flags,
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
        await runCommandInternal(foundCommand, finalArgsToUse);
      }
    },

    before(hook: BeforeHook<TStore>) {
      beforeHooks.push(hook);
    },

    after(hook: AfterHook<TStore>) {
      afterHooks.push(hook);
    },
  };

  // Auto-register any generated command stores with this CLI instance
  if (shouldLoadGenerated) {
    loadGeneratedStores(api);
  }

  return api;
}
