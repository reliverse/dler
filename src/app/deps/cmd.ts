import path from "@reliverse/pathkit";
import { re } from "@reliverse/relico";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import type { FinderOptions } from "./impl/deps-types.js";

import { analyzeDependencies } from "./impl/analyzer.js";
import { formatOutput } from "./impl/formatter.js";

export default defineCommand({
  meta: {
    name: "deps",
    version: "1.0.0",
    description: "Find dependencies used but not listed in package.json",
  },
  args: defineArgs({
    directory: {
      type: "string",
      description: "directory to scan (defaults to current directory)",
      default: ".",
    },
    all: {
      type: "boolean",
      description: "show all dependencies (both listed and not listed)",
      default: false,
    },
    ignore: {
      type: "string",
      description: "comma-separated patterns to ignore",
      default: "",
    },
    json: {
      type: "boolean",
      description: "output in JSON format",
      default: false,
    },
    builtins: {
      type: "boolean",
      description: "include Node.js built-in modules in the output",
      default: false,
    },
  }),
  async run({ args }) {
    try {
      const directory = path.resolve(args.directory);
      const ignorePatterns = args.ignore ? args.ignore.split(",") : [];

      const options: FinderOptions = {
        directory,
        showAll: args.all,
        ignorePatterns,
        json: args.json,
        builtins: args.builtins,
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
  },
});
