import { defineCommand, option } from "@reliverse/rempts";
import { z } from "zod";
import { spawn } from "node:child_process";
import { relico } from "@reliverse/relico";

export default defineCommand({
  name: "init",
  description: "Initialize a new Rempts CLI project",
  alias: "i",
  options: {
    name: option(z.string().optional(), { short: "n", description: "Project name" }),
    template: option(z.enum(["basic", "advanced", "monorepo"]).default("basic"), {
      short: "t",
      description: "Project template",
    }),
    dir: option(z.string().optional(), {
      short: "d",
      description: "Directory to create project in",
    }),
    git: option(z.boolean().default(true), {
      short: "g",
      description: "Initialize git repository",
    }),
    install: option(z.boolean().default(true), { description: "Install dependencies" }),
    "package-manager": option(z.enum(["bun", "pnpm", "yarn", "npm"]).default("bun"), {
      short: "p",
      description: "Package manager to use",
    }),
  },
  handler: async ({ flags, positional, colors }) => {
    console.log(relico.cyan("🚀 Creating new Rempts CLI project..."));
    console.log();

    // Build rempts command
    const args = ["rempts"];

    // Add project name from positional arg
    if (positional[0]) {
      args.push(positional[0]);
    } else if (flags.name) {
      args.push(flags.name);
    }

    // Add flags
    if (flags.template !== "basic") {
      args.push("--template", flags.template);
    }

    if (flags.dir) {
      args.push("--dir", flags.dir);
    }

    if (!flags.git) {
      args.push("--no-git");
    }

    if (!flags.install) {
      args.push("--no-install");
    }

    if (flags["package-manager"] !== "bun") {
      args.push("--package-manager", flags["package-manager"]);
    }

    console.log(relico.dim(`> bunx ${args.join(" ")}`));
    console.log();

    // Run rempts via bunx
    const proc = spawn("bunx", args, {
      stdio: "inherit",
      env: process.env,
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        console.log();
        console.log(relico.green("🎉 Project created successfully!"));
        console.log();
        console.log("Next steps:");
        const projectName = positional[0] || flags.name || "your-project";
        console.log(relico.gray(`  cd ${projectName}`));
        console.log(relico.gray("  rempts dev"));
      } else {
        console.error(relico.red("Failed to create project"));
        process.exit(code || 1);
      }
    });

    proc.on("error", (error) => {
      console.error(relico.red("Failed to run rempts:"), error.message);
      console.log();
      console.log("Make sure rempts is available:");
      console.log(relico.gray("  bunx rempts --help"));
      process.exit(1);
    });
  },
});
