import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";

import { resolveCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";

export default defineCommand({
  async run() {
    const changed = await resolveCrossLibs();
    relinka("verbose", `changed files: ${changed.join(", ")}`);
  },
});
