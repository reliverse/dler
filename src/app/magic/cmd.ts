import { defineArgs, defineCommand } from "@reliverse/rempts";

import { applyMagicSpells } from "~/libs/sdk/sdk-impl/magic/ms-apply";
import { formatError } from "~/libs/sdk/sdk-impl/utils/utils-error-cwd";

export default defineCommand({
  meta: {
    name: "magic",
    version: "1.0.0",
    description: `Apply magic directives to files.

Target Types:
1. Distribution Targets (dist-*):
   - dist-npm: Process files in dist-npm/bin
   - dist-jsr: Process files in dist-jsr/bin
   - dist-libs: Process all libraries in dist-libs
   - dist-libs/<lib>: Process specific library (e.g., dist-libs/sdk)
   
   For dist-* targets, magic directives are first searched in src/ directory,
   then applied to corresponding files in the distribution directories.

2. Custom Targets:
   - Any directory name that is not dist-* (e.g., "my-output", "custom-build")
   
   For custom targets, magic directives are processed directly in the target files.
   No source directory scanning is performed.

Examples:
  # Process all distribution targets
  dler magic dist-npm dist-jsr dist-libs

  # Process specific library
  dler magic dist-libs/sdk

  # Process custom target
  dler magic my-custom-output

  # Mix distribution and custom targets
  dler magic dist-npm my-custom-output`,
  },
  args: defineArgs({
    targets: {
      type: "array",
      description: `Targets to process. Can be:
- Distribution targets: dist-npm, dist-jsr, dist-libs, dist-libs/<lib>
- Custom targets: any directory name that is not dist-*`,
      required: true,
    },
    lib: {
      type: "string",
      description: "Library name to process (e.g., sdk, cfg). Only valid with dist-libs target.",
    },
    concurrency: {
      type: "number",
      description: "Number of files to process in parallel (default: 4)",
      default: 4,
    },
    batchSize: {
      type: "number",
      description: "Number of files to process in each batch (default: 100)",
      default: 100,
    },
    stopOnError: {
      type: "boolean",
      description: "Stop processing on first error (default: true)",
      default: true,
    },
  }),

  async run({ args }) {
    const { targets, lib, concurrency, batchSize, stopOnError } = args;

    // Validate lib parameter
    if (lib) {
      if (!targets?.includes("dist-libs")) {
        throw new Error(
          "The 'lib' parameter can only be used with 'dist-libs' target. Example: dler magic dist-libs/sdk",
        );
      }
      if (targets.some((t: string) => t.startsWith("dist-libs/") && t !== `dist-libs/${lib}`)) {
        throw new Error(
          "Cannot specify both 'lib' parameter and dist-libs/<lib> in targets. Use one or the other.",
        );
      }
    }

    try {
      // Process targets
      const finalTargets =
        targets?.map((target: string) =>
          target === "dist-libs" && lib ? `${target}/${lib}` : target,
        ) ?? [];

      // Log what we're going to do
      const distTargets = finalTargets.filter((t: string) => t.startsWith("dist-"));
      const customTargets = finalTargets.filter((t: string) => !t.startsWith("dist-"));

      if (distTargets.length > 0) {
        console.log("\nProcessing distribution targets:");
        for (const target of distTargets) {
          console.log(`  - ${target} (will scan src/ for magic directives)`);
        }
      }

      if (customTargets.length > 0) {
        console.log("\nProcessing custom targets:");
        for (const target of customTargets) {
          console.log(`  - ${target} (will process magic directives directly in target files)`);
        }
      }

      // Apply magic spells
      await applyMagicSpells(finalTargets, {
        concurrency,
        batchSize,
        stopOnError,
      });

      console.log("\n✨ Magic spells applied successfully!");
    } catch (error) {
      throw new Error(`❌ Processing failed: ${formatError(error)}`);
    }
  },
});
