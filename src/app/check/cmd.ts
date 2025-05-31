import { relinka } from "@reliverse/relinka";
import {
  defineCommand,
  selectPrompt,
  multiselectPrompt,
  confirmPrompt,
  defineArgs,
} from "@reliverse/rempts";

import type { AllowedFileExtensionsType } from "~/libs/sdk/sdk-impl/rules/rules-consts";

import { checkDlerConfigHealth } from "~/libs/sdk/sdk-impl/rules/reliverse/dler-config-health/dler-config-health";
import { checkFileExtensions } from "~/libs/sdk/sdk-impl/rules/reliverse/file-extensions/file-extensions";
import { checkMissingDependencies } from "~/libs/sdk/sdk-impl/rules/reliverse/missing-deps/deps-mod";
import { checkNoIndexFiles } from "~/libs/sdk/sdk-impl/rules/reliverse/no-index-files/no-index-files";
import { checkPackageJsonHealth } from "~/libs/sdk/sdk-impl/rules/reliverse/package-json-health/package-json-health";
import { checkPathExtensions } from "~/libs/sdk/sdk-impl/rules/reliverse/path-extensions/path-extensions";
import { checkSelfInclude } from "~/libs/sdk/sdk-impl/rules/reliverse/self-include/self-include";
import { checkTsConfigHealth } from "~/libs/sdk/sdk-impl/rules/reliverse/tsconfig-health/tsconfig-health";
import { displayCheckResults } from "~/libs/sdk/sdk-impl/rules/rules-mod";

export default defineCommand({
  meta: {
    name: "check",
    version: "1.0.0",
    description: "check your codebase source and dists for any issues.",
  },
  args: defineArgs({
    directory: {
      type: "string",
      description:
        "directory to check (src, dist-npm, dist-jsr, dist-libs/npm, dist-libs/jsr, or all)",
    },
    checks: {
      type: "string",
      description:
        "comma-separated list of checks to run (missing-deps,file-extensions,path-extensions,dler-config-health,self-include,tsconfig-health,package-json-health,no-index-files)",
    },
    strict: {
      type: "boolean",
      description: "enable strict mode (requires explicit extensions)",
    },
    json: {
      type: "boolean",
      description: "output results in JSON format",
    },
  }),
  async run({ args }) {
    relinka(
      "info",
      "this command checks your codebase for extension and dependency issues.",
    );
    relinka(
      "info",
      "📁 file rules: .ts files allowed in src/jsr dirs, .js files in npm dirs",
    );
    relinka(
      "info",
      "📦 import rules: use .js imports in src/npm dirs, .ts imports in jsr dirs",
    );
    relinka(
      "info",
      "🔄 self-include rules: no importing from main package or self-imports in libs",
    );
    relinka(
      "info",
      "📚 index files: avoid using index.{ts,js} files to prevent module resolution confusion",
    );

    let dir: string;
    let checks: string[];
    let strict: boolean;

    // Handle directory selection
    if (args.directory) {
      dir = args.directory;
    } else {
      dir = await selectPrompt({
        title: "select a directory to check",
        options: [
          { label: "all directories", value: "all" },

          // TODO: run this automatically BEFORE `dler build`
          { label: "src (typescript source)", value: "src" },

          // TODO: run this automatically AFTER `dler build`
          { label: "dist-npm (compiled js)", value: "dist-npm" },
          { label: "dist-jsr (typescript)", value: "dist-jsr" },
          { label: "dist-libs/npm (compiled js)", value: "dist-libs/npm" },
          { label: "dist-libs/jsr (typescript)", value: "dist-libs/jsr" },
        ],
      });
    }

    // Handle checks selection
    if (args.checks) {
      checks = args.checks.split(",");
    } else {
      checks = await multiselectPrompt({
        title: "select checks to run",
        options: [
          { label: "missing dependencies", value: "missing-deps" },
          {
            label: "file extensions (.ts/.js files)",
            value: "file-extensions",
          },
          {
            label: "import path extensions (.ts/.js imports)",
            value: "path-extensions",
          },
          {
            label: "dler configuration",
            value: "dler-config-health",
          },
          {
            label: "self-include (no self-imports)",
            value: "self-include",
          },
          {
            label: "tsconfig.json validation",
            value: "tsconfig-health",
          },
          {
            label: "package.json validation",
            value: "package-json-health",
          },
          {
            label: "no index files",
            value: "no-index-files",
          },
        ],
      });
    }

    // Handle strict mode
    if (args.strict !== undefined) {
      strict = args.strict;
    } else {
      strict = await confirmPrompt({
        title: "activate strict mode?",
        content:
          "strict mode requires explicit extensions (no empty extensions). files: .ts in src/jsr dirs, .js in npm dirs. imports: .js in src/npm dirs, .ts in jsr dirs. templates folder is always exempt.",
      });
    }

    if (checks.length === 0) {
      relinka("warn", "no checks selected, exiting...");
      return;
    }

    // determine directories to check
    const directories =
      dir === "all"
        ? ([
            "src",
            "dist-npm",
            "dist-jsr",
            "dist-libs/npm",
            "dist-libs/jsr",
          ] as AllowedFileExtensionsType[])
        : [dir as AllowedFileExtensionsType];

    // run checks for each directory
    for (const directory of directories) {
      relinka("info", `\nchecking directory: ${directory}`);

      // progress callback for user feedback
      const onProgress = (current: number, total: number) => {
        if (current % 10 === 0 || current === total) {
          process.stdout.write(`\r  progress: ${current}/${total} files...`);
        }
      };

      try {
        if (checks.includes("package-json-health")) {
          process.stdout.write("  checking package.json health...\n");
          const result = await checkPackageJsonHealth();
          process.stdout.write("\r");
          displayCheckResults("package.json health", directory, result);
        }

        if (checks.includes("tsconfig-health")) {
          process.stdout.write("  checking tsconfig.json health...\n");
          const result = await checkTsConfigHealth();
          process.stdout.write("\r");
          displayCheckResults("tsconfig.json health", directory, result);
        }

        if (checks.includes("dler-config-health")) {
          process.stdout.write("  checking libs main file format...\n");
          const result = await checkDlerConfigHealth();
          process.stdout.write("\r");
          displayCheckResults("libs main file format", directory, result);
        }

        if (checks.includes("missing-deps")) {
          process.stdout.write("  checking missing dependencies...\n");
          const result = await checkMissingDependencies({
            directory,
            strict: false, // not used for deps check
            moduleResolution: "bundler", // not used for deps check
            onProgress,
          });
          process.stdout.write("\r");
          displayCheckResults("missing dependencies", directory, result);
        }

        if (checks.includes("file-extensions")) {
          process.stdout.write("  checking file extensions...\n");
          const result = await checkFileExtensions({
            directory,
            strict,
            moduleResolution: "bundler",
            onProgress,
          });
          process.stdout.write("\r");
          displayCheckResults("file extensions", directory, result);
        }

        if (checks.includes("path-extensions")) {
          process.stdout.write("  checking import path extensions...\n");
          const result = await checkPathExtensions({
            directory,
            strict,
            moduleResolution: "bundler",
            onProgress,
          });
          process.stdout.write("\r");
          displayCheckResults("path extensions", directory, result);
        }

        if (checks.includes("self-include")) {
          process.stdout.write("  checking self-includes...\n");
          const result = await checkSelfInclude({
            directory,
            strict,
            moduleResolution: "bundler",
            onProgress,
          });
          process.stdout.write("\r");
          displayCheckResults("self-includes", directory, result);
        }

        if (checks.includes("no-index-files")) {
          process.stdout.write("  checking for index files...\n");
          const result = await checkNoIndexFiles({
            directory,
            strict,
            moduleResolution: "bundler",
            onProgress,
          });
          process.stdout.write("\r");
          displayCheckResults("no index files", directory, result);
        }
      } catch (error) {
        relinka(
          "error",
          `failed to check ${directory}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    relinka("success", "all checks completed!");
  },
});
