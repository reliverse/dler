// todo: maybe deprecated

import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";
import path from "pathe";

import { printUsage, useAggregator } from "./tools-impl.js";

const TOOLS = ["agg"];

export default defineCommand({
  meta: {
    name: "tools",
    version: "1.2.0",
    description: `Runs selected dler tool. Available tools: ${TOOLS.join(", ")}`,
  },
  args: {
    dev: {
      description: "Run in development mode",
      type: "boolean",
    },
    import: {
      description: "If true, produce import lines instead of export lines",
      type: "boolean",
    },
    input: {
      description: "Directory containing .ts/.js files",
      type: "string",
    },
    named: {
      description:
        "Parse each file for named exports (function/class/const/let)",
      type: "boolean",
    },
    out: {
      description: "Output aggregator file path",
      type: "string",
    },
    recursive: {
      description: "Recursively scan subdirectories (default false)",
      type: "boolean",
    },
    strip: {
      description: "Remove this path prefix from final imports/exports",
      type: "string",
    },
    tool: {
      description: "Tool to run",
      type: "string",
    },
  },
  async run({ args }) {
    const isDev = args.dev;

    // if (isDev) {
    //   relinka("info", "[dler debug] Running in dev mode:", raw);
    //   relinka("info", "[dler debug] args:", args);
    //   relinka("info", "[dler debug] raw args:", raw);
    // }

    if (!args.tool) {
      relinka("error", "Missing required param: --tool <toolName>");
      printUsage(isDev);
      process.exit(1);
    }
    if (!TOOLS.includes(args.tool)) {
      relinka("error", `Error: Invalid tool: ${args.tool}`);
      relinka("info", `Available tools: ${TOOLS.join(", ")}`);
      printUsage(isDev);
      process.exit(1);
    }

    if (args.tool === "agg") {
      if (!args.input) {
        relinka("error", "Missing required param: --input <directory>");
        printUsage(isDev);
        process.exit(1);
      }
      if (!args.out) {
        relinka("error", "Missing required param: --out <fileName>");
        printUsage(isDev);
        process.exit(1);
      }
      await useAggregator({
        inputDir: path.resolve(args.input),
        isRecursive: !!args.recursive,
        outFile: path.resolve(args.out),
        stripPrefix: args.strip ? path.resolve(args.strip) : "",
        useImport: !!args.import,
        useNamed: !!args.named,
      });
    }

    process.exit(0);
  },
});
