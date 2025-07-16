/**
 * USAGE EXAMPLES:
 * - dler x install package-name - installs a package
 * - dler x remove package-name - removes a package
 * - dler x detect - detects the package manager
 * - dler x dedupe - deduplicates dependencies
 * - dler x run script-name - runs a script
 * - dler x exec --target 'bun run build' - executes a command
 */

import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import {
  defineArgs,
  defineCommand,
  multiselectPrompt,
  runCmd,
  selectPrompt,
} from "@reliverse/rempts";

import type { FileType, InitFileRequest } from "~/libs/sdk/sdk-impl/utils/init/init-types";

import { getCheckCmd } from "~/app/cmds";
import { x } from "~/libs/sdk/sdk-impl/utils/exec/exec-mod";
import { FILE_TYPES } from "~/libs/sdk/sdk-impl/utils/init/init-const";
import { initFile, initFiles } from "~/libs/sdk/sdk-impl/utils/init/init-impl";
import {
  addDependency,
  dedupeDependencies,
  updateDependencies,
  installDependencies,
  removeDependency,
  runScript,
} from "~/libs/sdk/sdk-impl/utils/pm/pm-api";
import { detectPackageManager } from "~/libs/sdk/sdk-impl/utils/pm/pm-detect";

export default defineCommand({
  meta: {
    name: "x",
    version: "1.1.0",
    description:
      "Unified package manager and command executor. Usage example: `dler x install` or `dler x exec --target 'bun run build'`",
  },
  args: defineArgs({
    action: {
      type: "string",
      description: "Action to perform: install, remove, detect, dedupe, run, exec, latest",
      required: true,
    },
    name: {
      type: "positional",
      description: "Package name or script name",
      required: false,
    },
    dev: {
      type: "boolean",
      alias: "D",
      description: "Add as dev dependency",
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
    target: {
      type: "string",
      description: "Command to execute (for exec action)",
    },
    timeout: {
      type: "number",
      description: "Timeout in milliseconds (for exec action)",
    },
    throwOnError: {
      type: "boolean",
      description: "Throw error if command fails",
      default: true,
    },
    fileType: {
      type: "string",
      description: "File type to initialize (e.g. 'md:README')",
    },
    destDir: {
      type: "string",
      description: "Destination directory",
      default: ".",
    },
    multiple: {
      type: "boolean",
      description: "Whether to select multiple file types from the library",
    },
    parallel: {
      type: "boolean",
      description: "Run tasks in parallel",
    },
    concurrency: {
      type: "string",
      description: "Concurrency limit if parallel is true",
      default: "4",
    },
    linter: {
      type: "boolean",
      description: "Run latest checks after updating dependencies",
      default: false,
    },
  }),
  async run({ args }) {
    const {
      action,
      name,
      target,
      timeout,
      throwOnError,
      fileType,
      destDir,
      multiple,
      parallel,
      concurrency,
      linter,
      ...options
    } = args;

    switch (action) {
      case "install":
      case "i":
      case "add":
        await (name ? addDependency(name, options) : installDependencies(options));
        break;

      case "remove":
      case "rm":
      case "uninstall":
      case "un":
      case "delete":
      case "del":
        if (!name) {
          relinka.error("Package name is required for remove action");
          return process.exit(1);
        }
        await removeDependency(name, options);
        break;

      case "detect": {
        const cwd = path.resolve(options.cwd || ".");
        const packageManager = await detectPackageManager(cwd);

        if (packageManager?.warnings) {
          for (const warning of packageManager.warnings) {
            relinka.warn(warning);
          }
        }

        if (!packageManager) {
          relinka.error(`Cannot detect package manager in \`${cwd}\``);
          return process.exit(1);
        }

        relinka.log(
          `Detected package manager in \`${cwd}\`: \`${packageManager.name}@${packageManager.version}\``,
        );
        break;
      }

      case "dedupe": {
        await dedupeDependencies(options);
        break;
      }

      case "run": {
        if (!name) {
          relinka.error("Script name is required for run action");
          return process.exit(1);
        }
        await runScript(name, options);
        break;
      }

      case "exec": {
        if (!target) {
          relinka.error("Target command is required for exec action");
          return process.exit(1);
        }

        try {
          // Parse the target command string into command and arguments
          const commandParts = target.trim().split(/\s+/);
          const command = commandParts[0];
          const commandArgs = commandParts.slice(1);

          if (!command) {
            relinka.error("No command provided");
            return process.exit(1);
          }

          relinka.log(`Executing: ${target}`);

          // Execute the command using the exec utility
          const result = x(command, commandArgs, {
            nodeOptions: {
              cwd: options.cwd ? path.resolve(options.cwd) : process.cwd(),
              stdio: "inherit", // This will pipe stdout/stderr to the parent process
            },
            timeout,
            throwOnError,
          });

          // Wait for the command to complete
          const output = await result;

          if (output.exitCode === 0) {
            relinka.success("Command completed successfully");
          } else {
            relinka.warn(`Command exited with code: ${output.exitCode}`);
            if (throwOnError) {
              return process.exit(output.exitCode || 1);
            }
          }
        } catch (error) {
          relinka.error(
            `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
          );
          return process.exit(1);
        }
        break;
      }

      case "init": {
        const concurrencyNum = Number(concurrency);

        // throw error if fileType doesn't include FILE_TYPES.type
        if (fileType && !FILE_TYPES.find((ft) => ft.type === fileType)) {
          throw new Error(`Invalid file type: ${fileType}`);
        }

        const effectiveFileType: FileType = fileType as FileType;

        if (multiple) {
          // Let the user choose multiple file types from a prompt
          const possibleTypes = FILE_TYPES.map((ft) => ft.type);
          const chosen = await multiselectPrompt({
            title: "Select file types to initialize",
            options: possibleTypes.map((pt) => ({ label: pt, value: pt })),
          });

          if (chosen.length === 0) {
            relinka("log", "No file types selected. Exiting...");
            return;
          }

          // Construct an array of requests
          const requests: InitFileRequest[] = chosen.map((ct) => ({
            fileType: ct,
            destDir,
          }));

          const results = await initFiles(requests, {
            parallel,
            concurrency: concurrencyNum,
          });
          relinka("verbose", `Multiple files result: ${JSON.stringify(results)}`);
        } else {
          // Single file approach
          let finalFileType = effectiveFileType;
          if (!finalFileType) {
            // If user didn't specify, prompt for a single file type
            const possibleTypes = FILE_TYPES.map((ft) => ft.type);
            const picked = await selectPrompt({
              title: "Pick a file type to initialize",
              options: possibleTypes.map((pt) => ({ label: pt, value: pt })),
            });
            finalFileType = picked;
          }

          const result = await initFile({
            fileType: finalFileType,
            destDir,
          });
          relinka("verbose", `Single file result: ${JSON.stringify(result)}`);
        }
        break;
      }

      case "latest": {
        await updateDependencies(true, options);
        if (linter) {
          await runCmd(await getCheckCmd(), ["--no-exit", "--no-progress"]);
        }
        break;
      }

      default: {
        relinka.error(`Unknown action: ${action}`);
        relinka.log("Available actions: install, remove, detect, dedupe, run, exec");
        return process.exit(1);
      }
    }
  },
});
