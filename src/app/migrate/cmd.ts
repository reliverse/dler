import { relinka } from "@reliverse/relinka";
import { confirmPrompt, defineArgs, defineCommand } from "@reliverse/rempts";

import { migrateAnythingToBun } from "./codemods/anything-bun";
import { consoleToRelinka } from "./codemods/console-relinka";
import { migrateFsToRelifso } from "./codemods/fs-relifso";
import { migrateModuleResolution } from "./codemods/nodenext-bundler";
import { migratePathToPathkit } from "./codemods/path-pathkit";
import { migrateReaddirToGlob } from "./codemods/readdir-glob";

type LogFormat =
  | "console"
  | "consolaMethod"
  | "consolaObject"
  | "relinkaFunction"
  | "relinkaMethod"
  | "relinkaObject";

export default defineCommand({
  meta: {
    name: "migrate",
    version: "1.0.0",
    description: "Migrate between different libraries and usages",
  },
  args: defineArgs({
    interactive: {
      type: "boolean",
      description: "Interactive mode",
      default: true,
    },
    codemod: {
      type: "string",
      description:
        "The migration to perform (anything-bun | path-pathkit | fs-relifso | nodenext-bundler | readdir-glob | console-relinka)",
    },
    project: {
      type: "string",
      description: "Project directory to migrate (default: current directory)",
      default: ".",
    },
    mrTarget: {
      type: "string",
      description:
        "Target for module resolution migration (nodenext | bundler)",
      default: "nodenext",
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without applying them",
    },
    noBackup: {
      type: "boolean",
      description: "Skip creating backup files",
      default: false,
    },
    consoleRelinkaInput: {
      type: "string",
      description:
        "Input file or directory path. Specify to convert your project between different logging formats (console, consola method/object, relinka function/method/object).",
    },
    consoleRelinkaFrom: {
      type: "string",
      description:
        "Source format (console, consolaMethod, consolaObject, relinkaFunction, relinkaMethod, relinkaObject)",
    },
    consoleRelinkaTo: {
      type: "string",
      description:
        "Target format (console, consolaMethod, consolaObject, relinkaFunction, relinkaMethod, relinkaObject)",
    },
  }),
  async run({ args }) {
    if (args.interactive) {
      const confidence = await confirmPrompt({
        title: `This is an experimental feature and probably may broke some things.\nIt will be improved in the future.\nAre you sure you want to migrate files in ${args.project}?`,
        defaultValue: false,
      });
      if (!confidence) {
        throw new Error("Migration cancelled");
      }
    }

    if (args.codemod === "anything-bun") {
      relinka("log", "Migrating to Bun...");
      await migrateAnythingToBun({
        project: args.project,
        dryRun: args.dryRun,
        noBackup: args.noBackup,
      });
      if (!args.dryRun) {
        relinka("log", "\nMigration completed!");
        relinka("log", "Next steps:");
        relinka("log", "1. Run 'bun install' to install dependencies with Bun");
        relinka("log", "2. Test your application thoroughly");
        relinka(
          "log",
          "3. Review async/await usage in converted file operations",
        );
        relinka(
          "log",
          "4. Update any custom database queries to use Bun.sql syntax",
        );
        relinka(
          "log",
          "5. Review and update any custom middleware in Express apps",
        );
      }
      return;
    }

    let results: any[] = [];

    if (args.codemod === "path-pathkit") {
      relinka(
        "log",
        "Migrating from node:path and/or pathe to @reliverse/pathkit...",
      );
      results = await migratePathToPathkit(args.dryRun);
    } else if (args.codemod === "fs-relifso") {
      relinka(
        "log",
        "Migrating from node:fs and/or fs-extra to @reliverse/relifso...",
      );
      results = await migrateFsToRelifso(args.dryRun);
    } else if (args.codemod === "nodenext-bundler") {
      if (!["nodenext", "bundler"].includes(args.mrTarget)) {
        relinka("error", `Invalid mrTarget: ${args.mrTarget}`);
        relinka("log", "Available targets:");
        relinka("log", "  - nodenext");
        relinka("log", "  - bundler");
        return;
      }
      relinka("log", `Migrating to ${args.mrTarget} module resolution...`);
      results = await migrateModuleResolution(
        args.mrTarget as "nodenext" | "bundler",
        args.dryRun,
      );
    } else if (args.codemod === "readdir-glob") {
      relinka("log", "Migrating from fs.readdir to globby...");
      results = await migrateReaddirToGlob(args.dryRun);
    } else if (args.codemod === "console-relinka") {
      relinka("log", "Migrating logging format...");
      await consoleToRelinka(
        args.consoleRelinkaInput,
        args.consoleRelinkaFrom as LogFormat,
        args.consoleRelinkaTo as LogFormat,
      );
      return;
    } else {
      relinka("error", `Unknown migration: ${args.codemod}`);
      relinka("log", "Available migrations:");
      relinka("log", "  - anything-bun");
      relinka("log", "  - path-pathkit");
      relinka("log", "  - fs-relifso");
      relinka("log", "  - nodenext-bundler");
      relinka("log", "  - readdir-glob");
      relinka("log", "  - console-relinka");
      return;
    }

    // print results
    relinka("info", "\nMigration Results:");
    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      relinka("log", `${status} ${result.file}: ${result.message}`);

      if (result.changes && result.changes.length > 0) {
        for (const change of result.changes) {
          if (change.startsWith("⚠️")) {
            relinka("log", `    ${change}`);
            warningCount++;
          } else {
            relinka("log", `    - ${change}`);
          }
        }
      }

      if (result.success) successCount++;
      else errorCount++;
    }

    relinka(
      "log",
      `\nSummary: ${successCount} files updated, ${errorCount} errors, ${warningCount} warnings`,
    );

    if (args.dryRun) {
      relinka("info", "\nThis was a dry run. No changes were made.");
      relinka("log", "Run without --dryRun to apply the changes.");
    } else {
      relinka("success", "\nMigration completed!");

      if (args.codemod === "path-pathkit") {
        relinka("log", "Next steps:");
        relinka("log", "1. Run 'bun install' to install @reliverse/pathkit");
        relinka("log", "2. Test your application");
        relinka(
          "log",
          "3. Tip: Consider using advanced pathkit features like alias resolution",
        );
      } else if (args.codemod === "fs-relifso") {
        relinka("log", "Next steps:");
        relinka("log", "1. Run 'bun install' to install @reliverse/relifso");
        relinka("log", "2. Test your application");
        relinka(
          "log",
          "3. Review any file system operations that might need manual updates",
        );
      } else if (args.codemod === "nodenext-bundler") {
        relinka("log", "Next steps:");
        relinka("log", "1. Test your application");
        if (args.mrTarget === "nodenext") {
          relinka(
            "log",
            "2. Ensure your build tools support .js extensions in imports",
          );
        } else if (args.mrTarget === "bundler") {
          relinka("log", "2. Ensure your bundler is configured correctly");
        }
        if (warningCount > 0) {
          relinka(
            "warn",
            "3. ⚠️  Review files with warnings - they may need manual updates",
          );
        }
      } else if (args.codemod === "readdir-glob") {
        relinka("log", "Next steps:");
        relinka("log", "1. Run 'bun install' to install globby");
        relinka("log", "2. Test your application");
        relinka(
          "log",
          "3. Review any file system operations that might need manual updates",
        );
      }
    }
  },
});
