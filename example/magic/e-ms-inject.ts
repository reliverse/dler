// e-ms-inject.ts (transform-impl-mod.ts → inject-impl-mod.ts → e-ms-inject.ts) // 👉 `bun magic:example`

import { confirmPrompt } from "@reliverse/rempts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  injectAtLocation,
  injectMultiple,
  type SingleInjection,
} from "~/libs/sdk/sdk-impl/cmds/inject/inject-impl-mod";
import * as ms from "~/libs/sdk/sdk-impl/magic/ms-apply";
import * as spells from "~/libs/sdk/sdk-impl/magic/ms-spells";

type Mode = "get-info-only" | "apply-spells" | "inject-example-spells" | "revert-example-spells";

const MODE_TO_TEST = "apply-spells" as Mode;

const CURRENT_FILE_NAME = fileURLToPath(import.meta.url);
const DIR_PATH_TO_PROCESS = dirname(CURRENT_FILE_NAME);
const FILE_PATH_TO_PROCESS = resolve(DIR_PATH_TO_PROCESS, "e-ms-inject.ts");

const INJECTIONS = [
  {
    filePath: FILE_PATH_TO_PROCESS,
    location: { line: 60 }, // `dler-remove-comment` will be added to the end of the `const result = await ms.applyMagicSpells([DIR_PATH_TO_PROCESS]);` line (because `column` is not specified)
    content: " // <dler-remove-comment>", // <dler-ignore-this-line>
  },
  {
    filePath: FILE_PATH_TO_PROCESS,
    location: { line: 166 },
    content: "// it works 🎉",
  },
  {
    filePath: FILE_PATH_TO_PROCESS,
    location: { line: 166 },
    content: " // <dler-remove-line>", // <dler-ignore-this-line>
  },
  {
    filePath: FILE_PATH_TO_PROCESS,
    location: { line: 165 },
    content: "\nconsole.log('This line WILL BE replaced by magic spell!');",
  },
  {
    filePath: FILE_PATH_TO_PROCESS,
    location: { line: 166 }, // auto-offset is applied here (because `\n` is used in the previous element of array)
    content: " // <dler-replace-line-to `console.log('This line WAS replaced by magic spell!');`>", // <dler-ignore-this-line>
  },
] satisfies SingleInjection[];

async function main({
  showAvailableSpells,
  mode,
}: {
  showAvailableSpells: boolean;
  mode: Mode;
}) {
  if (mode === "get-info-only") {
    if (showAvailableSpells) {
      console.log("Available spells:", spells.getAvailableSpells()); // <dler-remove-comment>
    }

    // Scan for files with magic spells and show their line numbers
    try {
      const filesWithSpells = await ms.getFilesWithMagicSpells([DIR_PATH_TO_PROCESS], {
        stopOnError: false,
        excludeSpellImplementation: true,
      });

      if (filesWithSpells.length === 0) {
        console.log("No files with magic spells found in:", DIR_PATH_TO_PROCESS);
      } else {
        console.log(`Found ${filesWithSpells.length} file(s) with magic spells:`);
        for (const file of filesWithSpells) {
          const relativePath = file.path.replace(process.cwd(), "").replace(/^[/\\]/, "");
          console.log(`  📄 ${relativePath}`);
          console.log(`    Lines with spells: ${file.spellLines.join(", ")}`);
        }
      }
    } catch (error) {
      console.error("Error scanning for magic spells:", error);
    }
  } else if (mode === "apply-spells") {
    try {
      const result = await ms.applyMagicSpells([DIR_PATH_TO_PROCESS]);
      console.log("Magic spells applied successfully:", result);

      // prompt #1
      const shouldCleanup = await confirmPrompt({
        title: "Delete the following line? (RECOMMENDED)",
        content: "`console.log('This line WAS replaced by magic spell!');`",
        defaultValue: true,
      });
      if (shouldCleanup) {
        // Example of how to inject a single string
        await injectAtLocation(
          {
            filePath: FILE_PATH_TO_PROCESS,
            location: { line: 166 }, // Line with the `console.log('This line WAS replaced by magic spell!');` to remove
            content: " // <dler-remove-line>", // <dler-ignore-this-line>
          },
          { logCode: false },
        );

        // Example of how to apply the magic directive programmatically on a single file
        // Using processSingleOutputFile to apply the magic directive and remove the line
        const wasProcessed = await ms.processSingleOutputFile(FILE_PATH_TO_PROCESS, {
          copyFileWithDirectivesFromSrcBeforeProcessing: false,
        });
        console.log("Line removed using magic directive:", wasProcessed);
      }

      // prompt #2
      const shouldRevert = await confirmPrompt({
        title: "Magic spells applied successfully!",
        content: "Do you want to revert the changes?",
      });
      if (shouldRevert) {
        try {
          const results = await injectMultiple(INJECTIONS, { logCode: false });
          console.log("Injection results:", results);
          // Check for any failures
          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            console.error("Some injections failed:", failures);
          }
        } catch (error) {
          console.error("Error during injection:", error);
        }
      }
    } catch (error) {
      console.error("Error applying magic spells:", error);
    }
  } else if (mode === "inject-example-spells") {
    try {
      const results = await injectMultiple(INJECTIONS, { logCode: false });
      console.log("Injection results:", results);
      // Check for any failures
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        console.error("Some injections failed:", failures);
      }
    } catch (error) {
      console.error("Error during injection:", error);
    }
  } else if (mode === "revert-example-spells") {
    try {
      // TODO: fix `revert` in the future, it's currently reverts only the first injection (OR JUST ELIMINATE THIS FEATURE AND IMPLEMENT GREP IMPLEMENTATION+COMMAND WITH REMOVE TASK (e.g. grep(INJECTIONS, { removeFoundContent: true }), supports string and string[], tasks specified in {}) (PLUS: GREP TASKS SHOULD SUPPORT INJECT FUNCTIONALITY AS WELL))
      const results = await injectMultiple(INJECTIONS, { revert: true, logCode: false });
      console.log("Revert results:", results);
      // Check for any failures
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        console.error("Some reverts failed:", failures);
      }
    } catch (error) {
      console.error("Error during revert:", error);
    }
  }
}

main({
  showAvailableSpells: true,
  mode: MODE_TO_TEST,
});
console.log("This line WILL BE replaced by magic spell!"); // <dler-replace-line-to `console.log('This line WAS replaced by magic spell!');`>
// it works 🎉 // <dler-remove-line>
