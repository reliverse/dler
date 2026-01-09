import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";
import { loadConfig } from "../utils/config";
import { glob } from "../utils/glob";
import { validateFiles } from "../utils/validator";

const validateCommand = defineCommand({
  name: "validate",
  description: "Validate files against defined rules",
  options: {
    config: option(
      type("string | undefined").narrow((s, ctx) => {
        if (!s) {
          return true;
        }
        return (
          s.endsWith(".json") ||
          s.endsWith(".ts") ||
          s.endsWith(".js") ||
          ctx.reject(`Config file must be .json, .ts, or .js (was "${s}")`)
        );
      }),
      {
        short: "c",
        description: "Path to config file (.json, .ts, or .js)",
      }
    ),
    fix: option(
      type("boolean").pipe((v) => v ?? false),
      {
        short: "f",
        description: "Auto-fix issues",
      }
    ),
    cache: option(
      type("boolean").pipe((v) => v ?? true),
      {
        description: "Enable caching",
      }
    ),
    files: option(type("string | undefined"), {
      description: "Files to validate (if not specified, uses config patterns)",
    }),
  },
  handler: async ({ positional, flags, spinner }) => {
    const spin = spinner("Loading configuration...");
    spin.start();

    try {
      // Load config
      const config = await loadConfig(flags.config);
      spin.succeed("Configuration loaded");

      // Resolve files
      const fileSpin = spinner("Resolving files...");
      fileSpin.start();

      const files = await glob(flags.files ? [flags.files] : positional, {
        include: config.include,
        exclude: config.exclude,
      });

      fileSpin.succeed(`Found ${files.length} files to validate`);

      if (files.length === 0) {
        console.log(relico.yellow("No files matched the pattern"));
        return;
      }

      // Run validation
      const validateSpin = spinner("Validating files...");
      validateSpin.start();

      const results = await validateFiles(files, {
        rules: config.rules,
        fix: flags.fix,
        cache: flags.cache && config.cache?.enabled,
      });

      validateSpin.stop();

      // Display results
      let hasErrors = false;

      for (const result of results) {
        if (result.errors.length > 0 || result.warnings.length > 0) {
          console.log();
          console.log(relico.bold(result.file));

          for (const error of result.errors) {
            console.log(relico.red(`  ✗ ${error.line}:${error.column} ${error.message}`));
            hasErrors = true;
          }

          for (const warning of result.warnings) {
            console.log(relico.yellow(`  ⚠ ${warning.line}:${warning.column} ${warning.message}`));
          }
        }
      }

      // Summary
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

      console.log();
      if (totalErrors === 0 && totalWarnings === 0) {
        console.log(relico.green("✅ All files passed validation!"));
      } else {
        console.log(relico.bold("Summary:"));
        if (totalErrors > 0) {
          console.log(relico.red(`  ${totalErrors} error${totalErrors !== 1 ? "s" : ""}`));
        }
        if (totalWarnings > 0) {
          console.log(relico.yellow(`  ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`));
        }

        if (hasErrors) {
          process.exit(1);
        }
      }
    } catch (error) {
      spin.fail("Validation failed");
      console.error(relico.red(String(error)));
      process.exit(1);
    }
  },
});

export default validateCommand;
