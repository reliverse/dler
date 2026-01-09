/*
When to Use Sync vs Async:
Use SYNC (logger) when:
✅ Sequential logging (like your tsc implementation)
✅ CLI tools with ordered output
✅ Small, frequent console writes
✅ Error reporting that needs to maintain order
✅ When you need guaranteed write completion before continuing

Use ASYNC (relinka) when:
✅ Logging from multiple concurrent async operations
✅ High-frequency logging where you don't want to block
✅ Large log outputs that could slow down execution
✅ Fire-and-forget logging (writes are queued and happen in background)
✅ When order matters but you don't want to wait for each write

Note: relinka queues writes in order but returns immediately without waiting
for completion. This prevents blocking while maintaining write order.
*/

import { re } from "@reliverse/relico";

const textEncoder = new TextEncoder();

type LogLevel = "log" | "error" | "fatal" | "warn" | "info" | "success" | "debug" | "box";

const LOG_COLORS: Record<LogLevel, (text: string) => string> = {
  log: re.white,
  error: re.red,
  fatal: re.red,
  warn: re.yellow,
  info: re.blue,
  success: re.green,
  debug: re.gray,
  box: re.white,
};

const LOG_SYMBOLS: Record<LogLevel, string> = {
  log: "│  ",
  error: "✖  ",
  fatal: "☠  ",
  warn: "⚠  ",
  info: "■  ",
  success: "✓  ",
  debug: "✱  ",
  box: "",
};

// Write lock to prevent interleaving
let writeLock = Promise.resolve();

// Generic message formatter - optimized for performance
const formatMessage = (...args: unknown[]): string => {
  const len = args.length;
  if (len === 0) {
    return "";
  }
  if (len === 1) {
    return String(args[0]);
  }
  // Use map().join() - modern engines optimize this well
  return args.map(String).join(" ");
};

// Generic prefixed message creator - optimized with direct string concatenation
const createPrefixedMessage = (level: LogLevel, message: string): string => {
  const symbol = LOG_SYMBOLS[level];
  // Fast path for empty symbol (box level)
  if (symbol === "") {
    return message;
  }
  return symbol + message;
};

// Box formatter - wraps text in a box (optimized)
const formatBox = (message: string): string => {
  const lines = message.split("\n");
  const lineCount = lines.length;
  if (lineCount === 0) {
    return "┌──┐\n│  │\n└──┘\n";
  }

  // Calculate max width more efficiently
  let maxWidth = 0;
  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const len = line.length;
    if (len > maxWidth) {
      maxWidth = len;
    }
  }

  const padding = 2;
  const width = maxWidth + padding * 2;
  const horizontal = "─".repeat(width);
  const top = `┌${horizontal}┐\n`;
  const bottom = `└${horizontal}┘\n`;

  // Pre-calculate padding strings
  const leftPadding = " ".repeat(padding);
  const rightPadding = " ".repeat(padding);

  // Build content lines efficiently - use string concat for small arrays (faster)
  if (maxWidth === 0) {
    return `${top}│${" ".repeat(width)}│\n${bottom}`;
  }

  let content = "";
  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const padded = line.padEnd(maxWidth);
    content += `│${leftPadding}${padded}${rightPadding}│\n`;
  }

  return `${top}${content}${bottom}`;
};

// Generic async writer (non-blocking - queues writes but doesn't wait for completion)
// Optimized: encode once with newline included
const writeAsync = async (text: string, isError = false): Promise<void> => {
  // Encode text with newline in one operation (faster than separate encoding + copy)
  const encoded = textEncoder.encode(`${text}\n`);
  // Queue the write after previous writes, but don't wait for it to complete
  const stream = isError ? Bun.stderr : Bun.stdout;
  writeLock = writeLock.then(async () => {
    await Bun.write(stream, encoded);
  });
  // Return immediately without awaiting the write
};

// Generic sync writer - optimized
const writeSync = (text: string, isError = false): void => {
  // Encode text with newline in one operation (faster)
  const encoded = textEncoder.encode(`${text}\n`);
  (isError ? process.stderr : process.stdout).write(encoded);
};

// Generic colored async writer - optimized (no await needed since writeAsync doesn't wait)
const writeColoredAsync = (
  text: string,
  color: typeof re.white,
  isError = false
): Promise<void> => {
  const coloredText = color(text);
  return writeAsync(coloredText, isError);
};

// Generic colored sync writer
const writeColoredSync = (text: string, color: typeof re.white, isError = false): void => {
  const coloredText = color(text);
  writeSync(coloredText, isError);
};

// Generic log method creator with overloads
function createLogMethod(
  level: LogLevel,
  isAsync: true,
  isError?: boolean
): (...args: unknown[]) => Promise<void>;
function createLogMethod(
  level: LogLevel,
  isAsync: false,
  isError?: boolean
): (...args: unknown[]) => void;
function createLogMethod(
  level: LogLevel,
  isAsync: boolean,
  isError = false
): ((...args: unknown[]) => void) | ((...args: unknown[]) => Promise<void>) {
  // Cache color function for better performance
  const color = LOG_COLORS[level];
  const isBox = level === "box";

  if (isAsync) {
    return (...args: unknown[]): Promise<void> => {
      const message = formatMessage(...args);
      const formattedMessage = isBox ? formatBox(message) : createPrefixedMessage(level, message);
      return writeColoredAsync(formattedMessage, color, isError);
    };
  }

  return (...args: unknown[]): void => {
    const message = formatMessage(...args);
    const formattedMessage = isBox ? formatBox(message) : createPrefixedMessage(level, message);
    writeColoredSync(formattedMessage, color, isError);
  };
}

// Generic raw method creator with overloads
function createRawMethod(isAsync: true): (...args: unknown[]) => Promise<void>;
function createRawMethod(isAsync: false): (...args: unknown[]) => void;
function createRawMethod(
  isAsync: boolean
): ((...args: unknown[]) => void) | ((...args: unknown[]) => Promise<void>) {
  if (isAsync) {
    return (...args: unknown[]): Promise<void> => {
      const message = formatMessage(...args);
      return writeAsync(message);
    };
  }

  return (...args: unknown[]): void => {
    const message = formatMessage(...args);
    writeSync(message);
  };
}

// Base interface for both sync and async
interface LoggerBase {
  log: (...args: unknown[]) => void | Promise<void>;
  error: (...args: unknown[]) => void | Promise<void>;
  fatal: (...args: unknown[]) => void | Promise<void>;
  warn: (...args: unknown[]) => void | Promise<void>;
  info: (...args: unknown[]) => void | Promise<void>;
  success: (...args: unknown[]) => void | Promise<void>;
  debug: (...args: unknown[]) => void | Promise<void>;
  box: (...args: unknown[]) => void | Promise<void>;
  raw: (...args: unknown[]) => void | Promise<void>;
}

interface LoggerAsync extends LoggerBase {
  (level: LogLevel, ...args: unknown[]): Promise<void>;
  log: (...args: unknown[]) => Promise<void>;
  error: (...args: unknown[]) => Promise<void>;
  fatal: (...args: unknown[]) => Promise<void>;
  warn: (...args: unknown[]) => Promise<void>;
  info: (...args: unknown[]) => Promise<void>;
  success: (...args: unknown[]) => Promise<void>;
  debug: (...args: unknown[]) => Promise<void>;
  box: (...args: unknown[]) => Promise<void>;
  raw: (...args: unknown[]) => Promise<void>;
}

interface Logger extends LoggerBase {
  (level: LogLevel, ...args: unknown[]): void;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  success: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  box: (...args: unknown[]) => void;
  raw: (...args: unknown[]) => void;
}

// Create callable logger function with method properties (sync)
const createCallableLogger = (methods: LoggerBase): Logger => {
  const callable = ((level: LogLevel, ...args: unknown[]): void => {
    const method = methods[level];
    if (method) {
      method(...args);
      return;
    }
    // Fallback to log if level is invalid
    methods.log(...args);
  }) as Logger;

  // Assign all methods to the callable function
  callable.log = methods.log as (...args: unknown[]) => void;
  callable.error = methods.error as (...args: unknown[]) => void;
  callable.fatal = methods.fatal as (...args: unknown[]) => void;
  callable.warn = methods.warn as (...args: unknown[]) => void;
  callable.info = methods.info as (...args: unknown[]) => void;
  callable.success = methods.success as (...args: unknown[]) => void;
  callable.debug = methods.debug as (...args: unknown[]) => void;
  callable.box = methods.box as (...args: unknown[]) => void;
  callable.raw = methods.raw as (...args: unknown[]) => void;

  return callable;
};

// Create callable logger function with method properties (async)
const createCallableLoggerAsync = (methods: LoggerBase): LoggerAsync => {
  const callable = ((level: LogLevel, ...args: unknown[]): Promise<void> => {
    const method = methods[level];
    if (method) {
      return method(...args) as Promise<void>;
    }
    // Fallback to log if level is invalid
    return methods.log(...args) as Promise<void>;
  }) as LoggerAsync;

  // Assign all methods to the callable function
  callable.log = methods.log as (...args: unknown[]) => Promise<void>;
  callable.error = methods.error as (...args: unknown[]) => Promise<void>;
  callable.fatal = methods.fatal as (...args: unknown[]) => Promise<void>;
  callable.warn = methods.warn as (...args: unknown[]) => Promise<void>;
  callable.info = methods.info as (...args: unknown[]) => Promise<void>;
  callable.success = methods.success as (...args: unknown[]) => Promise<void>;
  callable.debug = methods.debug as (...args: unknown[]) => Promise<void>;
  callable.box = methods.box as (...args: unknown[]) => Promise<void>;
  callable.raw = methods.raw as (...args: unknown[]) => Promise<void>;

  return callable;
};

const loggerMethods: LoggerBase = {
  log: createLogMethod("log", false),
  error: createLogMethod("error", false, true),
  fatal: createLogMethod("fatal", false, true),
  warn: createLogMethod("warn", false),
  info: createLogMethod("info", false),
  success: createLogMethod("success", false),
  debug: createLogMethod("debug", false),
  box: createLogMethod("box", false),
  raw: createRawMethod(false),
};

const relinkaMethods: LoggerBase = {
  log: createLogMethod("log", true),
  error: createLogMethod("error", true, true),
  fatal: createLogMethod("fatal", true, true),
  warn: createLogMethod("warn", true),
  info: createLogMethod("info", true),
  success: createLogMethod("success", true),
  debug: createLogMethod("debug", true),
  box: createLogMethod("box", true),
  raw: createRawMethod(true),
};

export const logger = createCallableLogger(loggerMethods);
export const relinka = createCallableLoggerAsync(relinkaMethods);
