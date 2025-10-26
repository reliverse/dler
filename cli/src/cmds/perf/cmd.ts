// apps/dler/src/cmds/perf/cmd.ts

// Examples:
// # Command benchmarking
//   dler perf --target "node --version" --runs 10 --warmup 2
//   bun dler perf --runs 10 --warmup 2 --target "node --version"
// # Monorepo analysis
//   dler perf --type monorepo --verbose
// # File system profiling
//   dler perf --target ./src --type file --verbose
// # JSON output
//   dler perf --target "node --version" --output json
// # Baseline comparison
//   dler perf build --save
//   dler perf build --compare

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { runPerfAnalysis } from "./impl";
import { createConsoleReporter } from "./reporters/console";
import { createHtmlReporter } from "./reporters/html";
import { createJsonReporter } from "./reporters/json";
import type { PerfAnalysisType, PerfOptions, PerfOutputFormat } from "./types";

const perfCmd = async (args: PerfOptions): Promise<void> => {
  try {
    // Check if running in Bun
    if (typeof process.versions.bun === "undefined") {
      logger.error("❌ This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    // Validate type parameter
    const validTypes: PerfAnalysisType[] = [
      "command",
      "bundle",
      "file",
      "monorepo",
      "auto",
    ];
    if (args.type && !validTypes.includes(args.type as PerfAnalysisType)) {
      logger.error(
        `❌ Invalid type: ${args.type}. Must be one of: ${validTypes.join(", ")}`,
      );
      process.exit(1);
    }

    // Validate output parameter
    const validOutputs: PerfOutputFormat[] = ["console", "json", "html", "all"];
    if (
      args.output &&
      !validOutputs.includes(args.output as PerfOutputFormat)
    ) {
      logger.error(
        `❌ Invalid output format: ${args.output}. Must be one of: ${validOutputs.join(", ")}`,
      );
      process.exit(1);
    }

    // Run performance analysis
    const result = await runPerfAnalysis(args);

    if (!result.success) {
      logger.error(`❌ Performance analysis failed: ${result.error}`);
      process.exit(1);
    }

    // Generate reports based on output format
    const outputFormats: PerfOutputFormat[] =
      args.output === "all"
        ? ["console", "json", "html"]
        : [(args.output as PerfOutputFormat) ?? "console"];

    for (const format of outputFormats) {
      switch (format) {
        case "console": {
          const consoleReporter = createConsoleReporter(args.verbose);
          consoleReporter.report(result.report);
          break;
        }

        case "json": {
          const jsonReporter = createJsonReporter();
          jsonReporter.report(result.report);
          break;
        }

        case "html": {
          const htmlReporter = createHtmlReporter();
          htmlReporter.report(result.report);
          break;
        }
      }
    }

    logger.success("\n✅ Performance analysis completed successfully!");
  } catch (error) {
    logger.error("\n❌ Performance analysis failed:");

    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }

    process.exit(1);
  }
};

const perfCmdArgs = defineCmdArgs({
  target: {
    type: "string",
    description: "What to measure (command name, file path, or directory)",
  },
  type: {
    type: "string",
    description:
      "Type of analysis: command, bundle, file, monorepo, or auto (default: auto)",
  },
  runs: {
    type: "number",
    description: "Number of benchmark iterations (default: 10)",
  },
  warmup: {
    type: "number",
    description: "Warmup runs before measurement (default: 2)",
  },
  concurrency: {
    type: "number",
    description: "For parallel benchmarks (default: 1)",
  },
  compare: {
    type: "boolean",
    description: "Compare with cached baseline (default: false)",
  },
  output: {
    type: "string",
    description:
      "Output format: console, json, html, or all (default: console)",
  },
  save: {
    type: "boolean",
    description: "Save results as baseline (default: false)",
  },
  verbose: {
    type: "boolean",
    description: "Detailed output (default: false)",
  },
  cwd: {
    type: "string",
    description: "Working directory (default: current directory)",
  },
  ignore: {
    type: "string",
    description:
      "Packages to ignore for monorepo analysis (supports wildcards like @reliverse/*)",
  },
});

const perfCmdCfg = defineCmdCfg({
  name: "perf",
  description:
    "Comprehensive performance measurement and analysis tool. Benchmarks commands, analyzes bundles, profiles files/directories, and identifies monorepo bottlenecks.",
  examples: [
    "# Command Benchmarking:",
    "dler perf build",
    'dler perf "bun dler tsc"',
    'dler perf "node --version"',
    "dler perf build --runs 20 --warmup 5",
    "dler perf build --concurrency 4 --verbose",
    "dler perf build --compare --save",
    "",
    "# Bundle Analysis:",
    "dler perf ./dist --type bundle",
    "dler perf ./build --type bundle",
    "dler perf ./dist --type bundle --verbose",
    "",
    "# File System Profiling:",
    "dler perf ./src --type file",
    "dler perf ./packages --type file",
    "dler perf ./src --type file --verbose",
    "",
    "# Monorepo Analysis:",
    "dler perf --type monorepo",
    "dler perf --type monorepo --ignore '@reliverse/*'",
    "dler perf --type monorepo --verbose",
    "",
    "# Auto-detection:",
    "dler perf build                    # Auto-detects as command",
    "dler perf ./dist                   # Auto-detects as bundle",
    "dler perf ./src                    # Auto-detects as file system",
    "dler perf                          # Auto-detects as monorepo",
    "",
    "# Output Formats:",
    "dler perf build --output json",
    "dler perf build --output html",
    "dler perf build --output all",
    "",
    "# Baseline Comparison:",
    "dler perf build --save             # Save current as baseline",
    "dler perf build --compare          # Compare with baseline",
    "dler perf build --compare --save   # Compare and update baseline",
    "",
    "# Advanced Examples:",
    "dler perf 'bun dler tsc' --runs 50 --warmup 10 --concurrency 2",
    "dler perf ./dist --type bundle --output html --verbose",
    "dler perf --type monorepo --ignore '@reliverse/*' --output json",
    "dler perf build --runs 100 --compare --save --output all",
    "",
    "# Performance Monitoring:",
    "dler perf build --runs 10 --save  # Establish baseline",
    "dler perf build --compare         # Check for regressions",
    "dler perf build --runs 20 --compare --save  # Update baseline",
    "",
    "# Analysis Types:",
    "dler perf --type command <cmd>    # Benchmark command execution",
    "dler perf --type bundle <path>    # Analyze bundle size and structure",
    "dler perf --type file <path>      # Profile file system usage",
    "dler perf --type monorepo         # Analyze monorepo dependencies",
    "dler perf --type auto <target>    # Auto-detect analysis type",
    "",
    "# Command Examples:",
    "dler perf 'dler build'",
    "dler perf 'bun dler tsc --verbose'",
    "dler perf 'node --version'",
    "dler perf 'npm run build'",
    "dler perf 'yarn test'",
    "",
    "# Bundle Analysis Examples:",
    "dler perf ./dist --type bundle",
    "dler perf ./build --type bundle",
    "dler perf ./out --type bundle",
    "dler perf ./lib --type bundle",
    "",
    "# File System Examples:",
    "dler perf ./src --type file",
    "dler perf ./packages --type file",
    "dler perf ./apps --type file",
    "dler perf ./examples --type file",
    "",
    "# Monorepo Examples:",
    "dler perf --type monorepo",
    "dler perf --type monorepo --cwd /path/to/monorepo",
    "dler perf --type monorepo --ignore '@reliverse/*'",
    "dler perf --type monorepo --ignore '@reliverse/* @company/*'",
    "",
    "# Output Examples:",
    "dler perf build --output console  # Console output (default)",
    "dler perf build --output json     # JSON output",
    "dler perf build --output html     # HTML report",
    "dler perf build --output all      # All formats",
    "",
    "# Baseline Management:",
    "dler perf build --save            # Save current run as baseline",
    "dler perf build --compare         # Compare with saved baseline",
    "dler perf build --compare --save  # Compare and update baseline",
    "",
    "# Verbose Output:",
    "dler perf build --verbose         # Show detailed progress",
    "dler perf ./dist --type bundle --verbose",
    "dler perf --type monorepo --verbose",
    "",
    "# Concurrency Control:",
    "dler perf build --concurrency 1   # Sequential execution",
    "dler perf build --concurrency 4   # Parallel execution",
    "dler perf build --concurrency 8   # High parallelism",
    "",
    "# Iteration Control:",
    "dler perf build --runs 5          # Few iterations (faster)",
    "dler perf build --runs 50         # Many iterations (more accurate)",
    "dler perf build --warmup 0        # No warmup",
    "dler perf build --warmup 10       # More warmup runs",
    "",
    "# Working Directory:",
    "dler perf build --cwd /path/to/project",
    "dler perf ./dist --type bundle --cwd /path/to/project",
    "dler perf --type monorepo --cwd /path/to/monorepo",
  ],
});

export default defineCmd(perfCmd, perfCmdArgs, perfCmdCfg);
