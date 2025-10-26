// apps/dler/src/cmds/perf/benchmarks/command.ts

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lookpath } from "lookpath";
import type { Measurement, MemoryUsage } from "../types";

export interface CommandExecutionOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  success: boolean;
  duration: number;
  memory: MemoryUsage;
  stdout: string;
  stderr: string;
  error?: string;
  exitCode: number;
}

export const executeCommand = async (
  command: string,
  options: CommandExecutionOptions = {},
): Promise<CommandResult> => {
  const startTime = process.hrtime.bigint();

  try {
    // Parse command and arguments
    const [cmd, ...args] = parseCommand(command);

    // Check if command exists
    if (!cmd) {
      throw new Error("Command is empty");
    }

    const commandPath = await findCommand(cmd);
    if (!commandPath) {
      throw new Error(`Command not found: ${cmd}`);
    }

    // Execute command
    const proc = Bun.spawn([commandPath, ...args], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    // Set timeout if specified
    let timeoutId: Timer | undefined;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        proc.kill();
      }, options.timeout);
    }

    // Wait for completion
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    return {
      success: exitCode === 0,
      duration,
      memory: {
        rss: endMemory.rss,
        heapTotal: endMemory.heapTotal,
        heapUsed: endMemory.heapUsed,
        external: endMemory.external,
        arrayBuffers: endMemory.arrayBuffers,
      },
      stdout,
      stderr,
      exitCode,
    };
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - startTime) / 1_000_000;

    return {
      success: false,
      duration,
      memory: {
        rss: endMemory.rss,
        heapTotal: endMemory.heapTotal,
        heapUsed: endMemory.heapUsed,
        external: endMemory.external,
        arrayBuffers: endMemory.arrayBuffers,
      },
      stdout: "",
      stderr: "",
      error: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
};

export const executeCommandWithMemoryTracking = async (
  command: string,
  options: CommandExecutionOptions = {},
): Promise<Measurement> => {
  const result = await executeCommand(command, options);
  const endMemory = process.memoryUsage();

  return {
    run: 0, // Will be set by the runner
    duration: result.duration,
    memory: {
      rss: endMemory.rss,
      heapTotal: endMemory.heapTotal,
      heapUsed: endMemory.heapUsed,
      external: endMemory.external,
      arrayBuffers: endMemory.arrayBuffers,
    },
    success: result.success,
    error: result.error,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const parseCommand = (command: string): string[] => {
  // Simple command parsing - handles basic cases
  // For more complex cases, consider using a proper shell parser
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;

    if (char === '"' || char === "'") {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      } else {
        current += char;
      }
    } else if (char === " " && !inQuotes) {
      if (current.trim()) {
        parts.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const findCommand = async (cmd: string): Promise<string | null> => {
  if (!cmd) {
    return null;
  }

  // Check if it's a dler command first
  if (cmd === "dler") {
    return "bun";
  }

  // Check if it's a Bun command
  if (cmd === "bun") {
    return "bun";
  }

  // Check if it's a Node.js command
  if (cmd === "node") {
    return "node";
  }

  // Check if it's a direct executable
  if (cmd.includes("/") || cmd.includes("\\")) {
    const fullPath = resolve(cmd);
    return existsSync(fullPath) ? fullPath : null;
  }

  // Use lookpath to find the command
  try {
    const path = await lookpath(cmd);
    return path ?? null;
  } catch {
    return null;
  }
};

export const isDlerCommand = (command: string): boolean => {
  return command.startsWith("dler ") || command === "dler";
};

export const isBunCommand = (command: string): boolean => {
  return command.startsWith("bun ") || command === "bun";
};

export const isNodeCommand = (command: string): boolean => {
  return command.startsWith("node ") || command === "node";
};

export const getCommandType = (
  command: string,
): "dler" | "bun" | "node" | "external" => {
  if (isDlerCommand(command)) return "dler";
  if (isBunCommand(command)) return "bun";
  if (isNodeCommand(command)) return "node";
  return "external";
};
