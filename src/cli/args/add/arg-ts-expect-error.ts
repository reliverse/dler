import { defineCommand } from "@reliverse/prompts";
import { relinka } from "@reliverse/prompts";
import { useTsExpectError } from "~/libs/sdk/sdk-impl/ts-expect-error.js";

export default defineCommand({
  meta: {
    name: "tee",
    description: "Inject `@ts-expect-error` above lines where TS errors occur",
  },
  args: {
    dev: {
      type: "boolean",
      description: "Run the CLI in dev mode",
    },
    files: {
      type: "positional",
      // array: true, // TODO: implement in dler
      required: true,
      description: `'auto' or path(s) to line references file(s)`,
    },
    comment: {
      type: "string",
      required: false,
      description:
        "Override the comment line to insert. Default is `// @ts-expect-error TODO: fix ts`",
    },
    tscPaths: {
      type: "string",
      // array: true,
      required: false,
      description:
        "Optional: specify path(s) to restrict TSC processing (only effective when using 'auto')",
    },
  },
  run: async ({ args }) => {
    if (args.dev) {
      relinka("log-verbose", "Using dev mode");
    }

    await useTsExpectError({
      files: [args.files],
      comment: args.comment,
      tscPaths: [args.tscPaths],
    });

    process.exit(0);
  },
});
