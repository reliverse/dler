/**
 * USAGE EXAMPLES:
 * - dler install package-name - installs a package
 * - dler install - installs all dependencies
 * - dler dedupe - deduplicates dependencies
 */

import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import {
  addDependency,
  dedupeDependencies,
  installDependencies,
} from "~/libs/sdk/sdk-impl/utils/pm/pm-api";

export default defineCommand({
  meta: {
    name: "install",
    version: "1.1.0",
    description:
      "Install dependencies or deduplicate existing ones. Usage example: `dler install package-name` or `dler install` or `dler dedupe`",
  },
  args: defineArgs({
    action: {
      type: "string",
      description: "Action to perform: install, add, i, dedupe",
      required: false,
      default: "install",
    },
    name: {
      type: "positional",
      description: "Package name",
      required: false,
    },
    global: {
      type: "boolean",
      alias: "g",
      description: "Add globally",
    },
    "frozen-lockfile": {
      type: "boolean",
      description: "Install dependencies with frozen lock file",
    },
    cwd: {
      type: "string",
      description: "Current working directory",
    },
    workspace: {
      type: "boolean",
      description: "Add to workspace",
    },
    silent: {
      type: "boolean",
      description: "Run in silent mode",
    },
    recreateLockFile: {
      type: "boolean",
      description: "Recreate lock file (for dedupe)",
    },
    linter: {
      type: "boolean",
      description: "Run linter checks after updating dependencies",
      default: false,
    },
  }),
  async run({ args }) {
    console.log("DEBUG: install command starting with args:", args);

    const { action, name, linter, ...options } = args;

    switch (action) {
      case "install":
      case "i":
      case "add":
        console.log("DEBUG: install case, name:", name, "options:", options);
        await (name ? addDependency(name, options) : installDependencies(options));
        break;

      case "dedupe": {
        await dedupeDependencies(options);
        break;
      }

      default: {
        // If no specific action is provided, default to install behavior
        if (!action || action === "install") {
          console.log("DEBUG: default install case, name:", name, "options:", options);
          await (name ? addDependency(name, options) : installDependencies(options));
        } else {
          relinka.error(`Unknown action: ${action}`);
          relinka.log("Available actions: install, add, i, dedupe");
          return process.exit(1);
        }
      }
    }
  },
});
