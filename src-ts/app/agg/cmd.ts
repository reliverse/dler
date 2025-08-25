import path from "@reliverse/pathkit";
import { defineArgs, defineCommand, inputPrompt } from "@reliverse/rempts";

import { useAggregator } from "~/app/utils/agg/agg-2";

export default defineCommand({
  args: defineArgs({
    imports: {
      description: "If true, produce import lines instead of export lines",
      type: "boolean",
    },
    input: {
      description: "Directory containing .ts/.js files (--input <directory>)",
      type: "string",
    },
    named: {
      description: "Parse each file for named exports (function/class/const/let)",
      type: "boolean",
      default: true,
    },
    out: {
      description: "Output aggregator file path (--out <fileName>)",
      type: "string",
    },
    recursive: {
      description:
        "Recursively scan subdirectories (default true) (false means only scan the files in the current directory and not subdirectories)",
      type: "boolean",
      default: true,
    },
    strip: {
      description: "Remove specified path prefix from final imports/exports",
      type: "string",
    },
    sort: {
      description: "Sort aggregated lines alphabetically",
      type: "boolean",
    },
    header: {
      description: "Add a header comment to the aggregator output",
      type: "string",
    },
    verbose: {
      description: "Enable verbose logging",
      type: "boolean",
    },
    includeInternal: {
      description: "Include files marked as internal (starting with #)",
      type: "boolean",
    },
    internalMarker: {
      description: "Marker for internal files (default: #)",
      type: "string",
      default: "#",
    },
    override: {
      description: "Override entire file instead of updating only the aggregator block",
      type: "boolean",
    },
    extensions: {
      description:
        "Comma-separated list of file extensions to process (default: .ts,.js,.mts,.cts,.mjs,.cjs)",
      type: "string",
      default: ".ts,.js,.mts,.cts,.mjs,.cjs",
    },
    separateTypesFile: {
      description: "Create a separate file for type exports",
      type: "boolean",
    },
    typesOut: {
      description: "Output file path for types (used when separateTypesFile is true)",
      type: "string",
    },
    nonInteractive: {
      description: "Disable interactive prompts and require all arguments to be provided via flags",
      type: "boolean",
      default: false,
    },
  }),
  async run({ args }) {
    const resolvedArgs = { ...args };

    // Handle required arguments with prompts when nonInteractive is false
    if (!args.nonInteractive) {
      if (!args.input) {
        resolvedArgs.input = await inputPrompt({
          title: "Enter input directory containing .ts/.js files:",
          defaultValue: "",
        });
      }

      if (!args.out) {
        resolvedArgs.out = await inputPrompt({
          title: "Enter output aggregator file path:",
          defaultValue: "",
        });
      }

      if (args.separateTypesFile && !args.typesOut) {
        resolvedArgs.typesOut = await inputPrompt({
          title: "Enter output file path for types:",
          defaultValue: resolvedArgs.out.replace(/\.(ts|js)$/, ".types.$1"),
        });
      }
    } else {
      // Validate required arguments in non-interactive mode
      if (!args.input) {
        throw new Error("Missing required argument: --input");
      }
      if (!args.out) {
        throw new Error("Missing required argument: --out");
      }
      if (args.separateTypesFile && !args.typesOut) {
        throw new Error(
          "Missing required argument: --typesOut (required when --separateTypesFile is true)",
        );
      }
    }

    await useAggregator({
      inputDir: path.resolve(resolvedArgs.input),
      isRecursive: !!resolvedArgs.recursive,
      outFile: path.resolve(resolvedArgs.out),
      stripPrefix: resolvedArgs.strip ? path.resolve(resolvedArgs.strip) : "",
      useImport: !!resolvedArgs.imports,
      useNamed: !!resolvedArgs.named,
      sortLines: !!resolvedArgs.sort,
      headerComment: resolvedArgs.header || "",
      verbose: !!resolvedArgs.verbose,
      includeInternal: !!resolvedArgs.includeInternal,
      internalMarker: resolvedArgs.internalMarker,
      overrideFile: !!resolvedArgs.override,
      fileExtensions: resolvedArgs.extensions.split(",").map((ext) => ext.trim()),
      separateTypesFile: !!resolvedArgs.separateTypesFile,
      typesOutFile: resolvedArgs.typesOut ? path.resolve(resolvedArgs.typesOut) : undefined,
    });
  },
});
