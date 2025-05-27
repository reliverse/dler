import path from "@reliverse/pathkit";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import { useAggregator } from "./impl";

export default defineCommand({
  args: defineArgs({
    dev: {
      description: "Run in development mode",
      type: "boolean",
    },
    imports: {
      description: "If true, produce import lines instead of export lines",
      type: "boolean",
    },
    input: {
      description: "Directory containing .ts/.js files (--input <directory>)",
      type: "string",
      required: true,
    },
    named: {
      description:
        "Parse each file for named exports (function/class/const/let)",
      type: "boolean",
      default: true,
    },
    out: {
      description: "Output aggregator file path (--out <fileName>)",
      type: "string",
      required: true,
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
      default: false,
    },
    header: {
      description: "Add a header comment to the aggregator output",
      type: "string",
    },
    verbose: {
      description: "Enable verbose logging",
      type: "boolean",
      default: false,
    },
    includeInternal: {
      description: "Include files marked as internal (starting with #)",
      type: "boolean",
      default: false,
    },
    internalMarker: {
      description: "Marker for internal files (default: #)",
      type: "string",
      default: "#",
    },
    override: {
      description:
        "Override entire file instead of updating only the aggregator block",
      type: "boolean",
      default: false,
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
      default: false,
    },
    typesOut: {
      description:
        "Output file path for types (used when separateTypesFile is true)",
      type: "string",
      required: false,
    },
  }),
  async run({ args }) {
    await useAggregator({
      inputDir: path.resolve(args.input),
      isRecursive: !!args.recursive,
      outFile: path.resolve(args.out),
      stripPrefix: args.strip ? path.resolve(args.strip) : "",
      useImport: !!args.imports,
      useNamed: !!args.named,
      sortLines: !!args.sort,
      headerComment: args.header || "",
      verbose: !!args.verbose,
      includeInternal: !!args.includeInternal,
      internalMarker: args.internalMarker,
      overrideFile: !!args.override,
      fileExtensions: args.extensions.split(",").map((ext) => ext.trim()),
      separateTypesFile: !!args.separateTypesFile,
      typesOutFile: args.typesOut ? path.resolve(args.typesOut) : undefined,
    });
  },
});
