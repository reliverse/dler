// Using the dler spells SDK in your own CLI tool
import { defineCommand } from "@reliverse/rempts";

import { spells } from "~/libs/sdk/sdk-impl/spell/spell-mod.js";

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
