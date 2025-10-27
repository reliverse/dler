// packages/launcher/src/impl/launcher/mod.ts

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { re } from "@reliverse/dler-colors";
import { writeErrorLines } from "@reliverse/dler-helpers";
import { logger } from "@reliverse/dler-logger";
import { discoverCommands } from "./impl/discovery";
import {
  CommandLoadError,
  CommandNotFoundError,
  LauncherError,
} from "./impl/errors";
import { generateCommandHelp, generateGlobalHelp } from "./impl/help";
import { parseArgs } from "./impl/parser";
import { clearRegistry, getRegistry, resolveCommand, setRegistry } from "./impl/registry";

export { defineCmd, defineCmdArgs, defineCmdCfg } from "./impl/command";
export {
  ArgumentValidationError,
  CommandLoadError,
  CommandNotFoundError,
  LauncherError,
} from "./impl/errors";
export type {
  CmdArgDefinition,
  CmdArgsSchema,
  CmdCfg,
  CmdDefinition,
  CmdHandler,
  CmdLoader,
  CmdRegistry,
  DiscoveryResult,
  ParsedArgs,
} from "./impl/types";

export interface LauncherOptions {
  cmdsDir?: string;
  onError?: (error: LauncherError) => void;
  verbose?: boolean;
}

// Get the directory of the file that called runLauncher
const getCallerDirectory = (importMetaUrl: string): string => {
  // Use provided import.meta.url (most reliable caller detection)
  return dirname(fileURLToPath(importMetaUrl));
};

export const runLauncher = async (
  importMetaUrl: string,
  options: LauncherOptions = {},
): Promise<void> => {
  const { cmdsDir = "./cmds", onError, verbose = false } = options;

  try {
    // Clear registry to force rediscovery (for debugging)
    clearRegistry();
    let registry = getRegistry();
    if (!registry) {
      // Get the caller's directory using import.meta.url
      const callerDir = getCallerDirectory(importMetaUrl);
      if (verbose) {
        console.debug(`📍 Caller directory: ${callerDir}`);
      }
      registry = await discoverCommands(cmdsDir, callerDir, verbose);
      setRegistry(registry);
    }

    const argv = process.argv.slice(2);

    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
      logger.log(await generateGlobalHelp(registry));
      process.exit(0);
    }

    // Check if this is a sub-command invocation
    const isSubCommand = argv.length > 1 && !argv[1]!.startsWith("-");

    if (isSubCommand) {
      // Handle sub-command execution using folder-based discovery
      const parentName = resolveCommand(registry, argv[0]!);
      const subCommandName = resolveCommand(registry, argv[1]!);

      // Check if both parent and sub-command exist in the hierarchy
      const parentNode = registry.hierarchy.get(parentName);
      const subCommandNode = registry.hierarchy.get(subCommandName);

      if (!parentNode) {
        throw new CommandNotFoundError(
          argv[0]!,
          Array.from(registry.registry.keys()),
        );
      }

      if (!subCommandNode || subCommandNode.parent !== parentName) {
        // Get available sub-commands for this parent
        const availableSubCommands = Array.from(parentNode.children.keys());
        throw new CommandNotFoundError(subCommandName, availableSubCommands);
      }

      // Load both parent and sub-command definitions
      const parentDefinition = await parentNode.loader();
      const subCommandDefinition = await subCommandNode.loader();

      if (argv.includes("--help") || argv.includes("-h")) {
        logger.log(await generateCommandHelp(subCommandDefinition));
        process.exit(0);
      }

      // Separate parent and sub-command arguments
      const subCommandIndex = argv.findIndex(
        (arg, index) => index > 0 && !arg.startsWith("-"),
      );

      // Filter parent args from the full argument list
      const parentArgs: string[] = [];
      const subCommandArgsFiltered: string[] = [];

      for (let i = 1; i < argv.length; i++) {
        const arg = argv[i]!;
        if (i === subCommandIndex) {
          // This is the sub-command name, skip it
          continue;
        }

        // Check if this argument belongs to the parent command
        const isParentArg = Object.keys(parentDefinition.args).some((key) => {
          const def = parentDefinition.args[key];
          if (!def) return false;
          return (
            arg === `--${key}` ||
            arg === `-${key}` ||
            (def.aliases && def.aliases.some((alias) => arg === `-${alias}`))
          );
        });

        if (isParentArg) {
          parentArgs.push(arg);
          // If it's a flag with a value, add the next argument too
          if (i + 1 < argv.length && !argv[i + 1]!.startsWith("-")) {
            parentArgs.push(argv[i + 1]!);
            i++; // Skip the next argument as it's the value
          }
        } else {
          subCommandArgsFiltered.push(arg);
        }
      }

      // Parse parent args (only if there are any)
      let parentParsedArgs = {};
      if (parentArgs.length > 0) {
        const { parsedArgs } = parseArgs(
          [parentName, ...parentArgs],
          parentDefinition.args,
        );
        parentParsedArgs = parsedArgs;
      }

      // Parse sub-command args
      const { parsedArgs: subCommandParsedArgs } = parseArgs(
        [subCommandName, ...subCommandArgsFiltered],
        subCommandDefinition.args,
      );

      // Execute sub-command with parent args
      await subCommandDefinition.handler(
        subCommandParsedArgs as never,
        parentParsedArgs as never,
      );
    } else {
      // Handle single command execution
      const cmdNameOrAlias = argv[0]!;
      const cmdName = resolveCommand(registry, cmdNameOrAlias);

      const loader = registry.registry.get(cmdName);
      if (!loader) {
        throw new CommandNotFoundError(
          cmdNameOrAlias,
          Array.from(registry.registry.keys()),
        );
      }

      const definition = await loader();

      if (argv.includes("--help") || argv.includes("-h")) {
        logger.log(await generateCommandHelp(definition));
        process.exit(0);
      }

      const { parsedArgs } = parseArgs(argv, definition.args);

      await definition.handler(parsedArgs as never);
    }
  } catch (error) {
    if (error instanceof LauncherError) {
      if (onError) {
        onError(error);
      } else {
        const errorLines = [
          `\n${re.red.bold("❌ Error:")} ${re.red(error.message)}`,
        ];
        if (error instanceof CommandLoadError && error.cause) {
          errorLines.push(`${re.yellow("Cause:")} ${error.cause}`);
        }
        errorLines.push("");
        writeErrorLines(errorLines);
      }
      process.exit(1);
    } else {
      throw error;
    }
  }
};
