// packages/launcher/src/impl/launcher/mod.ts

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCommands } from "./impl/discovery";
import {
  CommandLoadError,
  CommandNotFoundError,
  LauncherError,
} from "./impl/errors";
import { generateCommandHelp, generateGlobalHelp } from "./impl/help";
import { parseArgs } from "./impl/parser";
import { getRegistry, resolveCommand, setRegistry } from "./impl/registry";

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
}

// Get the directory of the file that called runLauncher
const getCallerDirectory = (importMetaUrl: string): string => {
  // Use provided import.meta.url (most reliable caller detection)
  return dirname(fileURLToPath(importMetaUrl));
};

// Optimized output functions that batch writes
const textEncoder = new TextEncoder();

const writeLine = (text: string): void => {
  const encoded = textEncoder.encode(`${text}\n`);
  Bun.write(Bun.stdout, encoded);
};

const writeErrorLines = (lines: string[]): void => {
  // Pre-allocate string buffer for better performance
  const buffer = new Array(lines.length + 1);
  for (let i = 0; i < lines.length; i++) {
    buffer[i] = lines[i];
  }
  buffer[lines.length] = "";
  const encoded = textEncoder.encode(buffer.join("\n"));
  Bun.write(Bun.stderr, encoded);
};

export const runLauncher = async (
  importMetaUrl: string,
  options: LauncherOptions = {},
): Promise<void> => {
  const { cmdsDir = "./cmds", onError } = options;

  try {
    let registry = getRegistry();
    if (!registry) {
      // Get the caller's directory using import.meta.url
      const callerDir = getCallerDirectory(importMetaUrl);
      registry = await discoverCommands(cmdsDir, callerDir);
      setRegistry(registry);
    }

    const argv = process.argv.slice(2);

    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
      // Use cached global help for faster display
      writeLine(await generateGlobalHelp(registry));
      process.exit(0);
    }

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
      writeLine(generateCommandHelp(definition));
      process.exit(0);
    }

    const { parsedArgs } = parseArgs(argv, definition.args);

    await definition.handler(parsedArgs as never);
  } catch (error) {
    if (error instanceof LauncherError) {
      if (onError) {
        onError(error);
      } else {
        const errorLines = [`\n❌ Error: ${error.message}`];
        if (error instanceof CommandLoadError && error.cause) {
          errorLines.push(`Cause: ${error.cause}`);
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
