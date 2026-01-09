import { join, relative } from "node:path";
import type { Command } from "./types";

/**
 * File-based command loader that automatically discovers and loads commands
 * from a directory structure following the pattern: <cmds-dir>/<cmd-name>/cmd.{ts,js,mjs}
 */

// Pre-compiled regex patterns for performance
const CMD_FILE_PATTERN = /\/cmd\.[^.]+$/;
const PATH_SEPARATOR_PATTERN = /\//g;

/**
 * Create a file command loader
 */
export function createFileCommandLoader() {
  return {
    /**
     * Load commands from a directory structure
     * @param cmdsDir Directory containing command files following pattern: <cmd-name>/cmd.{ts,js,mjs}
     * @returns Promise resolving to loaded command tree
     */
    async loadFromDirectory(cmdsDir: string): Promise<CommandFileTree> {
      const commandFiles = await scanCommandFiles(cmdsDir);
      const conflicts = detectConflicts(commandFiles, cmdsDir);

      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(
          (conflict) =>
            `Command "${conflict.commandName}" conflicts between:\n` +
            `  - ${conflict.files[0]}\n` +
            `  - ${conflict.files[1]}`
        );
        throw new Error(`Command conflicts detected:\n${conflictMessages.join("\n\n")}`);
      }

      return buildCommandTree(commandFiles, cmdsDir);
    },

    /**
     * Load and register commands from file tree
     * Returns commands with their names inferred from file paths
     */
    async loadCommandsFromTree(tree: CommandFileTree): Promise<CommandWithName[]> {
      return loadCommandsFromTree(tree);
    },
  };
}

/**
 * Scan for command files in directory
 * Only finds files matching the pattern: <cmd-name>/cmd.{ts,js,mjs}
 */
async function scanCommandFiles(cmdsDir: string): Promise<string[]> {
  try {
    // Only look for cmd.{ts,js,mjs} files in subdirectories
    const glob = new Bun.Glob("**/cmd.{ts,js,mjs}");
    const files = await Array.fromAsync(glob.scan({ cwd: cmdsDir }));

    const commandFiles: string[] = [];

    // Process files in parallel for better performance
    for (const file of files) {
      const fullPath = join(cmdsDir, file);
      // All cmd.{ts,js,mjs} files in subdirectories are considered valid command files
      commandFiles.push(fullPath);
    }

    return commandFiles;
  } catch {
    console.warn(`Warning: Could not scan commands directory: ${cmdsDir}`);
    return [];
  }
}

/**
 * Detect conflicts between command files
 */
function detectConflicts(commandFiles: string[], cmdsDir: string): CommandConflict[] {
  const conflicts: CommandConflict[] = [];
  const commandMap = new Map<string, string[]>(); // commandName -> [filePaths]
  const directoryMap = new Map<string, string[]>(); // directory -> [filePaths]

  for (const filePath of commandFiles) {
    const relativePath = relative(cmdsDir, filePath);
    const commandName = getCommandName(relativePath);

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

  // Remove trailing slash if present: "greet/" -> "greet"
  const trimmed = pathWithoutCmd.replace(/\/$/, "");

  // Convert path separators to spaces for command hierarchy
  // Handle multiple consecutive slashes and normalize
  return trimmed.replace(PATH_SEPARATOR_PATTERN, " ").replace(/\s+/g, " ").trim();
}

/**
 * Build command tree from file structure
 */
async function buildCommandTree(commandFiles: string[], cmdsDir: string): Promise<CommandFileTree> {
  const tree: CommandFileTree = {};

  for (const filePath of commandFiles) {
    const relativePath = relative(cmdsDir, filePath);
    const commandName = getCommandName(relativePath);

    // For strict structure, command name is just the directory name(s)
    // e.g., "greet/cmd.ts" -> "greet", "build/binary/cmd.ts" -> "build binary"
    const commandNameParts = commandName.split(" ");
    let current = tree;

    // Build nested structure for multi-level commands
    // If a parent command file exists (e.g., build/cmd.ts), we need to preserve it
    for (let i = 0; i < commandNameParts.length - 1; i++) {
      const part = commandNameParts[i]!;
      if (!current[part]) {
        current[part] = {};
      } else if ("filePath" in current[part]) {
        // Parent command file exists (e.g., build/cmd.ts)
        // Convert it to a tree structure to hold subcommands
        const existingCommand = current[part] as CommandFileInfo;
        current[part] = {
          // Store the parent command file under a special key or as the base
          // We'll handle this in loadCommandsFromTree
        } as CommandFileTree;
        // Re-add the parent command file to the tree
        const treeNode = current[part] as CommandFileTree;
        (treeNode as Record<string, unknown>).__parent__ = existingCommand;
      }
      current = current[part] as CommandFileTree;
    }

    const finalPart = commandNameParts.at(-1)!;

    // If this is a single-part command (e.g., "build") and there's already a tree here,
    // it means we have subcommands - store the parent command file separately
    if (
      commandNameParts.length === 1 &&
      finalPart in current &&
      "filePath" in current[finalPart]!
    ) {
      // This shouldn't happen - single-part commands shouldn't conflict
      // But handle it gracefully
      const existing = current[finalPart] as CommandFileInfo;
      if (existing.filePath !== relativePath) {
        throw new Error(
          `Command conflict: "${finalPart}" is defined in both "${existing.filePath}" and "${relativePath}"`
        );
      }
    }

    (current as any)[finalPart] = {
      filePath: relativePath,
      importPath: getImportPath(filePath),
      commandName,
    };
  }

  return tree;
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
 * Command with its inferred name from file path
 */
export interface CommandWithName {
  name: string;
  command: Command<any, any>;
}

/**
 * Load and register commands from file tree
 * Returns commands with their names inferred from file paths
 */
async function loadCommandsFromTree(tree: CommandFileTree): Promise<CommandWithName[]> {
  async function loadFromTree(
    obj: CommandFileTree,
    path: string[] = []
  ): Promise<CommandWithName[]> {
    const loadedCommands: CommandWithName[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (key === "__parent__") {
        // This is a parent command file stored in a tree (e.g., build/cmd.ts when build/binary/cmd.ts exists)
        const commandInfo = value as CommandFileInfo;
        try {
          const module = await import(commandInfo.importPath);
          const command = module.default || module;

          // Load the parent command with its full name
          loadedCommands.push({
            name: commandInfo.commandName,
            command,
          });
        } catch (error) {
          console.warn(`Failed to load command from ${commandInfo.importPath}:`, error);
        }
        continue;
      }

      if (typeof value === "object" && "filePath" in value) {
        // This is a command file (leaf node)
        const commandInfo = value as CommandFileInfo;
        try {
          const module = await import(commandInfo.importPath);
          const command = module.default || module;

          // Name is always inferred from file path
          // e.g., "build/binary/cmd.ts" -> "build binary"
          const inferredName = commandInfo.commandName;

          loadedCommands.push({
            name: inferredName,
            command,
          });
        } catch (error) {
          console.warn(`Failed to load command from ${commandInfo.importPath}:`, error);
        }
      } else {
        // This is a nested tree - may contain subcommands and/or a parent command
        const subCommands = await loadFromTree(value as CommandFileTree, [...path, key]);
        if (subCommands.length > 0) {
          // Check if there's a parent command file (stored as __parent__)
          const parentCommandInfo = (value as Record<string, unknown>).__parent__ as
            | CommandFileInfo
            | undefined;

          if (parentCommandInfo) {
            // Parent command file exists (e.g., build/cmd.ts)
            // Load it - subcommands are already registered separately from files
            try {
              const module = await import(parentCommandInfo.importPath);
              const parentCommand = module.default || module;

              // Register the parent command - subcommands are discovered dynamically from commands map
              loadedCommands.push({
                name: parentCommandInfo.commandName,
                command: parentCommand,
              });
            } catch (error) {
              console.warn(
                `Failed to load parent command from ${parentCommandInfo.importPath}:`,
                error
              );
            }
          } else {
            // No parent command file - create a synthetic parent command
            // Subcommands are discovered dynamically from the commands map
            // The synthetic parent has no handler/render, so run() will show help when subcommands exist
            const parentCommand: Command<any, any> = {
              description: `${key} commands`,
            };
            loadedCommands.push({
              name: key,
              command: parentCommand,
            });
          }
        }
      }
    }

    return loadedCommands;
  }

  return await loadFromTree(tree);
}

/**
 * Types for file-based command loading
 */
export interface CommandFileInfo {
  filePath: string;
  importPath: string;
  commandName: string;
}

export interface CommandFileTree {
  [key: string]: CommandFileTree | CommandFileInfo | undefined;
}

export interface CommandConflict {
  commandName: string;
  files: string[];
}

/**
 * Utility function to load commands from directory
 */
export async function loadCommandsFromDirectory(cmdsDir: string): Promise<CommandWithName[]> {
  const loader = createFileCommandLoader();
  const tree = await loader.loadFromDirectory(cmdsDir);
  return loader.loadCommandsFromTree(tree);
}
