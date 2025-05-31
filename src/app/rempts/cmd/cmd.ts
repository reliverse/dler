import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";

import type { DlerConfig } from "~/libs/sdk/sdk-types";

import { generateCommandTemplate, cliTemplate } from "./templates";

export default defineCommand({
  meta: {
    name: "init",
    version: "1.0.0",
    description: "Scaffold new CLI commands quickly.",
  },
  args: defineArgs({
    init: {
      type: "string",
      required: true,
      description:
        "Names of commands to initialize (space-separated or quoted)",
    },
    overwrite: {
      type: "boolean",
      description: "Overwrite existing commands",
    },
    customCmdsRoot: {
      type: "string",
      description: "Root directory for custom commands",
    },
  }),
  async run({ args }) {
    // Validate init argument
    if (!args.init || args.init === "true" || args.init === "false") {
      relinka(
        "error",
        "Please provide at least one command name to initialize",
      );
      return;
    }

    // parse command names from init argument
    let cmdNames: string[] = [];

    if (Array.isArray(args.init)) {
      cmdNames = args.init as string[];
    } else if (typeof args.init === "string") {
      // handle quoted strings like "cmd1 cmd2 cmd3"
      cmdNames = args.init.split(/\s+/).filter(Boolean);
    }

    // fallback: try to extract additional commands from process.argv
    // this handles cases like: --init cmd1 cmd2 cmd3 (without quotes)
    if (cmdNames.length === 1) {
      const argv = process.argv;
      const initIndex = argv.findIndex((arg) => arg === "--init");

      if (initIndex !== -1 && initIndex + 1 < argv.length) {
        const additionalArgs: string[] = [];

        // collect args after --init until we hit another flag or end
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

    // determine commands root directory
    let cmdsRoot = args.customCmdsRoot;
    let cliFilePath = "";

    if (!cmdsRoot) {
      const defaultCmdsRoot = path.resolve("src/app");

      if (await fs.pathExists(defaultCmdsRoot)) {
        cmdsRoot = defaultCmdsRoot;
      } else {
        // src/app not found, try to read dler config
        const { cmdsRoot: configCmdsRoot, cliFile } = await handleDlerConfig();
        cmdsRoot = configCmdsRoot;
        cliFilePath = cliFile;
      }
    } else {
      cmdsRoot = path.resolve(cmdsRoot);
    }

    relinka(
      "info",
      `🚀 Creating ${cmdNames.length} command(s): ${cmdNames.join(", ")}`,
    );

    // create commands
    for (const cmdName of cmdNames) {
      const dirPath = path.join(cmdsRoot, cmdName);
      const filePath = path.join(dirPath, "cmd.ts");

      if ((await fs.pathExists(filePath)) && !args.overwrite) {
        relinka(
          "warn",
          `Command "${cmdName}" already exists. Use --overwrite to overwrite.`,
        );
        continue;
      }

      await fs.ensureDir(dirPath);
      const content = generateCommandTemplate(cmdName);
      await fs.writeFile(filePath, content, "utf-8");

      relinka("log", `✅ Created new command: ${filePath}`);
    }

    // show installation reminder if cli file was created
    if (cliFilePath) {
      relinka(
        "info",
        "📦 Make sure you have @reliverse/rempts installed: bun add @reliverse/rempts",
      );
    }
  },
});

async function handleDlerConfig() {
  const dlerConfigPath = path.resolve(".config/dler.ts");
  let cmdsRoot = "src/app";
  let cliFilePath = "";

  try {
    // read dler config using jiti
    const jiti = createJiti(import.meta.url);
    const dlerConfig = await jiti.import<DlerConfig>(dlerConfigPath, {
      default: true,
    });

    const coreIsCLI = dlerConfig?.coreIsCLI;

    if (!coreIsCLI?.enabled || !coreIsCLI?.scripts) {
      // case 1: no cli config or disabled
      cliFilePath = await ensureCliFile("src/cli.ts");
      cmdsRoot = "src/app";
    } else {
      // case 2: cli enabled with scripts
      const firstScript = Object.values(coreIsCLI.scripts)[0] as string;
      const scriptPath = path.resolve(firstScript);

      if (await fs.pathExists(scriptPath)) {
        const content = await fs.readFile(scriptPath, "utf-8");

        if (content.includes("@reliverse/rempts")) {
          // Check for runMain and cmdsRootPath if runMain is present
          if (content.includes("runMain")) {
            const cmdsRootMatch = content.match(
              /cmdsRootPath:\s*["']([^"']+)["']/,
            );
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
    // .config/dler.ts not found or invalid
    cliFilePath = await ensureCliFile("src/cli.ts");
    cmdsRoot = "src/app";
  }

  return { cmdsRoot: path.resolve(cmdsRoot), cliFile: cliFilePath };
}

async function ensureCliFile(filePath: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);

  if (!(await fs.pathExists(resolvedPath))) {
    await fs.ensureDir(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, cliTemplate, "utf-8");
    relinka("log", `✅ Created CLI entry file: ${resolvedPath}`);

    return resolvedPath;
  }

  return "";
}
