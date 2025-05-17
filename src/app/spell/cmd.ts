import { defineArgs, defineCommand } from "@reliverse/rempts";

import type { SpellType } from "~/libs/sdk/sdk-impl/spell/spell-types.js";

import { spells } from "~/libs/sdk/sdk-impl/spell/spell-mod.js";

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
      description:
        "Comma-separated list of files to process (or all if not specified)",
      default: "",
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without applying them",
      default: false,
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
      console.log(
        `${status} ${result.file}: ${result.spell.type} - ${result.message}`,
      );
    }
  },
});

/*
**usage examples:**

- `export * from "../../types.js"; // <dler-replace-line-{hooked=false}>` — injects file contents at this line
- `// @ts-expect-error <dler-remove-comment-{hooked=false}>` — removes just this comment
- `// <dler-remove-line-{hooked=false}>` — removes this line
- `// <dler-remove-file-{hooked=false}>` — deletes this file
- `// <dler-rename-file-"tsconfig.json"-{hooked=false}>` — renames this file (runs at postbuild because `hooked=false`)

**using `hooked=true`:**

- `// <dler-rename-file-"tsconfig.json"-{hooked=true}>` — renames the file, but only when you trigger it yourself (hooked from your side)

**triggering spells:**

from dler’s cli:  

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
