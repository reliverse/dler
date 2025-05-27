import { defineArgs, defineCommand } from "@reliverse/rempts";

import {
  migratePatheToPathkit,
  migratePathkitToPathe,
} from "./codemods/lib-pathe-pathkit";
import { migrateModuleResolution } from "./codemods/ts-module-resolution";

export default defineCommand({
  meta: {
    name: "migrate",
    version: "1.0.0",
    description: "Migrate between different libraries and usages",
  },
  args: defineArgs({
    lib: {
      type: "string",
      description:
        "The migration to perform (pathe-to-pathkit | pathkit-to-pathe | module-resolution)",
    },
    target: {
      type: "string",
      description:
        "Target for module resolution migration (nodenext | bundler)",
      default: "nodenext",
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without applying them",
      default: false,
    },
  }),
  async run({ args }) {
    let results: any[] = [];

    if (args.lib === "pathe-to-pathkit") {
      console.log("Migrating from pathe to pathkit...");
      results = await migratePatheToPathkit(args.dryRun);
    } else if (args.lib === "pathkit-to-pathe") {
      console.log("Migrating from pathkit to pathe...");
      results = await migratePathkitToPathe(args.dryRun);
    } else if (args.lib === "module-resolution") {
      if (!["nodenext", "bundler"].includes(args.target)) {
        console.error(`Invalid target: ${args.target}`);
        console.log("Available targets:");
        console.log("  - nodenext");
        console.log("  - bundler");
        return;
      }
      console.log(`Migrating to ${args.target} module resolution...`);
      results = await migrateModuleResolution(
        args.target as "nodenext" | "bundler",
        args.dryRun,
      );
    } else {
      console.error(`Unknown migration: ${args.lib}`);
      console.log("Available migrations:");
      console.log("  - pathe-to-pathkit");
      console.log("  - pathkit-to-pathe");
      console.log("  - module-resolution");
      return;
    }

    // print results
    console.log("\nMigration Results:");
    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      console.log(`${status} ${result.file}: ${result.message}`);

      if (result.changes && result.changes.length > 0) {
        for (const change of result.changes) {
          if (change.startsWith("⚠️")) {
            console.log(`    ${change}`);
            warningCount++;
          } else {
            console.log(`    - ${change}`);
          }
        }
      }

      if (result.success) successCount++;
      else errorCount++;
    }

    console.log(
      `\nSummary: ${successCount} files updated, ${errorCount} errors, ${warningCount} warnings`,
    );

    if (args.dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("Run without --dryRun to apply the changes.");
    } else {
      console.log("\nMigration completed!");

      if (args.lib === "pathe-to-pathkit") {
        console.log("Next steps:");
        console.log("1. Run 'bun install' to install @reliverse/pathkit");
        console.log("2. Test your application");
        console.log(
          "3. Consider using advanced pathkit features like alias resolution",
        );
      } else if (args.lib === "pathkit-to-pathe") {
        console.log("Next steps:");
        console.log("1. Run 'bun install' to install pathe");
        console.log("2. Test your application");
        if (warningCount > 0) {
          console.log(
            "3. ⚠️  Review files with warnings - they may need manual updates",
          );
        }
      } else if (args.lib === "module-resolution") {
        console.log("Next steps:");
        console.log("1. Test your application");
        if (args.target === "nodenext") {
          console.log(
            "2. Ensure your build tools support .js extensions in imports",
          );
        } else if (args.target === "bundler") {
          console.log("2. Ensure your bundler is configured correctly");
        }
        if (warningCount > 0) {
          console.log(
            "3. ⚠️  Review files with warnings - they may need manual updates",
          );
        }
      }
    }
  },
});
