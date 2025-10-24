// packages/launcher/bench/performance.ts

import { performance } from "node:perf_hooks";
import { runLauncher } from "../src/mod";

interface BenchmarkResult {
  operation: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  iterations: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  private measureMemory(): NodeJS.MemoryUsage {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  }

  private async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    iterations = 1,
  ): Promise<T> {
    const startMemory = this.measureMemory();
    const startTime = performance.now();

    let result: T;
    for (let i = 0; i < iterations; i++) {
      result = await fn();
    }

    const endTime = performance.now();
    const endMemory = this.measureMemory();

    this.results.push({
      operation,
      duration: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      iterations,
    });

    return result!;
  }

  async benchmarkStartup(): Promise<void> {
    console.log("🚀 Benchmarking CLI Launcher Startup Performance\n");

    // Test cold start (no cache)
    console.log("Testing cold start (no cache)...");
    await this.measureOperation("cold-start", async () => {
      // Clear any existing cache
      const { clearMetadataCache } = await import("../src/impl/cache");
      clearMetadataCache();

      // Mock process.argv for testing
      const originalArgv = process.argv;
      process.argv = ["node", "test", "--help"];

      try {
        await runLauncher(import.meta.url, { cmdsDir: "../test-cmds" });
      } finally {
        process.argv = originalArgv;
      }
    });

    // Test warm start (with cache)
    console.log("Testing warm start (with cache)...");
    await this.measureOperation(
      "warm-start",
      async () => {
        const originalArgv = process.argv;
        process.argv = ["node", "test", "--help"];

        try {
          await runLauncher(import.meta.url, { cmdsDir: "../test-cmds" });
        } finally {
          process.argv = originalArgv;
        }
      },
      5,
    );

    // Test command execution
    console.log("Testing command execution...");
    await this.measureOperation(
      "command-execution",
      async () => {
        const originalArgv = process.argv;
        process.argv = ["node", "test", "test-command", "--verbose"];

        try {
          await runLauncher(import.meta.url, { cmdsDir: "../test-cmds" });
        } finally {
          process.argv = originalArgv;
        }
      },
      10,
    );

    this.printResults();
  }

  private printResults(): void {
    console.log("\n📊 Benchmark Results\n");
    console.log(
      "┌─────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐",
    );
    console.log(
      "│ Operation           │ Duration    │ Memory RSS  │ Heap Used   │ Iterations  │",
    );
    console.log(
      "├─────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤",
    );

    for (const result of this.results) {
      const duration = `${result.duration.toFixed(2)}ms`;
      const memoryRSS = `${(result.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`;
      const heapUsed = `${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`;
      const iterations = result.iterations.toString();

      console.log(
        `│ ${result.operation.padEnd(19)} │ ${duration.padEnd(11)} │ ${memoryRSS.padEnd(11)} │ ${heapUsed.padEnd(11)} │ ${iterations.padEnd(11)} │`,
      );
    }

    console.log(
      "└─────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘",
    );

    // Performance analysis
    const coldStart = this.results.find((r) => r.operation === "cold-start");
    const warmStart = this.results.find((r) => r.operation === "warm-start");
    const commandExec = this.results.find(
      (r) => r.operation === "command-execution",
    );

    if (coldStart && warmStart) {
      const improvement = (
        ((coldStart.duration - warmStart.duration) / coldStart.duration) *
        100
      ).toFixed(1);
      console.log(`\n🎯 Cache Performance: ${improvement}% faster with cache`);
    }

    if (commandExec) {
      const avgExecTime = (
        commandExec.duration / commandExec.iterations
      ).toFixed(2);
      console.log(`⚡ Average command execution: ${avgExecTime}ms`);
    }
  }
}

// Create test commands directory for benchmarking
const createTestCommands = async (): Promise<void> => {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const testCmdsDir = join(process.cwd(), "packages", "launcher", "test-cmds");

  try {
    mkdirSync(testCmdsDir, { recursive: true });

    // Create test command 1
    const testCmd1 = join(testCmdsDir, "test-command", "cmd.ts");
    mkdirSync(join(testCmdsDir, "test-command"), { recursive: true });
    writeFileSync(
      testCmd1,
      `
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  verbose: {
    type: "boolean",
    description: "Enable verbose output",
    aliases: ["v"],
  },
  count: {
    type: "number",
    description: "Number of iterations",
    default: 1,
  },
});

const cfg = defineCmdCfg({
  name: "test-command",
  description: "A test command for benchmarking",
  aliases: ["test"],
  examples: ["test-command --verbose", "test-command --count 5"],
});

export default defineCmd(async (args) => {
  console.log("Test command executed with args:", args);
}, args, cfg);
`,
    );

    // Create test command 2
    const testCmd2 = join(testCmdsDir, "another-command", "cmd.ts");
    mkdirSync(join(testCmdsDir, "another-command"), { recursive: true });
    writeFileSync(
      testCmd2,
      `
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({
  input: {
    type: "string",
    description: "Input file path",
    required: true,
  },
  output: {
    type: "string",
    description: "Output file path",
    aliases: ["o"],
  },
});

const cfg = defineCmdCfg({
  name: "another-command",
  description: "Another test command",
  version: "1.0.0",
});

export default defineCmd(async (args) => {
  console.log("Another command executed with args:", args);
}, args, cfg);
`,
    );

    // Create test command 3
    const testCmd3 = join(testCmdsDir, "third-command", "cmd.ts");
    mkdirSync(join(testCmdsDir, "third-command"), { recursive: true });
    writeFileSync(
      testCmd3,
      `
import { defineCmd, defineCmdArgs, defineCmdCfg } from "@reliverse/dler-launcher";

const args = defineCmdArgs({});

const cfg = defineCmdCfg({
  name: "third-command",
  description: "A simple command with no arguments",
});

export default defineCmd(async () => {
  console.log("Third command executed");
}, args, cfg);
`,
    );
  } catch (error) {
    console.error("Failed to create test commands:", error);
  }
};

// Run benchmark if this file is executed directly
if (import.meta.main) {
  // Skip creating test commands since they already exist
  // await createTestCommands();

  const benchmark = new PerformanceBenchmark();
  await benchmark.benchmarkStartup();
}
