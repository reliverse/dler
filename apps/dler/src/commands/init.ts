import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { spawn } from "node:child_process";
import { relico } from "@reliverse/relico";

export default defineCommand({
  name: "init",
  description: "Initialize a new Rempts CLI project",
  alias: "i",
  options: {
    name: option(type("string | undefined"), { short: "n", description: "Project name" }),
    template: option(type("'basic'|'advanced'|'monorepo'"), {
      short: "t",
      description: "Project template",
    }),
    dir: option(type("string | undefined"), {
      short: "d",
      description: "Directory to create project in",
    }),
    git: option(type("boolean"), {
      short: "g",
      description: "Initialize git repository",
    }),
    install: option(type("boolean"), { description: "Install dependencies" }),
    "package-manager": option(type("'bun'|'pnpm'|'yarn'|'npm'"), {
      short: "p",
      description: "Package manager to use",
    }),
  },
  handler: async ({ flags, positional, colors }) => {
    // Apply defaults
    const template = flags.template || "basic";
    const git = flags.git ?? true;
    const install = flags.install ?? true;
    const packageManager = flags["package-manager"] || "bun";

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
    if (template !== "basic") {
      args.push("--template", template);
    }

    if (flags.dir) {
      args.push("--dir", flags.dir);
    }

    if (!git) {
      args.push("--no-git");
    }

    if (!install) {
      args.push("--no-install");
    }

    if (packageManager !== "bun") {
      args.push("--package-manager", packageManager);
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
