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
// await dler.spells({}) // all spells, all files
// spells: ["all"] // means all spells
// spells: [] // also means all spells
// files: [] // means all files
```
*/

// todo: migrate to @reliverse/rempts

/* import { Command } from "commander";

import type { SpellType } from "~/libs/sdk/sdk-impl/spell/spell-types.js";

import { spells } from "~/libs/sdk/sdk-impl/spell/spell-mod.js";

export const createCli = () => {
  const program = new Command();

  program
    .name("dler-spells")
    .description("Execute magic spells in your codebase")
    .version("1.0.0");

  program
    .command("trigger")
    .description("Trigger magic spells")
    .option(
      "--spells <spells>",
      'Comma-separated list of spells to execute (or "all")',
      "all",
    )
    .option(
      "--files <files>",
      "Comma-separated list of files to process (or all if not specified)",
    )
    .option("--dry-run", "Preview changes without applying them", false)
    .action(async (options) => {
      const requestedSpells = options.spells
        ? (options.spells.split(",") as (SpellType | "all")[])
        : ["all"];

      const files = options.files ? options.files.split(",") : [];

      console.log(`Triggering spells: ${requestedSpells.join(", ")}`);
      if (files.length) {
        console.log(`On files: ${files.join(", ")}`);
      } else {
        console.log("On all files");
      }

      if (options.dryRun) {
        console.log("DRY RUN - No changes will be applied");
      }
      const results = await spells({
        spells: requestedSpells as (SpellType | "all")[],
        files,
        dryRun: options.dryRun,
      });

      console.log("\nResults:");
      for (const result of results) {
        const status = result.success ? "✓" : "✗";
        console.log(
          `${status} ${result.file}: ${result.spell.type} - ${result.message}`,
        );
      }
    });

  return program;
};

const cli = createCli();
async function main() {
  cli.parse(process.argv);
}
await main();
 */
