import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";

import type { ReliverseConfig } from "~/impl/schema/mod";

export async function handleReliverseConfig() {
  const dlerConfigPath = path.resolve("reliverse.ts");
  let cmdsRoot = "src/app";
  let cliFilePath = "";

  try {
    const jiti = createJiti(import.meta.url);
    const dlerConfig = await jiti.import<ReliverseConfig>(dlerConfigPath, {
      default: true,
    });
    const coreIsCLI = dlerConfig?.coreIsCLI;
    if (!coreIsCLI?.enabled || !coreIsCLI?.scripts) {
      cliFilePath = await ensureCliFile("src/cli.ts");
      cmdsRoot = "src/app";
    } else {
      const firstScript = Object.values(coreIsCLI.scripts)[0] as string;
      const scriptPath = path.resolve(firstScript);
      if (await fs.pathExists(scriptPath)) {
        const content = await fs.readFile(scriptPath, "utf8");
        if (content.includes("@reliverse/rempts")) {
          if (content.includes("runMain")) {
            const cmdsRootMatch = content.match(/cmdsRootPath:\s*["']([^"']+)["']/);
            if (cmdsRootMatch?.[1]) {
              cmdsRoot = path.resolve(cmdsRootMatch[1]);
            }
          }
        } else {
          relinka("warn", `${scriptPath} doesn't use @reliverse/rempts`);
          cmdsRoot = "src/app";
        }
      } else {
        cliFilePath = await ensureCliFile(scriptPath);
        cmdsRoot = "src/app";
      }
    }
  } catch {
    cliFilePath = await ensureCliFile("src/cli.ts");
    cmdsRoot = "src/app";
  }

  return { cmdsRoot: path.resolve(cmdsRoot), cliFile: cliFilePath };
}

export async function ensureCliFile(filePath: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  if (!(await fs.pathExists(resolvedPath))) {
    await fs.ensureDir(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, cliTemplate, "utf8");
    relinka("verbose", `✅ Created CLI entry file: ${resolvedPath}`);
    return resolvedPath;
  }
  return "";
}

export async function findCommandDirs(root: string): Promise<string[]> {
  const cmdDirs: string[] = [];
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Accept both cmd.ts and cmd.js
        const hasCmdTs = await fs.pathExists(path.join(fullPath, "cmd.ts"));
        const hasCmdJs = await fs.pathExists(path.join(fullPath, "cmd.js"));
        if (hasCmdTs || hasCmdJs) {
          const relPath = path.relative(root, fullPath);
          cmdDirs.push(relPath);
        }
        await scan(fullPath);
      }
    }
  }
  await scan(root);
  return cmdDirs;
}

export async function generateCommandArgsMap(cmdDirs: string[]): Promise<string> {
  let interfaceContent =
    "// Argument types for each command based on their defineArgs\ninterface CommandArgsMap {\n";

  for (const dir of cmdDirs) {
    const cmdPath = path.join("src/app", dir, "cmd.ts");

    try {
      if (await fs.pathExists(cmdPath)) {
        const content = await fs.readFile(cmdPath, "utf-8");
        const args = extractArgsFromContent(content);

        const keyName = dir.replace(/[/\\]/g, "_");
        interfaceContent += `  "${keyName}": {\n`;

        if (args.length > 0) {
          for (const arg of args) {
            let tsType: string;

            // Convert command arg types to TypeScript types
            switch (arg.type) {
              case "boolean":
                tsType = "boolean";
                break;
              case "number":
                tsType = "number";
                break;
              case "array":
                tsType = "string[]";
                break;
              case "string":
                if (arg.allowed) {
                  tsType = arg.allowed.map((v) => `"${v}"`).join(" | ");
                } else {
                  tsType = "string";
                }
                break;
              default:
                tsType = "string";
            }

            const optional = arg.required ? "" : "?";
            interfaceContent += `    ${arg.name}${optional}: ${tsType};\n`;
          }
        } else {
          interfaceContent += `    // No arguments defined\n`;
        }

        interfaceContent += "  };\n";
      } else {
        // Fallback for commands without discoverable args
        const keyName = dir.replace(/[/\\]/g, "_");
        interfaceContent += `  "${keyName}": Record<string, unknown>;\n`;
      }
    } catch (error) {
      // Fallback for commands that can't be parsed
      const keyName = dir.replace(/[/\\]/g, "_");
      interfaceContent += `  "${keyName}": Record<string, unknown>;\n`;
    }
  }

  interfaceContent += "}";
  return interfaceContent;
}

interface ArgDefinition {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  allowed?: string[];
}

export function extractArgsFromContent(content: string): ArgDefinition[] {
  const args: ArgDefinition[] = [];

  // Look for defineArgs block
  const defineArgsMatch = content.match(/defineArgs\(\s*\{([\s\S]*?)\}\s*\)/);
  if (!defineArgsMatch?.[1]) return args;

  const argsBlock = defineArgsMatch[1];

  // Extract individual argument definitions
  const argMatches = argsBlock.matchAll(/(\w+):\s*\{([^}]*)\}/g);

  for (const match of argMatches) {
    const argName = match[1];
    const argProps = match[2];

    if (!argName || !argProps) continue;

    // Extract type
    const typeMatch = argProps.match(/type:\s*["']([^"']+)["']/);
    const type = typeMatch?.[1] || "string";

    // Extract required
    const requiredMatch = argProps.match(/required:\s*(true|false)/);
    const required = requiredMatch?.[1] === "true";

    // Extract default value
    const defaultMatch = argProps.match(/default:\s*([^,\n]+)/);
    let defaultValue: unknown;
    if (defaultMatch?.[1]) {
      const defaultStr = defaultMatch[1].trim();
      try {
        defaultValue = JSON.parse(defaultStr);
      } catch {
        defaultValue = defaultStr.replace(/["']/g, "");
      }
    }

    // Extract allowed values
    const allowedMatch = argProps.match(/allowed:\s*\[([^\]]+)\]/);
    let allowed: string[] | undefined;
    if (allowedMatch?.[1]) {
      allowed = allowedMatch[1].split(",").map((s) => s.trim().replace(/["']/g, ""));
    }

    args.push({
      name: argName,
      type,
      required,
      default: defaultValue,
      allowed,
    });
  }

  return args;
}

export async function generateExports(cmdDirs: string[]): Promise<string> {
  const lines = [
    "// autogenerated by `dler rempts`",
    "// don't edit this file manually",
    "",
    'import type { Command } from "@reliverse/rempts";',
    "",
    'import { callCmdImpl, getTypedCmdImpl, loadCommand } from "@reliverse/rempts";',
  ];

  // Traditional command exports will be generated later (after loadTypedCommand is defined)

  lines.push("", "// ========== TYPED COMMAND SYSTEM ==========", "");

  // Generate CommandArgsMap interface
  const commandArgsMap = await generateCommandArgsMap(cmdDirs);
  lines.push(commandArgsMap);

  lines.push(
    "",
    "// Typed loadCommand wrapper with intellisense",
    "export async function loadTypedCommand<T extends keyof CommandArgsMap>(",
    "  cmdName: T",
    "): Promise<Command> {",
    "  return await loadCommand(cmdName as string);",
    "}",
    "",
  );

  // Now regenerate traditional command exports using loadTypedCommand
  const traditionalExports = [
    "",
    "// ========== TRADITIONAL COMMAND EXPORTS (with typed intellisense) ==========",
    "",
  ];

  for (const dir of cmdDirs) {
    const funcName =
      "get" +
      dir
        .split(/[/\\]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/[^a-zA-Z0-9]/g, ""))
        .join("") +
      "Cmd";
    const keyName = dir.replace(/[/\\]/g, "_");
    traditionalExports.push(
      `export const ${funcName} = async (): Promise<Command> => loadTypedCommand("${keyName}");`,
    );
  }

  lines.push(...traditionalExports);

  lines.push(
    "",
    "// Typed command functions with type safety",
    "export async function callCmd<T extends keyof CommandArgsMap>(",
    "  cmdName: T,",
    "  args?: CommandArgsMap[T]",
    "): Promise<void> {",
    "  await callCmdImpl<CommandArgsMap>(cmdName, args);",
    "}",
    "",
    "export async function getTypedCmd<T extends keyof CommandArgsMap>(",
    "  cmdName: T",
    "): Promise<{",
    "  command: Command;",
    "  run: (args?: CommandArgsMap[T]) => Promise<void>;",
    "}> {",
    "  return await getTypedCmdImpl<CommandArgsMap>(cmdName);",
    "}",
    "",
    "// Export type for external use",
    "export type { CommandArgsMap };",
    "",
  );

  return lines.join("\n");
}

export function generateCommandTemplate(cmdName: string) {
  return `import { defineCommand, defineArgs } from "@reliverse/rempts";
  
export default defineCommand({
  meta: {
    name: "${cmdName}",
    version: "1.0.0",
    description: "Describe what ${cmdName} command does.",
  },
  args: defineArgs({
    exampleArg: {
      type: "string",
      default: "defaultValue",
      description: "An example argument",
    },
  }),
  async run({ args }) {
    console.log("Command '${cmdName}' executed.");
    console.log("Received args:", args);
  },
});
`;
}

const cliTemplate = `import { defineCommand, runMain } from "@reliverse/rempts";
  
await runMain(
  defineCommand({
    // empty object activates file-based
    // commands in the src/app directory
  }),
);
`;
