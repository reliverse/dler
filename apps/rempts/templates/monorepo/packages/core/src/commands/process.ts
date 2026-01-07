import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { logger } from "@{{name}}/utils";
import type { ProcessOptions } from "../types";

const processCommand = defineCommand({
  name: "process",
  description: "Process input files",
  args: type("string[]", { minLength: 1 }),
  options: {
    output: option(type("string?"), {
      short: "o",
      description: "Output directory",
    }),
    format: option(type("'json'|'yaml'|'text'", "=", "json"), {
      short: "f",
      description: "Output format",
    }),
    verbose: option(type("boolean", "=", false), {
      short: "v",
      description: "Verbose output",
    }),
  },
  handler: async ({ args, flags, spinner }) => {
    const spin = spinner("Processing files...");
    spin.start();

    try {
      for (const file of args) {
        if (flags.verbose) {
          logger.info(`Processing ${file}`);
        }

        // Process logic here
        await processFile(file, {
          input: file,
          output: flags.output,
          format: flags.format,
          verbose: flags.verbose,
        });
      }

      spin.succeed(`Processed ${args.length} files`);
    } catch (error) {
      spin.fail("Processing failed");
      logger.error(error);
      process.exit(1);
    }
  },
});

async function processFile(file: string, options: ProcessOptions): Promise<void> {
  // Implementation here
  logger.debug(`Processing ${file} with options:`, options);
}

export default processCommand;
