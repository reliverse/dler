import { defineCommand } from "@reliverse/prompts";
import path from "pathe";
import { useAggregator } from "./libs/sdk/sdk-impl/utils/tools/tools-agg.js";
import { relinka } from "./libs/sdk/sdk-impl/utils/utils-logs.js";

const TOOLS = ["agg"];

export default defineCommand({
  meta: {
    name: "tools",
    description: `Runs selected Relidler feature. Available tools: ${TOOLS.join(", ")}`,
  },
  args: {
    dev: {
      type: "boolean",
      description: "Run in development mode",
    },
    tool: {
      type: "string",
      description: "Tool to run",
      required: true,
    },
    input: {
      type: "string",
      description: "Directory containing .ts/.js files",
      required: true,
    },
    out: {
      type: "string",
      description: "Output aggregator file path",
      required: true,
    },
    strip: {
      type: "string",
      description: "Remove this path prefix from final imports/exports",
    },
    recursive: {
      type: "boolean",
      description: "Recursively scan subdirectories (default false)",
    },
    named: {
      type: "boolean",
      description:
        "Parse each file for named exports (function/const/let/class)",
    },
    import: {
      type: "boolean",
      description: "If true, produce import lines instead of export lines",
    },
  },

  run: async ({ args }) => {
    const isDev = args.dev;

    if (!TOOLS.includes(args.tool)) {
      relinka("error", `Error: Invalid tool: ${args.tool}`);
      relinka("info", `Available tools: ${TOOLS.join(", ")}`);
      relinka("info", "\nUsage: relidler tools <tool> [options]");
      relinka("info", "\nTools usage examples:");
      if (isDev) {
        relinka(
          "info",
          "bun dev:tools agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-main.ts --recursive --strip src/libs",
        );
      } else {
        relinka(
          "info",
          "relidler tools agg --input src/libs --out aggregator.ts --recursive",
        );
      }
      process.exit(1);
    }

    if (args.tool === "agg") {
      await useAggregator({
        inputDir: path.resolve(args.input),
        outFile: path.resolve(args.out),
        stripPrefix: args.strip ? path.resolve(args.strip) : "",
        isRecursive: !!args.recursive,
        useNamed: !!args.named,
        useImport: !!args.import,
      });
    }

    process.exit(0);
  },
});
