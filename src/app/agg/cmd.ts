import { defineArgs, defineCommand } from "@reliverse/rempts";
import path from "pathe";

import { useAggregator } from "./impl.js";

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
      description: "Recursively scan subdirectories (default false)",
      type: "boolean",
      default: true,
    },
    strip: {
      description: "Remove specified path prefix from final imports/exports",
      type: "string",
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
    });
  },
});
