import { join, relative } from "node:path";
import type { Command } from "./types";

/**
 * File-based command loader that automatically discovers and loads commands
 * from a directory structure, supporting both flat and nested command hierarchies.
 */
export class FileCommandLoader {
  private loadedCommands = new Map<string, string>(); // commandPath -> filePath

  /**
   * Load commands from a directory structure
   * @param commandsDir Directory containing command files
   * @param basePath Base path for relative imports
   * @returns Promise resolving to loaded command tree
   */
  async loadFromDirectory(commandsDir: string): Promise<CommandFileTree> {
    const commandFiles = await this.scanCommandFiles(commandsDir);
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
   * Scan for command files in directory
   */
  private async scanCommandFiles(commandsDir: string): Promise<string[]> {
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
        content.includes("@reliverse/rempts") ||
        content.includes('from "rempts"') ||
        content.includes("from 'rempts'");

      const usesDefineCommand = content.includes("defineCommand(");

      return hasCommandExport && (hasRemptsImport || usesDefineCommand);
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
