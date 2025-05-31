import path from "@reliverse/pathkit";
import { re } from "@reliverse/relico";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import type { FinderOptions } from "~/libs/sdk/sdk-impl/rules/reliverse/missing-deps/deps-types";

import { analyzeDependencies } from "~/libs/sdk/sdk-impl/rules/reliverse/missing-deps/analyzer";
import { formatOutput } from "~/libs/sdk/sdk-impl/rules/reliverse/missing-deps/formatter";

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
    },
    ignore: {
      type: "string",
      description: "comma-separated patterns to ignore",
    },
    json: {
      type: "boolean",
      description: "output in JSON format",
    },
    builtins: {
      type: "boolean",
      description: "include Node.js built-in modules in the output",
    },
    dev: {
      type: "boolean",
      description: "check devDependencies instead of dependencies",
    },
    peer: {
      type: "boolean",
      description: "check peerDependencies instead of dependencies",
    },
    optional: {
      type: "boolean",
      description: "check optionalDependencies instead of dependencies",
    },
    fix: {
      type: "boolean",
      description: "automatically add missing dependencies to package.json",
    },
    depth: {
      type: "number",
      description: "maximum directory depth to scan (0 for unlimited)",
      default: 0,
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
        dev: args.dev,
        peer: args.peer,
        optional: args.optional,
        fix: args.fix,
        depth: args.depth,
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
