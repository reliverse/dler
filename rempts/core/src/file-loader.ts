import { join, relative } from "node:path";
import type { Command } from "./types";

/**
 * File-based command loader that automatically discovers and loads commands
 * from a directory structure, supporting both flat and nested command hierarchies,
 * as well as file-based directory commands.
 */
export class FileCommandLoader {
  private loadedCommands = new Map<string, string>(); // commandPath -> filePath

  /**
   * Load commands from a directory structure
   * @param commandsDir Directory containing command files
   * @param excludeFileBasedDir Optional file-based directory to exclude from scanning
   * @returns Promise resolving to loaded command tree
   */
  async loadFromDirectory(commandsDir: string, excludeFileBasedDir?: string): Promise<CommandFileTree> {
    const commandFiles = await this.scanCommandFiles(commandsDir, excludeFileBasedDir);
    const conflicts = this.detectConflicts(commandFiles, commandsDir);

    if (conflicts.length > 0) {
      const conflictMessages = conflicts.map(
        (conflict) =>
          `Command "${conflict.commandName}" conflicts between:\n` +
          `  - ${conflict.files[0]}\n` +
          `  - ${conflict.files[1]}`,
      );
      throw new Error(`Command conflicts detected:\n${conflictMessages.join("\n\n")}`);
    }

    return this.buildCommandTree(commandFiles, commandsDir);
  }

  /**
   * Load commands from file-based directory structure (only cmd.ts files)
   * @param commandsDir Directory containing command files
   * @param fileBasedDir Name of the file-based directory (default: 'app')
   * @returns Promise resolving to loaded command tree
   */
  async loadFromFileBasedDirectory(commandsDir: string, fileBasedDir = "app"): Promise<CommandFileTree> {
    const fileBasedCommandFiles = await this.scanFileBasedCommandFiles(commandsDir, fileBasedDir);
    return this.buildFileBasedCommandTree(fileBasedCommandFiles, commandsDir, fileBasedDir);
  }

  /**
   * Scan for command files in directory
   */
  private async scanCommandFiles(commandsDir: string, excludeFileBasedDir?: string): Promise<string[]> {
    try {
      const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mjs,mtsx}");
      const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }));

      const commandFiles: string[] = [];

      // Process files in parallel for better performance
      const fileChecks = files.map(async (file) => {
        const fullPath = join(commandsDir, file);

        // Skip test files and other non-command files
        if (this.isNonCommandFile(file)) {
          return null;
        }

        // Skip files in the file-based directory if specified
        if (excludeFileBasedDir && file.startsWith(`${excludeFileBasedDir}/`)) {
          return null;
        }

        // Quick check if this looks like a command file
        if (await this.isCommandFile(fullPath)) {
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
      console.warn(`Warning: Could not scan commands directory: ${commandsDir}`);
      return [];
    }
  }

  /**
   * Scan for file-based command files (only cmd.ts|js|mjs files in file-based directory)
   */
  private async scanFileBasedCommandFiles(commandsDir: string, fileBasedDir: string): Promise<string[]> {
    try {
      const glob = new Bun.Glob(`${fileBasedDir}/**/cmd.{ts,js,mjs}`);
      const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }));

      const commandFiles: string[] = [];

      // Process files in parallel for better performance
      const fileChecks = files.map(async (file) => {
        const fullPath = join(commandsDir, file);

        // Quick check if this looks like a command file
        if (await this.isAppCommandFile(fullPath)) {
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
      console.warn(`Warning: Could not scan file-based commands directory: ${commandsDir}/${fileBasedDir}`);
      return [];
    }
  }

  /**
   * Check if a file is likely a command file
   */
  private async isCommandFile(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();

      // Check for command-related exports
      const hasCommandExport =
        /export\s+(default|const|function)/.test(content) &&
        (content.includes("defineCommand") || content.includes("Command"));

      // Check for rempts imports or defineCommand usage
      const hasRemptsImport =
        content.includes("@reliverse/rempts-core") ||
        content.includes('from "@reliverse/rempts"') ||
        content.includes("from '@reliverse/rempts'");

      const usesDefineCommand = content.includes("defineCommand(");

      return hasCommandExport && (hasRemptsImport || usesDefineCommand);
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is a valid app command file (must export default defineCommand)
   */
  private async isAppCommandFile(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();

      // Must have default export
      const hasDefaultExport = /export\s+default/.test(content);

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
   * Check if a file should be excluded from command scanning
   */
  private isNonCommandFile(fileName: string): boolean {
    return (
      fileName.includes(".test.") ||
      fileName.includes(".spec.") ||
      fileName.includes("__tests__") ||
      fileName.includes("node_modules") ||
      fileName.includes("dist") ||
      fileName.includes(".dler") ||
      fileName.includes(".d.ts") ||
      fileName.includes(".config.") ||
      fileName.includes(".setup.") ||
      fileName.includes("commands.gen.")
    );
  }

  /**
   * Detect conflicts between command files
   */
  private detectConflicts(commandFiles: string[], commandsDir: string): CommandConflict[] {
    const conflicts: CommandConflict[] = [];
    const commandMap = new Map<string, string[]>(); // commandName -> [filePaths]

    for (const filePath of commandFiles) {
      const relativePath = relative(commandsDir, filePath);
      const commandName = this.getCommandName(relativePath);
      if (!commandMap.has(commandName)) {
        commandMap.set(commandName, []);
      }
      commandMap.get(commandName)!.push(filePath);
    }

    for (const [commandName, files] of commandMap) {
      if (files.length > 1) {
        conflicts.push({ commandName, files });
      }
    }

    return conflicts;
  }

  /**
   * Get command name from file path
   * Handles nested structures like:
   * - build.ts -> "build"
   * - build/cmd.ts -> "build cmd"
   * - build/deploy/cmd.ts -> "build deploy cmd"
   */
  private getCommandName(filePath: string): string {
    // Remove extension
    let pathWithoutExt = filePath.replace(/\.[^.]+$/, "");

    // Handle index files - they represent the parent command
    if (pathWithoutExt.endsWith("/index")) {
      pathWithoutExt = pathWithoutExt.slice(0, -6);
    }

    // Convert path separators to spaces for command hierarchy
    return pathWithoutExt.replace(/\//g, " ");
  }

  /**
   * Build command tree from file structure
   */
  private async buildCommandTree(
    commandFiles: string[],
    commandsDir: string,
  ): Promise<CommandFileTree> {
    const tree: CommandFileTree = {};

    for (const filePath of commandFiles) {
      const relativePath = relative(commandsDir, filePath);
      const commandName = this.getCommandName(relativePath);

      // Create nested structure based on directory hierarchy
      const pathParts = relativePath.replace(/\.[^.]+$/, "").split("/");
      let current = tree;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]!;
        const existing = current[part];

        // Check for structural conflict: if this path part already exists as a command file,
        // we can't create a directory structure here
        if (existing && 'filePath' in existing) {
          const conflictingFile = join(commandsDir, String(existing.filePath));
          throw new Error(
            `Command structure conflict: "${relativePath}" conflicts with existing command file "${existing.filePath}". ` +
            `Cannot create nested command structure when a command file already exists at the same path level. ` +
            `Please rename one of the conflicting files:\n` +
            `  - ${conflictingFile}\n` +
            `  - ${filePath}`,
          );
        }

        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as CommandFileTree;
      }

      const finalPart = pathParts[pathParts.length - 1]!;
      (current as any)[finalPart] = {
        filePath: relativePath,
        importPath: this.getImportPath(filePath),
        commandName,
      };
    }

    return tree;
  }

  /**
   * Build command tree from file-based directory structure
   * File-based commands use flat structure - command names come from defineCommand, not file paths
   */
  private async buildFileBasedCommandTree(
    commandFiles: string[],
    commandsDir: string,
    fileBasedDir: string,
  ): Promise<CommandFileTree> {
    const tree: CommandFileTree = {};

    for (const filePath of commandFiles) {
      const relativePath = relative(commandsDir, filePath);

      // For file-based commands, extract the command name from the file content
      try {
        const commandName = await this.extractCommandNameFromFile(filePath);
        if (commandName) {
          tree[commandName] = {
            filePath: relativePath,
            importPath: this.getImportPath(filePath),
            commandName,
          };
        }
      } catch (error) {
        // Skip files that can't be parsed
        console.warn(`Warning: Could not parse file-based command from ${relativePath}:`, error);
      }
    }

    return tree;
  }

  /**
   * Extract command name from app command file content
   */
  private async extractCommandNameFromFile(filePath: string): Promise<string | null> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();

      // Look for name: "command-name" pattern in defineCommand calls
      const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
      return nameMatch ? nameMatch[1]! : null;
    } catch {
      return null;
    }
  }

  /**
   * Get import path for a command file
   */
  private getImportPath(filePath: string): string {
    // For dynamic imports, return the absolute file path
    // Bun supports importing absolute file paths directly
    return filePath;
  }

  /**
   * Load and register commands from file tree
   */
  async loadCommandsFromTree(tree: CommandFileTree): Promise<Command<any, any>[]> {
    async function loadFromTree(
      obj: CommandFileTree,
      path: string[] = [],
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
  const loader = new FileCommandLoader();
  const tree = await loader.loadFromDirectory(commandsDir);
  return loader.loadCommandsFromTree(tree);
}
