import { defineCommand, runMain } from "@reliverse/rempts";

import { dler } from "./cli.js";
import { initDlerConfig } from "./init.js";
import { validateDevCwd } from "./libs/sdk/sdk-impl/utils/utils-cwd.js";

/**
 * Main command defined using `defineCommand()`.
 *
 * This command demonstrates the full range of launcher features along with all supported argument types:
 *
 * - Global Usage Handling: Automatically processes `--help` and `--version`.
 * - File-Based Subcommands: Scans "src/cli/args" for subcommands (e.g., `init`).
 * - Comprehensive Argument Parsing: Supports positional, boolean, string, number, and array arguments.
 * - Interactive Prompts: Uses built-in prompt functions for an engaging CLI experience.
 */
const mainCommand = defineCommand({
  meta: {
    name: "dler",
    version: "1.2.0",
    description: "dler CLI https://docs.reliverse.org",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
  },
  async run({ args }) {
    const isDev = args.dev;

    // if (isDev) {
    //   relinka("info", "[dler debug] Running in dev mode:", raw);
    //   relinka("info", "[dler debug] args:", args);
    //   relinka("info", "[dler debug] raw args:", raw);
    // }

    // Ensure --dev flag is used only within a valid dler dev env
    await validateDevCwd(isDev, ["dler"], "dler", "reliverse");

    // Init config if does not exist
    await initDlerConfig(isDev);

    // Run dler CLI
    await dler(isDev);
  },
});

/**
 * The `runMain()` function sets up the launcher with several advanced features:
 *
 * - File-Based Subcommands: Enables scanning for subcommands within the "src/cli/args" directory.
 * - Alias Mapping: Shorthand flags (e.g., `-v`) are mapped to their full names (e.g., `--verbose`).
 * - Strict Mode & Unknown Flag Warnings: Unknown flags are either warned about or handled via a callback.
 * - Negated Boolean Support: Allows flags to be negated (e.g., `--no-verbose`).
 * - Custom Unknown Flag Handler: Provides custom handling for unrecognized flags.
 */
await runMain(mainCommand, {
  fileBasedCmds: {
    enable: true, // Enables file-based subcommand detection.
    cmdsRootPath: "src/cli/args", // Directory to scan for subcommands.
  },
  alias: {
    v: "verbose", // Maps shorthand flag -v to --verbose.
  },
  strict: false, // Do not throw errors for unknown flags.
  warnOnUnknown: false, // Warn when encountering unknown flags.
  negatedBoolean: true, // Support for negated booleans (e.g., --no-verbose).
  // unknown: (flagName) => {
  //   relinka("warn", "Unknown flag encountered:", flagName);
  //   return false;
  // },
  // TODO: unknownErrorMsg: "An unhandled error occurred, please report it at https://github.com/reliverse/dler"
});
