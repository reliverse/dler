import { defineCommand, option } from "@reliverse/rempts";
import { Generator } from "@reliverse/rempts-generator";
import { type } from "arktype";
import { loadConfig } from "@reliverse/rempts";
import { findEntry } from "../utils/find-entry";
import path from "node:path";
import { existsSync } from "node:fs";
import { relico } from "@reliverse/relico";

export default defineCommand({
  name: "dev",
  description: "Run your CLI in development mode with hot reload",
  alias: "d",
  options: {
    entry: option(type("string | undefined"), {
      short: "e",
      description: "Entry file (defaults to auto-detect)",
    }),
    commandsDir: option(type("string"), { description: "Commands directory" }),
    generate: option(type("boolean"), { description: "Enable codegen" }),
    clearScreen: option(type("boolean"), { description: "Clear screen on reload" }),
    watch: option(type("boolean"), { short: "w", description: "Watch for changes" }),
    inspect: option(type("boolean"), { short: "i", description: "Enable debugger" }),
    port: option(type("number | undefined"), {
      short: "p",
      description: "Debugger port",
    }),
  },
  handler: async ({ flags, positional, spinner, colors }) => {
    const config = await loadConfig();

    // Apply defaults
    const commandsDir = flags.commandsDir || "commands";
    const generate = flags.generate !== undefined ? flags.generate : true;
    const clearScreen = flags.clearScreen !== undefined ? flags.clearScreen : true;
    const watch = flags.watch !== undefined ? flags.watch : true;
    const inspect = flags.inspect !== undefined ? flags.inspect : false;

    // Generate types if codegen is enabled
    const generateTypes = async () => {
      if (!generate) return;

      const generator = new Generator({
        commandsDir: commandsDir,
        outputFile: "./.dler/commands.gen.ts",
        config,
        generateReport: config.commands?.generateReport ?? false,
      });

      try {
        await generator.run();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(relico.red(`Failed to generate types: ${message}`));
        return false;
      }
    };

    // Initial type generation
    if (generate) {
      const spin = spinner("Generating command types...");
      const success = await generateTypes();
      if (success) {
        spin.succeed("Types generated");
      } else {
        spin.fail("Failed to generate types");
        process.exit(1);
      }
    }

    // 2. Find entry point
    const entry = flags.entry || config.build?.entry || (await findEntry());
    if (!entry) {
      console.error(
        relico.red("No entry file found. Please specify with --entry or in dler.config.ts"),
      );
      process.exit(1);
    }

    const entryFile = Array.isArray(entry) ? entry[0] : entry;
    if (!entryFile) {
      console.error(relico.red("Entry file is required"));
      process.exit(1);
    }

    const entryPath = path.resolve(entryFile);
    if (!existsSync(entryPath)) {
      console.error(relico.red(`Entry file not found: ${entryPath}`));
      process.exit(1);
    }

    // Build bun command args
    const bunArgs: string[] = [];

    // Use --hot for hot reload (Bun's native hot reload)
    if (watch ?? config.dev?.watch ?? true) {
      bunArgs.push("--hot");
    }

    // Add inspect flag if enabled
    if (inspect) {
      bunArgs.push("--inspect");
      if (flags.port) {
        bunArgs.push(`--inspect-port=${flags.port}`);
      }
    } else if (flags.port) {
      // If port is specified without inspect, still add it
      bunArgs.push(`--inspect-port=${flags.port}`);
    }

    // Add the entry file
    bunArgs.push(entryPath);

    // Add any positional arguments (passed through to the CLI)
    if (positional.length > 0) {
      bunArgs.push(...positional);
    }

    console.log(relico.cyan("\n👀 Starting dev mode...\n"));
    if (watch ?? config.dev?.watch ?? true) {
      console.log(relico.dim(`Running: bun ${bunArgs.join(" ")}\n`));
    }

    // Watch for changes in commands directory to regenerate types
    let ac: AbortController | null = null;
    if (watch ?? config.dev?.watch ?? true) {
      const commandsDirPath = path.resolve(commandsDir);
      if (existsSync(commandsDirPath) && generate) {
        const { watch } = await import("node:fs/promises");
        ac = new AbortController();
        const { signal } = ac;

        // Watch commands directory for type regeneration
        const watchCommands = async () => {
          try {
            const watcher = watch(commandsDirPath, {
              recursive: true,
              signal,
            });

            for await (const event of watcher) {
              // Only regenerate for TypeScript/JavaScript files
              if (!event.filename?.match(/\.(ts|tsx|js|jsx)$/)) continue;

              // Skip generated files
              if (event.filename?.includes("commands.gen.ts")) continue;
              if (event.filename?.includes(".dler/")) continue;

              console.log(
                relico.dim(
                  `\n[${new Date().toLocaleTimeString()}] Command file changed: ${event.filename}`,
                ),
              );
              const spin = spinner("Regenerating types...");
              const success = await generateTypes();
              if (success) {
                spin.succeed("Types regenerated");
              } else {
                spin.fail("Failed to regenerate types");
              }
            }
          } catch (err: any) {
            if (err.name !== "AbortError") {
              throw err;
            }
          }
        };

        // Start watching in background
        watchCommands().catch((err) => {
          console.error(relico.red(`Watch error: ${err.message}`));
        });
      }
    }

    // Run the CLI with Bun
    const proc = Bun.spawn(["bun", ...bunArgs], {
      stdio: ["inherit", "inherit", "inherit"],
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });

    const handleExit = () => {
      console.log(relico.dim("\n\nStopping dev server..."));
      // Abort file watcher if it exists
      if (ac) {
        ac.abort();
      }
      // Kill the spawned process
      proc.kill();
      process.exit(0);
    };
    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    // Wait for process to exit
    await proc.exited;
    // Abort file watcher if it exists
    if (ac) {
      ac.abort();
    }
    process.exit(proc.exitCode ?? 0);
  },
});
