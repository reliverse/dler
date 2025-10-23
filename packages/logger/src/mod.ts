/* 
When to Use Async vs Sync:
Use SYNC (logger) when:
✅ Sequential logging (like your tsc implementation)
✅ CLI tools with ordered output
✅ Small, frequent console writes
✅ Error reporting that needs to maintain order
Use ASYNC (loggerAsync) when:
✅ Logging from multiple concurrent async operations
✅ High-frequency logging where order doesn't matter
✅ Large log outputs that could block
✅ When you need to await logging completion
*/

import { re } from "@reliverse/dler-colors";

const textEncoder = new TextEncoder();

const LOG_COLORS = {
  log: re.white,
  error: re.red,
  warn: re.yellow,
  info: re.blue,
  success: re.green,
  debug: re.gray,
} as const;

const LOG_SYMBOLS = {
  log: "│  ",
  error: "✖  ",
  warn: "⚠  ",
  info: "■  ",
  success: "✓  ",
  debug: "✱  ",
} as const;

type LogLevel = keyof typeof LOG_COLORS;

// Write lock to prevent interleaving
let writeLock = Promise.resolve();

// Generic message formatter
const formatMessage = (...args: unknown[]): string =>
  args.map(String).join(" ");

// Generic prefixed message creator
const createPrefixedMessage = (level: LogLevel, message: string): string =>
  `${LOG_SYMBOLS[level]}${message}`;

// Generic async writer
const writeAsync = async (text: string, isError = false): Promise<void> => {
  const encoded = textEncoder.encode(`${text}\n`);
  await writeLock;
  writeLock = Bun.write(isError ? Bun.stderr : Bun.stdout, encoded).then(
    () => {},
  );
  await writeLock;
};

// Generic sync writer
const writeSync = (text: string, isError = false): void => {
  const encoded = textEncoder.encode(`${text}\n`);
  (isError ? process.stderr : process.stdout).write(encoded);
};

// Generic colored async writer
const writeColoredAsync = async (
  text: string,
  color: typeof re.white,
  isError = false,
): Promise<void> => {
  const coloredText = color(text);
  await writeAsync(coloredText, isError);
};

// Generic colored sync writer
const writeColoredSync = (
  text: string,
  color: typeof re.white,
  isError = false,
): void => {
  const coloredText = color(text);
  writeSync(coloredText, isError);
};

// Generic log method creator with overloads
function createLogMethod(
  level: LogLevel,
  isAsync: true,
  isError?: boolean,
): (...args: unknown[]) => Promise<void>;
function createLogMethod(
  level: LogLevel,
  isAsync: false,
  isError?: boolean,
): (...args: unknown[]) => void;
function createLogMethod(
  level: LogLevel,
  isAsync: boolean,
  isError = false,
): ((...args: unknown[]) => void) | ((...args: unknown[]) => Promise<void>) {
  if (isAsync) {
    return async (...args: unknown[]): Promise<void> => {
      const message = formatMessage(...args);
      const prefixedMessage = createPrefixedMessage(level, message);
      await writeColoredAsync(prefixedMessage, LOG_COLORS[level], isError);
    };
  }

  return (...args: unknown[]): void => {
    const message = formatMessage(...args);
    const prefixedMessage = createPrefixedMessage(level, message);
    writeColoredSync(prefixedMessage, LOG_COLORS[level], isError);
  };
}

// Generic raw method creator with overloads
function createRawMethod(isAsync: true): (...args: unknown[]) => Promise<void>;
function createRawMethod(isAsync: false): (...args: unknown[]) => void;
function createRawMethod(
  isAsync: boolean,
): ((...args: unknown[]) => void) | ((...args: unknown[]) => Promise<void>) {
  if (isAsync) {
    return async (...args: unknown[]): Promise<void> => {
      const message = formatMessage(...args);
      await writeAsync(message);
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
  warn: (...args: unknown[]) => void | Promise<void>;
  info: (...args: unknown[]) => void | Promise<void>;
  success: (...args: unknown[]) => void | Promise<void>;
  debug: (...args: unknown[]) => void | Promise<void>;
  raw: (...args: unknown[]) => void | Promise<void>;
}

interface LoggerAsync extends LoggerBase {
  log: (...args: unknown[]) => Promise<void>;
  error: (...args: unknown[]) => Promise<void>;
  warn: (...args: unknown[]) => Promise<void>;
  info: (...args: unknown[]) => Promise<void>;
  success: (...args: unknown[]) => Promise<void>;
  debug: (...args: unknown[]) => Promise<void>;
  raw: (...args: unknown[]) => Promise<void>;
}

interface Logger extends LoggerBase {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  success: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  raw: (...args: unknown[]) => void;
}

export const loggerAsync: LoggerAsync = {
  log: createLogMethod("log", true),
  error: createLogMethod("error", true, true),
  warn: createLogMethod("warn", true),
  info: createLogMethod("info", true),
  success: createLogMethod("success", true),
  debug: createLogMethod("debug", true),
  raw: createRawMethod(true),
};

export const logger: Logger = {
  log: createLogMethod("log", false),
  error: createLogMethod("error", false, true),
  warn: createLogMethod("warn", false),
  info: createLogMethod("info", false),
  success: createLogMethod("success", false),
  debug: createLogMethod("debug", false),
  raw: createRawMethod(false),
};
