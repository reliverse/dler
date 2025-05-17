import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";
import fs from "fs-extra";
import path from "pathe";

export default defineCommand({
  meta: {
    name: "init",
    version: "1.0.0",
    description: "Scaffold new CLI commands quickly.",
  },
  args: {
    cmd: {
      type: "array",
      required: true,
      description: "Names of commands to initialize",
      options: ["cmd1", "cmd2", "cmd3"],
    },
    force: {
      type: "boolean",
      default: false,
      description: "Overwrite existing commands",
    },
  },
  async run({ args }) {
    const root = path.resolve("src/app");

    for (const cmdName of args.cmd) {
      const dirPath = path.join(root, cmdName);
      const filePath = path.join(dirPath, "index.ts");

      if ((await fs.pathExists(filePath)) && !args.force) {
        relinka(
          "warn",
          `❌ Command "${cmdName}" already exists. Use --force to overwrite.`,
        );
        continue;
      }

      fs.mkdirSync(dirPath, {
        recursive: true,
      });

      const content = generateCommandTemplate(cmdName);
      fs.writeFileSync(filePath, content, "utf-8");

      relinka("log", `✅ Created new command: ${filePath}`);
    }
  },
});

function generateCommandTemplate(cmdName: string) {
  return `import { relinka } from "@reliverse/relinka";
  
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  meta: {
    name: "${cmdName}",
    version: "1.0.0",
    description: "Describe what ${cmdName} command does.",
  },
  args: {
    exampleArg: {
      type: "string",
      default: "defaultValue",
      description: "An example argument",
    },
  },
  async run({ args }) {
    relinka("log", "Command '${cmdName}' executed.");
    relinka("log", "Received args:", args);
  },
});
`;
}
