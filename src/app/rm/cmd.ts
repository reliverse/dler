import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, inputPrompt } from "@reliverse/rempts";
import { glob } from "tinyglobby";
import pMap from "p-map";

export default defineCommand({
  meta: {
    name: "rm",
    version: "1.1.0",
    description:
      "Remove a file, directory, or glob pattern recursively. Usage example: `dler rm --target '**/node_modules'`",
  },
  args: defineArgs({
    target: {
      type: "string",
      description: "Path or glob pattern to the file(s) or directory(ies) to remove.",
      required: true,
    },
    nonInteractive: {
      type: "boolean",
      description:
        "Disable interactive prompts and require all arguments to be provided via flags.",
      default: false,
    },
  }),
  async run({ args }) {
    const { nonInteractive } = args;
    let { target } = args;

    if (!target && !nonInteractive) {
      target = await inputPrompt({
        title: "Enter the path or glob pattern to remove:",
        defaultValue: "",
      });
    }

    if (!target) {
      relinka("error", "No target path or pattern provided for removal.");
      return;
    }

    let matches: string[] = [];
    try {
      matches = await glob(target, { dot: true });
    } catch (error) {
      relinka("error", `Invalid glob pattern: ${target}`);
      return;
    }

    if (matches.length === 0) {
      relinka("error", `No files or directories matched: ${target}`);
      return;
    }

    // Sort matches so that deeper paths (files/dirs) are removed before their parent directories
    matches.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);

    let removedCount = 0;
    const concurrency = 8;
    await pMap(
      matches,
      async (match) => {
        const resolvedPath = path.resolve(match);
        try {
          if (!(await fs.pathExists(resolvedPath))) {
            relinka("warn", `Target does not exist: ${resolvedPath}`);
            return;
          }
          await fs.remove(resolvedPath);
          relinka("log", `Removed: ${resolvedPath}`);
          removedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          relinka("error", `Failed to remove '${resolvedPath}': ${errorMessage}`);
        }
      },
      { concurrency },
    );

    if (removedCount > 0) {
      relinka("log", `Successfully removed ${removedCount} item(s) matching: ${target}`);
    } else {
      relinka("warn", `No items were removed for pattern: ${target}`);
    }
  },
});
