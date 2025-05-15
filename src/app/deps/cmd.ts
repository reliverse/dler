// todo: migrate to @reliverse/rempts + @reliverse/relifso + @reliverse/repath

/* import { re } from "@reliverse/relico";
import { Command } from "commander";
import path from "node:path";

import type { FinderOptions } from "./impl/types.js";

import { analyzeDependencies } from "./impl/analyzer.js";
import { formatOutput } from "./impl/formatter.js";

export const createCli = () => {
  const program = new Command();

  program
    .name("deps")
    .description("Find dependencies used but not listed in package.json")
    .version("1.0.0")
    .option(
      "-d, --directory <path>",
      "directory to scan (defaults to current directory)",
      ".",
    )
    .option(
      "-a, --all",
      "show all dependencies (both listed and not listed)",
      false,
    )
    .option("-i, --ignore <patterns>", "comma-separated patterns to ignore", "")
    .option("-j, --json", "output in JSON format", false)
    .option(
      "-b, --include-builtins",
      "include Node.js built-in modules in the output",
      false,
    )
    .action(async (cmdOptions) => {
      try {
        const directory = path.resolve(cmdOptions.directory);
        const ignorePatterns = cmdOptions.ignore
          ? cmdOptions.ignore.split(",")
          : [];

        const options: FinderOptions = {
          directory,
          showAll: cmdOptions.all,
          ignorePatterns,
          json: cmdOptions.json,
          includeBuiltins: cmdOptions.includeBuiltins,
        };

        console.log(re.gray(`Scanning directory: ${directory}`));

        const result = await analyzeDependencies(options);
        const output = formatOutput(result, options);

        console.log(output);

        // Exit with error code if missing dependencies found
        if (result.missingDependencies.length > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });

  return program;
}; */

// Create CLI
// const cli = createCli();

// Execute CLI if run directly
// if (require.main === module) {
//   cli.parse(process.argv);
// }
