# @reliverse/relinka

A modern, lightweight logging library for TypeScript/JavaScript with both synchronous and asynchronous logging capabilities. Perfect for CLI tools, build systems, and concurrent applications.

## Features

- 🚀 **Dual Mode**: Synchronous (`logger`) and asynchronous (`relinka`) logging
- 🎨 **Colored Output**: Beautiful, color-coded log levels using [@reliverse/relico](https://github.com/reliverse/relico)
- 📦 **Zero Dependencies**: Only depends on `@reliverse/relico` for colors
- 🔒 **Thread-Safe**: Async logger uses write queuing to prevent interleaving
- 🎯 **Type-Safe**: Full TypeScript support with proper type inference
- 📝 **Multiple Log Levels**: `log`, `error`, `fatal`, `warn`, `info`, `success`, `debug`, `box`, `raw`
- 🎭 **Callable Interface**: Use as a function or with method calls
- ⚡ **Non-Blocking**: Async logger queues writes but returns immediately

## Installation

```bash
bun add @reliverse/relinka
# or
npm install @reliverse/relinka
# or
pnpm add @reliverse/relinka
```

## Quick Start

```typescript
import { logger, relinka } from "@reliverse/relinka";

// Synchronous logging (blocks until write completes)
logger.info("Application started");
logger.success("Build completed successfully");
logger.error("Failed to load configuration");

// Asynchronous logging (queues writes, returns immediately)
await relinka.info("Processing files...");
await relinka.success("All files processed");
await relinka.error("File processing failed");
```

## When to Use Sync vs Async

### Use `logger` (Synchronous) when:

- ✅ Sequential logging (like CLI tools with ordered output)
- ✅ Small, frequent console writes
- ✅ Error reporting that needs to maintain order
- ✅ When you need guaranteed write completion before continuing
- ✅ CLI tools where output order is critical

### Use `relinka` (Asynchronous) when:

- ✅ Logging from multiple concurrent async operations
- ✅ High-frequency logging where you don't want to block
- ✅ Large log outputs that could slow down execution
- ✅ Fire-and-forget logging (writes are queued and happen in background)
- ✅ When order matters but you don't want to wait for each write

**Note**: `relinka` queues writes in order but returns immediately without waiting for completion. This prevents blocking while maintaining write order.

## API

### Log Levels

Both `logger` and `relinka` support the following log levels:

| Level     | Symbol | Color  | Description                |
| --------- | ------ | ------ | -------------------------- |
| `log`     | `│  `  | White  | General logging            |
| `error`   | `✖  `  | Red    | Error messages             |
| `fatal`   | `☠  `  | Red    | Fatal errors               |
| `warn`    | `⚠  `  | Yellow | Warning messages           |
| `info`    | `■  `  | Blue   | Informational messages     |
| `success` | `✓  `  | Green  | Success messages           |
| `debug`   | `✱  `  | Gray   | Debug messages             |
| `box`     | -      | White  | Box-formatted messages     |
| `raw`     | -      | -      | Raw output (no formatting) |

### Usage Patterns

#### Method Calls

```typescript
import { logger, relinka } from "@reliverse/relinka";

// Synchronous
logger.log("General message");
logger.info("Information");
logger.success("Operation succeeded");
logger.warn("Warning message");
logger.error("Error occurred");
logger.fatal("Fatal error");
logger.debug("Debug information");
logger.box("Boxed message");
logger.raw("Raw output without formatting");

// Asynchronous (returns Promise<void>)
await relinka.log("General message");
await relinka.info("Information");
await relinka.success("Operation succeeded");
await relinka.warn("Warning message");
await relinka.error("Error occurred");
await relinka.fatal("Fatal error");
await relinka.debug("Debug information");
await relinka.box("Boxed message");
await relinka.raw("Raw output without formatting");
```

#### Callable Function

Both loggers can be called as functions with the log level as the first argument:

```typescript
import { logger, relinka } from "@reliverse/relinka";

// Synchronous
logger("info", "Application started");
logger("success", "Build completed");
logger("error", "Build failed");

// Asynchronous
await relinka("info", "Processing started");
await relinka("success", "Processing completed");
await relinka("error", "Processing failed");
```

#### Multiple Arguments

All log methods accept multiple arguments, which are automatically joined:

```typescript
logger.info("User", username, "logged in");
// Output: ■  User john_doe logged in

logger.error("Failed to connect to", host, "on port", port);
// Output: ✖  Failed to connect to localhost on port 3000
```

## Examples

### CLI Tool (Synchronous)

```typescript
import { logger } from "@reliverse/relinka";

async function buildProject() {
  logger.info("Starting build process...");

  try {
    // Build steps
    logger.success("Build completed successfully");
  } catch (error) {
    logger.error("Build failed:", error);
    process.exit(1);
  }
}
```

### Concurrent Operations (Asynchronous)

```typescript
import { relinka } from "@reliverse/relinka";

async function processFiles(files: string[]) {
  // All logs are queued and won't block execution
  await Promise.all(
    files.map(async (file) => {
      await relinka.info(`Processing ${file}...`);
      // Process file...
      await relinka.success(`Completed ${file}`);
    })
  );

  // Writes happen in background, maintaining order
  await relinka.info("All files processed");
}
```

### Box Formatting

```typescript
import { logger } from "@reliverse/relinka";

logger.box(`
  Welcome to My Application
  Version 1.0.0
  Ready to serve requests
`);

// Output:
// ┌──────────────────────────────┐
// │  Welcome to My Application   │
// │  Version 1.0.0                │
// │  Ready to serve requests      │
// └──────────────────────────────┘
```

### Error Handling

```typescript
import { logger } from "@reliverse/relinka";

try {
  await riskyOperation();
  logger.success("Operation completed");
} catch (error) {
  logger.error("Operation failed");
  logger.fatal("Application cannot continue");
  if (error instanceof Error) {
    logger.raw(error.stack);
  }
  process.exit(1);
}
```

### Conditional Logging

```typescript
import { logger } from "@reliverse/relinka";

const DEBUG = process.env.DEBUG === "true";

if (DEBUG) {
  logger.debug("Debug mode enabled");
  logger.debug("Configuration:", config);
}
```

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
import type { Logger, LoggerAsync } from "@reliverse/relinka";
import { logger, relinka } from "@reliverse/relinka";

// Type-safe log level
type LogLevel = "log" | "error" | "fatal" | "warn" | "info" | "success" | "debug" | "box" | "raw";

// Logger types
const syncLogger: Logger = logger;
const asyncLogger: LoggerAsync = relinka;

// Function call with type safety
logger("info", "Message"); // ✅ Valid
relinka("info", "Message"); // ✅ Valid, returns Promise<void>
```

## Requirements

- **Runtime**: Bun (uses `Bun.write` for async operations)
- **TypeScript**: 5.0+ (for best experience)

## License

MIT

## Related Packages

- [@reliverse/relico](https://github.com/reliverse/relico) - Color utilities used by relinka
