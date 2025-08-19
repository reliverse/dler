import { defineCommand } from "@reliverse/rempts";

import { resolveAllCrossLibs } from "~/impl/utils/resolve-cross-libs";

export default defineCommand({
  async run() {
    await resolveAllCrossLibs("package", "~", ["npm", "jsr"], ["ts", "js"], "templates");
  },
});
