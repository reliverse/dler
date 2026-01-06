import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { generateBash, generateZsh, generateFish } from "../generators/mod";
import { loadMetadata, getCLIName } from "../utils/metadata";
import { getInstallInstructions } from "../utils/instructions";
import type { CompletionsPluginOptions } from "../types";
import { relico } from "@reliverse/relico";

export default function completionsCommand(_pluginOptions: CompletionsPluginOptions) {
  return defineCommand({
    name: "completions",
    description: "Generate shell completion scripts",
    options: {
      shell: option(type("'bash'|'zsh'|'fish'"), {
        short: "s",
        description: "Target shell (bash, zsh, or fish)",
      }),
      output: option(type("string | undefined"), {
        short: "o",
        description: "Output file path (default: stdout)",
      }),
    },

    handler: async ({ flags, spinner }) => {
      const spin = spinner("Generating completions...");

      try {
        // Load command metadata
        const metadata = await loadMetadata();
        const cliName = await getCLIName();

        // Generate appropriate completion script
        let script: string;
        switch (flags.shell) {
          case "bash":
            script = generateBash(metadata, cliName);
            break;
          case "zsh":
            script = generateZsh(metadata, cliName);
            break;
          case "fish":
            script = generateFish(metadata, cliName);
            break;
          default:
            throw new Error(`Unsupported shell: ${flags.shell}`);
        }

        spin.succeed(`Generated ${flags.shell} completions`);

        // Output to file or stdout
        if (flags.output) {
          await Bun.write(flags.output, script);
          console.log(relico.green(`\n✅ Completions written to: ${flags.output}`));
        } else {
          console.log("\n" + script);
        }

        // Show installation instructions if outputting to stdout
        if (!flags.output) {
          console.log(relico.dim(getInstallInstructions(flags.shell, cliName)));
        }
      } catch (error) {
        spin.fail("Failed to generate completions");
        if (error instanceof Error) {
          console.error(relico.red(`\nError: ${error.message}`));
        } else {
          console.error(relico.red(`\nError: ${String(error)}`));
        }
        throw error;
      }
    },
  });
}
