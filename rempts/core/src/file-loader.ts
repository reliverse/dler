import { join, relative } from "node:path";
import type { Command } from "./types";

/**
 * File-based command loader that automatically discovers and loads commands
 * from a directory structure, supporting both flat and nested command hierarchies,
 * for loading commands from the file system.
 */

// Pre-compiled regex patterns for performance
const CMD_FILE_PATTERN = /\/cmd\.[^.]+$/;
const PATH_SEPARATOR_PATTERN = /\//g;
const DEFAULT_EXPORT_PATTERN = /export\s+default/;
const COMMAND_NAME_PATTERN = /name:\s*["']([^"']+)["']/;

/**
 * Create a file command loader
 */
export function createFileCommandLoader() {
  return {
    /**
     * Load commands from a directory structure
     * @param commandsDir Directory containing command files
     * @returns Promise resolving to loaded command tree
     */
    async loadFromDirectory(commandsDir: string): Promise<CommandFileTree> {
      const commandFiles = await scanCommandFiles(commandsDir);
      const conflicts = await detectConflicts(commandFiles, commandsDir);

      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(
          (conflict) =>
            `Command "${conflict.commandName}" conflicts between:\n` +
            `  - ${conflict.files[0]}\n` +
            `  - ${conflict.files[1]}`
        );
        throw new Error(`Command conflicts detected:\n${conflictMessages.join("\n\n")}`);
      }

      return buildCommandTree(commandFiles, commandsDir);
    },

    /**
     * Load and register commands from file tree
     */
    async loadCommandsFromTree(tree: CommandFileTree): Promise<Command<any, any>[]> {
      return loadCommandsFromTree(tree);
    },
  };
}

/**
 * Scan for command files (cmd.ts|js|mjs files in subdirectories)
 */
async function scanCommandFiles(commandsDir: string): Promise<string[]> {
  try {
    const glob = new Bun.Glob(`*/cmd.{ts,js,mjs}`);
    const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }));

    const commandFiles: string[] = [];

    // Process files in parallel for better performance
    const fileChecks = files.map(async (file) => {
      const fullPath = join(commandsDir, file);

      // Quick check if this looks like a command file
      if (await isAppCommandFile(fullPath)) {
        return fullPath;
      }

      return null;
    });

    const results = await Promise.all(fileChecks);

    // Filter out null results
    for (const result of results) {
      if (result) {
        commandFiles.push(result);
      }
    }

    return commandFiles;
  } catch {
    console.warn(`Warning: Could not scan commands directory: ${commandsDir}/cmds`);
    return [];
  }
}

/**
 * Check if a file is a valid command file (must export default defineCommand)
 */
async function isAppCommandFile(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();

    // Must have default export
    const hasDefaultExport = DEFAULT_EXPORT_PATTERN.test(content);

    // Must use defineCommand
    const usesDefineCommand = content.includes("defineCommand(");

    // Must have rempts import
    const hasRemptsImport =
      content.includes("@reliverse/rempts-core") ||
      content.includes('from "@reliverse/rempts"') ||
      content.includes("from '@reliverse/rempts'");

    return hasDefaultExport && usesDefineCommand && hasRemptsImport;
  } catch {
    return false;
  }
}

/**
 * Detect conflicts between command files
 */
async function detectConflicts(
  commandFiles: string[],
  commandsDir: string
): Promise<CommandConflict[]> {
  const conflicts: CommandConflict[] = [];
  const commandMap = new Map<string, string[]>(); // commandName -> [filePaths]
  const directoryMap = new Map<string, string[]>(); // directory -> [filePaths]

  for (const filePath of commandFiles) {
    const relativePath = relative(commandsDir, filePath);
    const commandName = await extractCommandNameFromFile(filePath);

    if (!commandName) continue; // Skip files that don't have valid command names

    // Track files by command name
    if (!commandMap.has(commandName)) {
      commandMap.set(commandName, []);
    }
    commandMap.get(commandName)?.push(filePath);

    // Track files by directory (for variant conflicts)
    const directory = relativePath.replace(CMD_FILE_PATTERN, "");
    if (!directoryMap.has(directory)) {
      directoryMap.set(directory, []);
    }
    directoryMap.get(directory)?.push(filePath);
  }

  // Check for multiple file variants in same directory first (more specific error)
  const directoriesWithVariants = new Set<string>();
  for (const [directory, files] of directoryMap) {
    if (files.length > 1) {
      conflicts.push({
        commandName: `${directory} has multiple file variants`,
        files,
      });
      directoriesWithVariants.add(directory);
    }
  }

  // Check for multiple files mapping to same command name (but skip if already reported as variant conflict)
  for (const [commandName, files] of commandMap) {
    if (files.length > 1 && !directoriesWithVariants.has(commandName)) {
      conflicts.push({ commandName, files });
    }
  }

  return conflicts;
}

/**
 * Get command name from file path
 * For the strict structure: <commands-dir>/<command>/cmd.{ts,js,mjs}
 * - greet/cmd.ts -> "greet"
 * - git/status/cmd.ts -> "git status"
 */
function getCommandName(filePath: string): string {
  // Remove the "cmd" part and extension: "greet/cmd.ts" -> "greet/"
  const pathWithoutCmd = filePath.replace(CMD_FILE_PATTERN, "");

  // Convert path separators to spaces for command hierarchy
  return pathWithoutCmd.replace(PATH_SEPARATOR_PATTERN, " ");
}

/**
 * Build command tree from directory structure
 * File-based commands use flat structure - command names come from defineCommand, not file paths
 */
async function buildCommandTree(
  commandFiles: string[],
  commandsDir: string
): Promise<CommandFileTree> {
  const tree: CommandFileTree = {};

  for (const filePath of commandFiles) {
    const relativePath = relative(commandsDir, filePath);

    // Extract the command name from the file content
    try {
      const commandName = await extractCommandNameFromFile(filePath);
      if (commandName) {
        tree[commandName] = {
          filePath: relativePath,
          importPath: getImportPath(filePath),
          commandName,
        };
      }
    } catch (error) {
      // Skip files that can't be parsed
      console.warn(`Warning: Could not parse command from ${relativePath}:`, error);
    }
  }

  return tree;
}

/**
 * Extract command name from command file content
 */
async function extractCommandNameFromFile(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();

    // Look for name: "command-name" pattern in defineCommand calls
    const nameMatch = content.match(COMMAND_NAME_PATTERN);
    return nameMatch ? nameMatch[1]! : null;
  } catch {
    return null;
  }
}

/**
 * Get import path for a command file
 */
function getImportPath(filePath: string): string {
  // For dynamic imports, return the file:// URL for the absolute path
  // This ensures proper resolution regardless of the importing module's location
  return `file://${filePath}`;
}

/**
 * Load and register commands from file tree
 */
async function loadCommandsFromTree(tree: CommandFileTree): Promise<Command<any, any>[]> {
  async function loadFromTree(
    obj: CommandFileTree,
    path: string[] = []
  ): Promise<Command<any, any>[]> {
    const loadedCommands: Command<any, any>[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && "filePath" in value) {
        // This is a command file
        const commandInfo = value as CommandFileInfo;
        try {
          const module = await import(commandInfo.importPath);
          const command = module.default || module;
          loadedCommands.push(command);
        } catch (error) {
          console.warn(`Failed to load command from ${commandInfo.importPath}:`, error);
        }
      } else {
        // This is a nested tree - create parent command with subcommands
        const subCommands = await loadFromTree(value as CommandFileTree, [...path, key]);
        if (subCommands.length > 0) {
          // Create a parent command that contains the subcommands
          const parentCommand: Command<any, any> = {
            name: key,
            description: `${key} commands`,
            commands: subCommands,
          };
          loadedCommands.push(parentCommand);
        }
      }
    }

    return loadedCommands;
  }

  return await loadFromTree(tree);
}

/**
 * Types for command loading
 */
export interface CommandFileInfo {
  filePath: string;
  importPath: string;
  commandName: string;
}

export interface CommandFileTree {
  [key: string]: CommandFileTree | CommandFileInfo;
}

export interface CommandConflict {
  commandName: string;
  files: string[];
}

/**
 * Utility function to load commands from directory
 */
export async function loadCommandsFromDirectory(commandsDir: string): Promise<Command<any, any>[]> {
  const loader = createFileCommandLoader();
  const tree = await loader.loadFromDirectory(commandsDir);
  return loader.loadCommandsFromTree(tree);
}
