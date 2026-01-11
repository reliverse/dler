import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  description: "Interactive project setup wizard",
  options: {
    // Preset configuration
    preset: option(type("'minimal' | 'standard' | 'full' | undefined"), {
      short: "p",
      description: "Use preset configuration",
    }),
  },

  handler: async ({ flags, prompt, spinner }) => {
    console.log(relico.bold("🎯 Project Setup Wizard"));
    console.log(relico.dim("Let's configure your project step by step\n"));

    // Use preset if provided
    if (flags.preset) {
      console.log(relico.cyan(`Using ${flags.preset} preset...`));

      const presets = {
        minimal: {
          name: "my-project",
          type: "library",
          framework: "bun",
          typescript: true,
          git: true,
          installDeps: false,
          features: [],
        },
        standard: {
          name: "my-app",
          type: "application",
          framework: "bun",
          typescript: true,
          git: true,
          installDeps: true,
          features: ["testing", "linting"],
        },
        full: {
          name: "my-fullstack-app",
          type: "application",
          framework: "bun",
          typescript: true,
          git: true,
          installDeps: true,
          features: ["testing", "linting", "docker", "ci"],
        },
      };

      const config = presets[flags.preset as keyof typeof presets];
      console.log(relico.green("✅ Preset applied successfully!"));
      console.log(relico.dim("\nConfiguration:"));
      console.log(`  Name: ${relico.cyan(config.name)}`);
      console.log(`  Type: ${relico.cyan(config.type)}`);
      console.log(`  Framework: ${relico.cyan(config.framework)}`);
      console.log(`  TypeScript: ${relico.cyan(config.typescript ? "Yes" : "No")}`);
      console.log(`  Git: ${relico.cyan(config.git ? "Yes" : "No")}`);
      console.log(`  Features: ${relico.cyan(config.features.join(", ") || "None")}`);
      return;
    }

    // Interactive setup
    const config: {
      name?: string;
      type?: string;
      framework?: string;
      typescript?: boolean;
      git?: boolean;
      installDeps?: boolean;
      features?: string[];
    } = {};

    // Project name
    config.name = await prompt.text("Project name:", {
      default: "my-project",
      schema: type("string").narrow((val: string, ctx) => {
        if (!val || val.length < 2) {
          return ctx.reject("Name must be at least 2 characters");
        }
        return (
          /^[a-zA-Z0-9-_]+$/.test(val) ||
          ctx.reject("Name can only contain letters, numbers, hyphens, and underscores")
        );
      }),
    });

    // Project type
    config.type = await prompt.select("Project type:", {
      options: [
        { value: "library", label: "Library", hint: "Reusable code package" },
        { value: "application", label: "Application", hint: "Standalone app" },
        { value: "monorepo", label: "Monorepo", hint: "Multiple packages" },
      ],
      default: "application",
    });

    // Framework
    config.framework = await prompt.select("Runtime framework:", {
      options: [
        { value: "bun", label: "Bun", hint: "Fast JavaScript runtime" },
        { value: "node", label: "Node.js", hint: "Traditional Node.js" },
        { value: "deno", label: "Deno", hint: "Secure by default" },
      ],
      default: "bun",
    });

    // TypeScript
    config.typescript = await prompt.confirm("Use TypeScript?", {
      default: true,
    });

    // Git
    config.git = await prompt.confirm("Initialize Git repository?", {
      default: true,
    });

    // Features
    const availableFeatures = [
      { value: "testing", label: "Testing", hint: "Jest/Vitest setup" },
      { value: "linting", label: "Linting", hint: "ESLint configuration" },
      { value: "docker", label: "Docker", hint: "Containerization" },
      { value: "ci", label: "CI/CD", hint: "GitHub Actions" },
    ];

    config.features = await prompt.multiselect<string>("Additional features:", {
      options: availableFeatures,
    });

    // Install dependencies
    config.installDeps = await prompt.confirm("Install dependencies now?", {
      default: true,
    });

    // Show configuration summary
    console.log(relico.bold("\n📋 Configuration Summary:"));
    console.log(`  Name: ${relico.cyan(config.name)}`);
    console.log(`  Type: ${relico.cyan(config.type)}`);
    console.log(`  Framework: ${relico.cyan(config.framework)}`);
    console.log(`  TypeScript: ${relico.cyan(config.typescript ? "Yes" : "No")}`);
    console.log(`  Git: ${relico.cyan(config.git ? "Yes" : "No")}`);
    console.log(`  Features: ${relico.cyan(config.features.join(", ") || "None")}`);
    console.log(`  Install deps: ${relico.cyan(config.installDeps ? "Yes" : "No")}`);

    // Final confirmation
    const confirmed = await prompt.confirm("\nCreate project with this configuration?", {
      default: true,
    });

    if (!confirmed) {
      console.log(relico.yellow("Setup cancelled"));
      return;
    }

    // Simulate project creation
    const spin = spinner("Creating project...");

    try {
      // Create directory
      spin.update("Creating project directory...");
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Initialize package.json
      spin.update("Initializing package.json...");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Setup TypeScript
      if (config.typescript) {
        spin.update("Configuring TypeScript...");
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      // Initialize Git
      if (config.git) {
        spin.update("Initializing Git repository...");
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Setup features
      for (const feature of config.features) {
        spin.update(`Setting up ${feature}...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Install dependencies
      if (config.installDeps) {
        spin.update("Applying changes (bun install)...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      spin.succeed("Project created successfully!");

      console.log(relico.green("\n🎉 Your project is ready!"));
      console.log(relico.dim("\nNext steps:"));
      console.log(`  ${relico.cyan("cd")} ${config.name}`);
      console.log(`  ${relico.cyan("bun run dev")} # Start development`);
      console.log(`  ${relico.cyan("bun run build")} # Build for production`);
    } catch (error) {
      spin.fail("Project creation failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  },
});
