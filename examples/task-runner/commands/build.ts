import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { relico } from "@reliverse/relico";

export default defineCommand({
  name: "build" as const,
  description: "Build project with validation and transformation",
  options: {
    // Environment with validation
    env: option(type("'development'|'staging'|'production' | undefined").pipe(e => e ?? "development"), {
      short: "e",
      description: "Build environment",
    }),

    // Output directory with validation
    outdir: option(type("string").narrow((s, ctx) => {
      if (!s || s.length < 1) {
        return ctx.reject("Output directory cannot be empty");
      }
      return true;
    }).pipe(s => s ?? "dist"), {
      short: "o",
      description: "Output directory",
    }),

    // Configuration file with JSON parsing
    config: option(type("string | undefined"), {
      short: "c",
      description: "JSON configuration object",
    }),

    // Memory limit with size parsing
    memory: option(type("string | undefined").pipe(s => s ?? "512m"), {
      short: "m",
      description: "Memory limit (e.g., 512m, 2g)",
    }),

    // Variables with key=value parsing
    variables: option(type("string | undefined"), {
      short: "v",
      description: "Environment variables (key1=value1,key2=value2)",
    }),

    // Watch mode
    watch: option(type("boolean | undefined").pipe(b => b ?? false), {
      short: "w",
      description: "Watch for changes",
    }),
  },

  handler: async ({ flags, colors, spinner }) => {
    const spin = spinner("Building project...");

    try {
      // Parse and validate configuration
      let parsedConfig;
      if (flags.config) {
        try {
          parsedConfig = JSON.parse(flags.config);
        } catch {
          throw new Error("Invalid JSON configuration");
        }
      }

      // Parse and validate memory
      let parsedMemory;
      if (flags.memory) {
        if (!/^\d+[kmg]?$/i.test(flags.memory)) {
          throw new Error("Memory must be a number with optional unit (k, m, g)");
        }
        const num = parseInt(flags.memory);
        const unit = flags.memory.slice(-1).toLowerCase();
        const multipliers = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
        parsedMemory = num * (multipliers[unit as keyof typeof multipliers] || 1);
      }

      // Parse variables
      const parsedVariables: Record<string, string> = {};
      if (flags.variables) {
        flags.variables.split(",").forEach((pair) => {
          const [key, value] = pair.split("=");
          if (key && value) {
            parsedVariables[key.trim()] = value.trim();
          }
        });
      }

      // Simulate build process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      spin.update("Validating configuration...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (parsedConfig) {
        spin.update("Applying custom configuration...");
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      spin.update("Compiling assets...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      spin.succeed(`Build completed successfully!`);

      console.log(relico.bold("\nBuild Summary:"));
      console.log(`  Environment: ${relico.cyan(flags.env)}`);
      console.log(`  Output: ${relico.cyan(flags.outdir)}`);
      console.log(`  Memory: ${relico.cyan(parsedMemory?.toString() ?? flags.memory)} bytes`);

      if (parsedConfig) {
        console.log(`  Config: ${relico.cyan(JSON.stringify(parsedConfig, null, 2))}`);
      }

      if (Object.keys(parsedVariables).length > 0) {
        console.log(
          `  Variables: ${relico.cyan(Object.keys(parsedVariables).length.toString())} set`,
        );
      }

      if (flags.watch) {
        console.log(relico.yellow("\n👀 Watching for changes..."));
      }
    } catch (error) {
      spin.fail("Build failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  },
});
