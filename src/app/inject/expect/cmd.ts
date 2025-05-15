import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import { useTsExpectError } from "./impl.js";

export default defineCommand({
  meta: {
    name: "expect",
    version: "1.0.0",
    description: "Inject `@ts-expect-error` above lines where TS errors occur",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Run the CLI in dev mode",
    },
    files: {
      type: "positional",
      description: `'auto' or path(s) to line references file(s)`,
      default: "auto",
    },
    comment: {
      type: "string",
      description:
        "Override the comment line to insert. Default is `// @ts-expect-error TODO: fix ts`",
    },
    tscPaths: {
      type: "string",
      description:
        "Optional: specify path(s) to restrict TSC processing (only effective when using 'auto')",
    },
  }),
  async run({ args }) {
    if (args.dev) {
      relinka("verbose", "Using dev mode");
    }

    let pathsTsc = args.tscPaths;

    if (pathsTsc === undefined && args.files === "auto") {
      pathsTsc = "./tsconfig.json";
    }

    await useTsExpectError({
      files: [args.files],
      comment: args.comment,
      tscPaths: [pathsTsc],
    });
  },
});
