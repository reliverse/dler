import { defineArgs, defineCommand } from "@reliverse/rempts";

import { applyMagicSpells } from "~/libs/sdk/sdk-impl/spell/applyMagicSpells";
import { formatError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";

export default defineCommand({
  args: defineArgs({
    targets: {
      type: "array",
      description: "Distribution types to process",
      required: true,
    },
    lib: {
      type: "string",
      description: "Library to process (e.g. cfg, sdk, etc) (for usage with `dist-libs`)",
    },
    concurrency: {
      type: "number",
      description: "Number of files to process in parallel",
    },
    batchSize: {
      type: "number",
      description: "Number of files to process in each batch",
    },
    stopOnError: {
      type: "boolean",
      description: "Stop processing on first error",
      default: true,
    },
  }),

  async run({ args }) {
    const { targets, lib, concurrency, batchSize, stopOnError } = args;

    if (lib && !targets?.includes("dist-libs")) {
      throw new Error("The 'lib' parameter can only be used with 'dist-libs' target");
    }

    try {
      const finalTargets =
        targets?.map((target: string) =>
          target === "dist-libs" && lib ? `${target}/${lib}` : target,
        ) ?? [];

      await applyMagicSpells(finalTargets, {
        concurrency,
        batchSize,
        stopOnError,
      });
    } catch (error) {
      throw new Error(`❌ Processing failed: ${formatError(error)}`);
    }
  },
});
