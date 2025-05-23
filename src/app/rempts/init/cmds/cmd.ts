import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  meta: {
    name: "cmds",
    version: "1.0.0",
    description: "Generate command exports file for cmd.ts files.",
  },
  args: {
    outFile: {
      type: "string",
      description: "Output file path (relative to workspace root)",
      default: "src/app/cmds.ts",
    },
    cmdDirs: {
      type: "array",
      description: "Command directories to scan (relative to src/app)",
      default: [],
      options: ["relifso", "inject", "rempts"],
    },
    force: {
      type: "boolean",
      default: false,
      description: "Overwrite existing file",
    },
  },
  async run({ args }) {
    const root = path.resolve("src/app");
    const outPath = path.resolve(args.outFile ?? "src/app/cmds.ts");

    // Check if output file exists
    if ((await fs.pathExists(outPath)) && !args.force) {
      relinka(
        "warn",
        `❌ File "${outPath}" already exists. Use --force to overwrite.`,
      );
      return;
    }

    // If no cmdDirs provided, scan src/app for command modules
    const cmdDirs =
      (args.cmdDirs ?? []).length > 0
        ? (args.cmdDirs ?? [])
        : await findCommandDirs(root);

    if (cmdDirs.length === 0) {
      relinka("warn", "No command directories found with cmd.ts files.");
      return;
    }

    // Generate exports for each command
    const exports = generateExports(cmdDirs);

    // Create output directory if it doesn't exist
    await fs.ensureDir(path.dirname(outPath));

    // Write the file
    await fs.writeFile(outPath, exports, "utf-8");
    relinka("success", `✅ Generated command exports at: ${outPath}`);
    relinka("log", `Found ${cmdDirs.length} command(s): ${cmdDirs.join(", ")}`);
  },
});

/**
 * Find directories containing cmd.ts files
 */
async function findCommandDirs(root: string): Promise<string[]> {
  const cmdDirs: string[] = [];

  // Read all directories recursively
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory has a cmd.ts file
        if (await fs.pathExists(path.join(fullPath, "cmd.ts"))) {
          // Get relative path from root
          const relPath = path.relative(root, fullPath);
          cmdDirs.push(relPath);
        } else {
          // Scan subdirectories
          await scan(fullPath);
        }
      }
    }
  }

  await scan(root);
  return cmdDirs;
}

/**
 * Generate exports code for the commands
 */
function generateExports(cmdDirs: string[]): string {
  const imports = cmdDirs.map((dir) => {
    // Convert directory path to camelCase function name
    const funcName = `getCmd${dir
      .split(/[/\\]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")}`;

    return `export async function ${funcName}() {
  return (await import("./${dir}/cmd.js")).default;
}`;
  });

  return `// Generated command exports - DO NOT EDIT
${imports.join("\n\n")}
`;
}
