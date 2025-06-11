import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { injectMultiple } from "~/libs/sdk/sdk-impl/cmds/inject/inject-impl-mod";
import * as ms from "~/libs/sdk/sdk-impl/magic/ms-apply";
import * as spells from "~/libs/sdk/sdk-impl/magic/ms-spells";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main({
  showAvailableSpells,
  mode,
}: {
  showAvailableSpells: boolean;
  mode: "get-info-only" | "apply-spells" | "inject-example-spells";
}) {
  if (mode === "get-info-only") {
    if (showAvailableSpells) {
      console.log("Available spells:", spells.getAvailableSpells());
    }
    console.log(await ms.getFilesWithMagicSpells(["e-magic"]));
  } else if (mode === "inject-example-spells") {
    const currentFilePath = resolve(__dirname, "ms-mod.ts");

    try {
      const results = await injectMultiple([
        {
          filePath: currentFilePath,
          line: 20,
          content: "<dler-remove-comment>",
          commentsMode: { activate: true },
        },
        {
          filePath: currentFilePath,
          line: 20, // means we place content at the new 21st line
          column: 7,
          content: "console.log('This line will be removed!');",
          // `content` will be placed on a new line AFTER the target line
          // in result `content` will be placed at the 16th line, 7th column
          createNewLine: false,
        },
        //   {
        //     filePath: "e-magic/ms-mod.ts",
        //     line: 15,
        //     content: "<dler-remove-line>",
        //   },
        //   {
        //     filePath: "e-magic/ms-mod.ts",
        //     line: 58,
        //     content: "console.log('This line will be replaced!');",
        //     createNewLine: true,
        //   },
        //   {
        //     filePath: "e-magic/ms-mod.ts",
        //     line: 58,
        //     content: "<dler-replace-line-to `console.log('This line was replaced!');`>",
        //   },
      ]);

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
}

main({
  showAvailableSpells: false,
  mode: "inject-example-spells",
});
