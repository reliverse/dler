import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  meta: {
    name: "init",
    version: "1.0.0",
    description: "Initialize a new project",
  },
  async run() {
    relinka.verbose(
      "Command not implemented yet. For now, please install `@reliverse/rse` and run `rse cli`.",
    );
  },
});
