import { defineCommand, option } from "@reliverse/rempts-core";
import { Generator } from "@reliverse/rempts-generator";
import { z } from "zod";
import { join } from "node:path";
import { isCommandFile } from "@reliverse/rempts-generator";
import { loadConfig } from "@reliverse/rempts-core";
import { relico } from "@reliverse/relico";

export default defineCommand({
  name: "generate",
  description: "Generate command type definitions",
  alias: "gen",
  options: {
    commandsDir: option(z.string().optional(), {
      description: "Commands directory",
    }),
    output: option(z.string().default("./.dler/commands.gen.ts"), {
      short: "o",
      description: "Output file",
    }),
    watch: option(z.boolean().default(false), {
      short: "w",
      description: "Watch for changes",
    }),
  },

  async handler({ flags, colors, spinner }) {
    // Load config to get default values
    const config = await loadConfig();

    const finalCommandsDir = flags.commandsDir || config.commands?.directory || "commands";
    const finalOutputFile = flags.output || "./.dler/commands.gen.ts";

    const generator = new Generator({
      commandsDir: finalCommandsDir,
      outputFile: finalOutputFile,
      config,
      generateReport: config.commands?.generateReport,
    });

    // Initial generation
    const spin = spinner("Generating types...");
    try {
      await generator.run();
      spin.succeed("Types generated");
    } catch (error) {
      spin.fail("Failed to generate types");
      const message = error instanceof Error ? error.message : String(error);
      console.error(relico.red(message));
      return;
    }

    if (flags.watch) {
      console.log(relico.cyan(`\n👀 Watching ${finalCommandsDir}...\n`));

      // Use Bun's native file watching with fs.promises.watch
      const { watch } = await import("node:fs/promises");

      const ac = new AbortController();
      const { signal } = ac;

      // Handle process termination
      process.on("SIGINT", () => {
        console.log(relico.dim("\nStopping watcher..."));
        ac.abort();
        process.exit(0);
      });

      try {
        const watcher = watch(finalCommandsDir, {
          recursive: true,
          signal,
        });

        for await (const event of watcher) {
          if (!event.filename || !isCommandFile(event.filename)) continue;

          console.log(relico.dim(`${event.eventType}: ${event.filename}`));
          const spin = spinner("Regenerating...");

          try {
            await generator.run({
              type: event.eventType === "rename" ? "delete" : "update",
              path: join(finalCommandsDir, event.filename),
            });
            spin.succeed("Updated");
          } catch (error) {
            spin.fail("Failed");
            const message = error instanceof Error ? error.message : String(error);
            console.error(relico.red(message));
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log(relico.dim("Watcher stopped"));
          return;
        }
        throw err;
      }
    }
  },
});
