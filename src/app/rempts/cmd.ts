import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

export default defineCommand({
  meta: {
    name: "rempts",
    version: "1.0.0",
    description:
      "Scaffold new CLI commands and generate a command exports file (this file allows you to run your commands programmatically).",
  },
  args: defineArgs({
    init: {
      type: "string",
      description: "Names of commands to initialize (space-separated or quoted)",
    },
    overwrite: {
      type: "boolean",
      description: "Overwrite existing commands and exports file",
      default: true,
    },
    customCmdsRoot: {
      type: "string",
      description: "Root directory for custom commands",
    },
    outFile: {
      type: "string",
      description: "Output file path for exports (relative to workspace root)",
      default: "src/app/cmds.ts",
    },
    cmdDirs: {
      type: "array",
      description: "Command directories to scan (relative to src/app)",
    },
  }),
  async run({ args }) {
    let cmdsRoot = args.customCmdsRoot;
    let cliFilePath = "";

    // --- 1. Create commands if requested ---
    let didInit = false;
    if (args.init) {
      let cmdNames: string[] = [];
      if (Array.isArray(args.init)) {
        cmdNames = args.init as string[];
      } else if (typeof args.init === "string") {
        cmdNames = args.init.split(/\s+/).filter(Boolean);
      }
      if (cmdNames.length === 1) {
        const argv = process.argv;
        const initIndex = argv.indexOf("--init");
        if (initIndex !== -1 && initIndex + 1 < argv.length) {
          const additionalArgs: string[] = [];
          for (let i = initIndex + 2; i < argv.length; i++) {
            const arg = argv[i];
            if (arg?.startsWith("--")) break;
            if (arg && !arg.startsWith("-")) {
              additionalArgs.push(arg);
            } else {
              break;
            }
          }
          if (additionalArgs.length > 0 && cmdNames[0]) {
            cmdNames = [cmdNames[0], ...additionalArgs];
          }
        }
      }
      if (cmdNames.length === 0) {
        relinka("error", "No command names provided");
        return;
      }

      if (!cmdsRoot) {
        const defaultCmdsRoot = path.resolve("src/app");
        if (await fs.pathExists(defaultCmdsRoot)) {
          cmdsRoot = defaultCmdsRoot;
        } else {
          const { cmdsRoot: configCmdsRoot, cliFile } = await handleDlerConfig();
          cmdsRoot = configCmdsRoot;
          cliFilePath = cliFile;
        }
      } else {
        cmdsRoot = path.resolve(cmdsRoot);
      }

      relinka("info", `🚀 Creating ${cmdNames.length} command(s): ${cmdNames.join(", ")}`);

      for (const cmdName of cmdNames) {
        const dirPath = path.join(cmdsRoot, cmdName);
        const filePath = path.join(dirPath, "cmd.ts");
        if ((await fs.pathExists(filePath)) && !args.overwrite) {
          relinka("warn", `Command "${cmdName}" already exists. Use --overwrite to overwrite.`);
          continue;
        }
        await fs.ensureDir(dirPath);
        const content = generateCommandTemplate(cmdName);
        await fs.writeFile(filePath, content, "utf8");
        relinka("verbose", `✅ Created new command: ${filePath}`);
      }

      if (cliFilePath) {
        relinka(
          "info",
          "📦 Make sure you have @reliverse/rempts installed: bun add @reliverse/rempts",
        );
      }

      didInit = true;
    }

    // --- 2. (Re)generate the exports file if requirements are met ---
    // If no args.init, just (re)generate cmds.ts if at least one cmd.{ts,js} exists
    if (!args.init) {
      const root = path.resolve("src/app");
      const outPath = path.resolve(args.outFile ?? "src/app/cmds.ts");

      const cmdDirs =
        (args.cmdDirs ?? []).length > 0 ? (args.cmdDirs ?? []) : await findCommandDirs(root);

      if (cmdDirs.length === 0) {
        relinka(
          "warn",
          "No command directories found with cmd.ts or cmd.js files. Nothing to generate.",
        );
        return;
      }

      if ((await fs.pathExists(outPath)) && !args.overwrite) {
        relinka("warn", `❌ File "${outPath}" already exists. Use --overwrite to overwrite.`);
        return;
      }

      const exports = await generateExports(cmdDirs);
      await fs.ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, exports, "utf8");
      relinka("success", `✅ Generated command exports at: ${outPath}`);
      relinka("verbose", `Found ${cmdDirs.length} command(s): ${cmdDirs.join(", ")}`);
      return;
    }

    // If we got here, it means --init was used and handled above, and we always (re)generate exports after that
    const root = path.resolve("src/app");
    const outPath = path.resolve(args.outFile ?? "src/app/cmds.ts");

    if ((await fs.pathExists(outPath)) && !args.overwrite) {
      relinka("warn", `❌ File "${outPath}" already exists. Use --overwrite to overwrite.`);
      return;
    }

    const cmdDirs =
      (args.cmdDirs ?? []).length > 0 ? (args.cmdDirs ?? []) : await findCommandDirs(root);

    if (cmdDirs.length === 0) {
      relinka("warn", "No command directories found with cmd.ts or cmd.js files.");
      return;
    }

    const exports = await generateExports(cmdDirs);
    await fs.ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, exports, "utf8");
    relinka("success", `✅ Generated command exports at: ${outPath}`);
    relinka("verbose", `Found ${cmdDirs.length} command(s): ${cmdDirs.join(", ")}`);

    // print usage example if --init was used
    if (didInit) {
      relinka(
        "log",
        `Usage example:

import { getCmdName } from "~/app/cmds";
const cmd = await getCmdName();
await runCmd(cmd, [
  // String arguments
  "--name=my-project",
  "--path=./src",
  
  // Boolean flags
  "--force",
  "--no-cache",
  
  // Number values
  "--port=3000",
  
  // Array values
  "--files=file1.ts,file2.ts",

  // Positional arguments (must come last)
  "--build=src/1.ts src/2.ts",
]);`,
      );
    }
  },
});

async function handleDlerConfig() {
  const dlerConfigPath = path.resolve(".config/dler.ts");
  let cmdsRoot = "src/app";
  let cliFilePath = "";

  try {
    const jiti = createJiti(import.meta.url);
    const dlerConfig = await jiti.import<DlerConfig>(dlerConfigPath, {
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

async function ensureCliFile(filePath: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  if (!(await fs.pathExists(resolvedPath))) {
    await fs.ensureDir(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, cliTemplate, "utf8");
    relinka("verbose", `✅ Created CLI entry file: ${resolvedPath}`);
    return resolvedPath;
  }
  return "";
}

async function findCommandDirs(root: string): Promise<string[]> {
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

async function generateCommandArgsMap(cmdDirs: string[]): Promise<string> {
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

function extractArgsFromContent(content: string): ArgDefinition[] {
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

async function generateExports(cmdDirs: string[]): Promise<string> {
  const lines = [
    "// autogenerated by `dler rempts`",
    "// don't edit this file manually",
    "",
    'import type { Command } from "@reliverse/rempts";',
    "",
    'import { loadCommand, callCmdImpl, getTypedCmdImpl } from "@reliverse/rempts";',
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

function generateCommandTemplate(cmdName: string) {
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
