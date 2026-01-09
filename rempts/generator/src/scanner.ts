import { extname, join } from "node:path";

/**
 * Fast command scanner using Bun.Transpiler for optimal performance
 *
 * This scanner uses Bun's native transpiler to quickly identify
 * command files without full AST parsing, making it much faster
 * than traditional approaches.
 */
export class CommandScanner {
  private readonly transpiler: Bun.Transpiler;

  constructor() {
    // Initialize transpiler for TypeScript/JSX files
    this.transpiler = new Bun.Transpiler({
      loader: "tsx",
      target: "bun",
    });
  }

  /**
   * Scan for command files using Bun.Transpiler for fast filtering
   */
  async scanCommands(cmdsDir: string): Promise<string[]> {
    try {
      // Use Bun's native Glob for file scanning
      const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx}");
      const files = await Array.fromAsync(glob.scan({ cwd: cmdsDir }));

      const commandFiles: string[] = [];

      // Process files in parallel for better performance
      const fileChecks = files.map(async (file) => {
        const fullPath = join(cmdsDir, file);

        // Quick file extension check
        const ext = extname(file);
        if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          return null;
        }

        // Skip test files and other non-command files
        if (this.isNonCommandFile(file)) {
          return null;
        }

        // Use Bun.Transpiler to quickly check if this is a command file
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
      console.warn(`Warning: Could not scan commands directory: ${cmdsDir}`);
      return [];
    }
  }

  /**
   * Check if a file is likely a command file using Bun.Transpiler
   */
  private async isCommandFile(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath);
      const content = await file.text();

      // Use Bun.Transpiler to quickly scan for command indicators
      const scanResult = this.transpiler.scan(content);

      // Check for command-related exports
      const hasCommandExport = scanResult.exports.some(
        (exp) => exp === "default" || exp.includes("Command") || exp.includes("defineCommand")
      );

      // Check for command-related imports
      const hasCommandImports = scanResult.imports.some(
        (imp) => imp.path.includes("@reliverse/rempts-core") || imp.path.includes("defineCommand")
      );

      // Check for defineCommand usage in the content
      const hasDefineCommand = content.includes("defineCommand(");

      return hasCommandExport && (hasCommandImports || hasDefineCommand);
    } catch {
      // If we can't read or parse the file, assume it's not a command
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
   * Get command name from file path
   */
  getCommandName(filePath: string, cmdsDir: string): string {
    const relativePath = filePath.replace(`${cmdsDir}/`, "");

    // Remove the "cmd" part and extension: "test/cmd.ts" -> "test/"
    // Match pattern: /cmd.{ts,js,mjs} at the end
    const pathWithoutCmd = relativePath.replace(/\/cmd\.[^.]+$/, "");

    // Remove trailing slash if present: "test/" -> "test"
    const trimmed = pathWithoutCmd.replace(/\/$/, "");

    // Convert path separators to spaces for command hierarchy
    // Handle multiple consecutive slashes and normalize
    return trimmed.replace(/\//g, " ").replace(/\s+/g, " ").trim();
  }

  /**
   * Get export path for a command file
   */
  getExportPath(filePath: string, cmdsDir: string): string {
    const relativePath = filePath.replace(`${cmdsDir}/`, "");
    const withoutExt = relativePath.replace(/\.[^.]+$/, "");
    // Use the actual cmdsDir name instead of hardcoded "cmds"
    const dirName = cmdsDir.split("/").pop() || "cmds";
    return `./${dirName}/${withoutExt}`;
  }
}

// Utility functions for external use
export function isCommandFile(filePath: string): boolean {
  const ext = extname(filePath);
  return (
    [".ts", ".tsx", ".js", ".jsx"].includes(ext) &&
    !filePath.includes(".test.") &&
    !filePath.includes(".spec.") &&
    !filePath.includes("__tests__") &&
    !filePath.includes("commands.gen.") &&
    !filePath.includes(".dler/")
  );
}
