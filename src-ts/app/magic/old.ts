// todo: migrate to new applyMagicSpells implementation (current status: see cmd.ts)

/* import { defineArgs, defineCommand } from "@reliverse/rempts";

import type { SpellType } from "~/app/spell/spell-types";

import { spells } from "~/app/spell/spell-mod";

export default defineCommand({
  meta: {
    name: "spells",
    version: "1.0.0",
    description: "Execute magic spells in your codebase",
  },
  args: defineArgs({
    spells: {
      type: "string",
      description: "Comma-separated list of spells to execute (or 'all')",
      default: "all",
    },
    files: {
      type: "string",
      description: "Comma-separated list of files to process (or all if not specified)",
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without applying them",
    },
  }),
  async run({ args }) {
    const requestedSpells = args.spells
      ? (args.spells.split(",") as (SpellType | "all")[])
      : ["all"];

    const files = args.files ? args.files.split(",") : [];

    console.log(`Triggering spells: ${requestedSpells.join(", ")}`);
    if (files.length) {
      console.log(`On files: ${files.join(", ")}`);
    } else {
      console.log("On all files");
    }

    if (args.dryRun) {
      console.log("DRY RUN - No changes will be applied");
    }
    const results = await spells({
      spells: requestedSpells as (SpellType | "all")[],
      files,
      dryRun: args.dryRun,
    });

    console.log("\nResults:");
    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      console.log(`${status} ${result.file}: ${result.spell.type} - ${result.message}`);
    }
  },
}); */

/*
**usage examples:**

- `export * from "../../types"; // dler-replace-line` — injects file contents at this line (hooked=true by default)
- `// @ts-expect-error dler-remove-comment` — removes just this comment (hooked=true by default)
- `// dler-remove-line` — removes this line (hooked=true by default)
- `// dler-remove-file` — deletes this file (hooked=true by default)
- `// dler-rename-file-"tsconfig.json"-{hooked=false}` — renames this file (runs at postbuild because `hooked=false`)

**using `hooked=false`:**

- `// dler-rename-file-"tsconfig.json"-{hooked=false}` — renames the file immediately at postbuild (not hooked)

**triggering spells:**

from dler's cli:  

- `dler spells --trigger rename-file,... --files tsconfig.json,...`
- `dler spells --trigger all`
- `dler spells`

from your own code:

```ts
await dler.spells({ spells: ["rename-file"], files: [] });
await dler.spells({}) // all spells, all files
spells: ["all"] // means all spells
spells: [] // also means all spells
files: [] // means all files
```
*/

/* // Using the dler spells SDK in your own CLI tool
import { defineCommand } from "@reliverse/rempts";

import { spells } from "~/app/spell/spell-mod";

export default defineCommand({
  async run() {
    // Run all spells on all files
    const results = await spells();

    // Run specific spells on specific files
    const specificResults = await spells({
      spells: ["rename-file", "replace-line"],
      files: ["src/index.ts", "src/types.ts"],
    });

    // Dry run to preview changes
    const dryRunResults = await spells({
      dryRun: true,
    });

    console.log("[dler] Spell execution complete!");
    console.log(results);
    console.log(specificResults);
    console.log(dryRunResults);
  },
});
 */
