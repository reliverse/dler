import { defineCommand } from "@reliverse/rempts";

import { resolveAllCrossLibs } from "~/libs/sdk/sdk-impl/utils/resolve-cross-libs";

export default defineCommand({
  async run() {
    await resolveAllCrossLibs();
  },
});
