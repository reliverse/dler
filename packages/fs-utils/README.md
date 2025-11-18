# @reliverse/dler-fs-utils

> Ultra-performant, Bun-first file system utilities that mirror the most commonly used `fs-extra` APIs.

A drop-in replacement for `fs-extra` optimized for Bun's native file I/O APIs (`Bun.file` and `Bun.write`). Provides 100% type safety, zero dependencies, and leverages Bun's optimized syscalls (`copy_file_range`, `sendfile`, etc.) for maximum performance.

## Features

- 🚀 **Ultra-fast** - Leverages Bun's native `Bun.file()` and `Bun.write()` APIs
- 📦 **Zero dependencies** - Pure Bun/Node.js implementation
- 🔒 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🎯 **fs-extra compatible** - Drop-in replacement for the most commonly used APIs
- 🪟 **Cross-platform** - Windows-aware symlink handling with junction support
- 📊 **Well-tested** - Comprehensive benchmarks and test coverage

## Installation

```bash
bun add @reliverse/dler-fs-utils
```

## Quick Start

### Default Import

```ts
import fs from "@reliverse/dler-fs-utils";

// Read and write files
const content = await fs.readFile("package.json", { encoding: "utf8" });
await fs.writeFile("output.txt", "Hello, Bun!");

// JSON operations
const data = await fs.readJson<{ version: string }>("package.json");
await fs.writeJson("config.json", { port: 3000 });

// Directory operations
await fs.ensureDir("dist/assets");
await fs.emptyDir("temp");
await fs.remove("old-files");

// Copy and move
await fs.copy("src", "dist");
await fs.move("old.txt", "new.txt");
```

### Named Imports

```ts
import {
  readFile,
  writeFile,
  readJson,
  writeJson,
  ensureDir,
  copy,
  remove,
} from "@reliverse/dler-fs-utils";

await ensureDir("build");
await writeFile("build/index.js", "console.log('Hello');");
const data = await readJson("package.json");
```

## API Reference

### File Operations

#### `readFile(path, options?)`

Read a file as a string with various encodings or binary (`Uint8Array`).

```ts
// Read as binary (default)
const buffer: Uint8Array = await fs.readFile("image.png");

// Read as UTF-8 string
const text: string = await fs.readFile("file.txt", { encoding: "utf8" });

// Supported encodings: utf8, utf-8, ascii, base64, hex, latin1, ucs-2, ucs2, utf16le, binary
const base64: string = await fs.readFile("file.bin", { encoding: "base64" });
const hex: string = await fs.readFile("file.bin", { encoding: "hex" });
const ascii: string = await fs.readFile("file.txt", { encoding: "ascii" });
const latin1: string = await fs.readFile("file.txt", { encoding: "latin1" });
```

#### `writeFile(destination, data, options?)`

Write data to a file. Accepts strings, `Uint8Array`, `Blob`, or `BunFile`.

```ts
// Write string (UTF-8 by default)
await fs.writeFile("output.txt", "Hello, World!");

// Write with specific encoding
await fs.writeFile("output.txt", "Привіт", { encoding: "utf8" });
await fs.writeFile("output.txt", "Hello", { encoding: "latin1" });
await fs.writeFile("output.txt", "Hello", { encoding: "ascii" });

// Write binary data
await fs.writeFile("data.bin", new Uint8Array([1, 2, 3]));

// Write from BunFile
await fs.writeFile("copy.txt", Bun.file("original.txt"));

// Write with file mode
await fs.writeFile("script.sh", "#!/bin/bash", { mode: 0o755 });
```

#### `appendFile(file, data, options?)`

Append data to a file, creating it if it doesn't exist.

```ts
// Append string to file
await fs.appendFile("log.txt", "New log entry\n");

// Append with encoding
await fs.appendFile("log.txt", "Entry", { encoding: "utf8" });

// Append binary data
await fs.appendFile("data.bin", new Uint8Array([1, 2, 3]));

// Append with file mode (only applies when creating new file)
await fs.appendFile("log.txt", "Entry\n", { mode: 0o644 });
```

#### `readJson<T>(path)`

Read and parse a JSON file asynchronously.

```ts
interface PackageJson {
  name: string;
  version: string;
}

const pkg = await fs.readJson<PackageJson>("package.json");
console.log(pkg.name); // Type-safe access
```

#### `readJSONSync<T>(path)`

Read and parse a JSON file synchronously.

```ts
interface PackageJson {
  name: string;
  version: string;
}

// Synchronous version - blocks until file is read
const pkg = fs.readJSONSync<PackageJson>("package.json");
console.log(pkg.name); // Type-safe access
```

#### `writeJson(destination, data, options?)`

Write data as JSON to a file.

```ts
await fs.writeJson("config.json", { port: 3000, host: "localhost" });

// Custom indentation
await fs.writeJson("config.json", data, { spaces: 4 });
```

#### `outputFile(destination, data, options?)`

Write a file, automatically creating parent directories if needed.

```ts
// Creates "build/assets" directory if it doesn't exist
await fs.outputFile("build/assets/style.css", "body { margin: 0; }");
```

#### `outputJson(destination, data, options?)`

Write JSON to a file, automatically creating parent directories.

```ts
await fs.outputJson("build/meta.json", { version: "1.0.0" });
```

### Directory Operations

#### `ensureDir(path)`

Ensure a directory exists, creating it and any necessary parent directories.

```ts
await fs.ensureDir("dist/assets/images");
// Creates: dist/assets/images (and all parent directories)
```

#### `mkdirp(path)`

Alias for `ensureDir`.

#### `ensureFile(path)`

Ensure a file exists, creating it and any necessary parent directories.

```ts
await fs.ensureFile("logs/app.log");
// Creates: logs/ directory and app.log file
```

#### `readdir(path, options?)`

Read directory contents.

```ts
// Get file names
const files = await fs.readdir("src");

// With file types
const entries = await fs.readdir("src", { withFileTypes: true });
```

#### `readdirRecursive(path, options?)`

Recursively read all files in a directory.

```ts
// Get all files recursively
const allFiles = await fs.readdirRecursive("src");

// Filter by extension
const tsFiles = await fs.readdirRecursive("src", {
  extensions: ["ts", "tsx"],
});

// Follow symlinks
const files = await fs.readdirRecursive("src", {
  followSymlinks: true,
});
```

#### `listFiles(path, options?)`

Alias for `readdirRecursive`.

#### `emptyDir(path, options?)`

Remove all files and subdirectories from a directory.

```ts
await fs.emptyDir("temp");

// With filter
await fs.emptyDir("temp", {
  filter: (path) => !path.includes("keep-me"),
});
```

#### `remove(path, options?)`

Remove a file or directory recursively.

```ts
// Remove file
await fs.remove("old-file.txt");

// Remove directory
await fs.remove("dist");

// Force removal (ignore errors)
await fs.remove("locked-dir", { force: true });
```

#### `pathExists(path)`

Check if a path exists.

```ts
if (await fs.pathExists("config.json")) {
  const config = await fs.readJson("config.json");
}
```

#### `sizeOf(path, options?)`

Get the total size of a file or directory.

```ts
// File size
const fileSize = await fs.sizeOf("large-file.zip");

// Directory size (recursive)
const dirSize = await fs.sizeOf("node_modules");

// Follow symlinks
const size = await fs.sizeOf("symlink", { followSymlinks: true });
```

### Copy & Move Operations

#### `copy(source, destination, options?)`

Copy a file or directory.

```ts
// Copy file
await fs.copy("src/index.ts", "dist/index.js");

// Copy directory
await fs.copy("src", "dist");

// With options
await fs.copy("src", "dist", {
  overwrite: false, // Don't overwrite existing files
  dereference: true, // Follow symlinks
  filter: (path) => !path.includes("test"), // Filter files
});
```

#### `move(source, destination, options?)`

Move (rename) a file or directory.

```ts
// Move file
await fs.move("old.txt", "new.txt");

// Move directory
await fs.move("src", "lib");

// With options
await fs.move("old.txt", "new.txt", { overwrite: true });
```

### Link Operations

#### `ensureLink(source, destination)`

Create a hard link, ensuring the destination exists.

```ts
await fs.ensureLink("original.txt", "link.txt");
```

#### `ensureSymlink(source, destination, options?)`

Create a symbolic link, ensuring the destination exists.

```ts
// Unix/Linux/Mac
await fs.ensureSymlink("target", "link");

// Windows (automatic junction detection)
await fs.ensureSymlink("target", "link", { type: "dir" });
```

### Utility Functions

#### `touch(path, options?)`

Update file access and modification times, creating the file if it doesn't exist.

```ts
// Update to current time
await fs.touch("file.txt");

// Set specific times
await fs.touch("file.txt", {
  mtime: new Date("2024-01-01"),
  atime: new Date("2024-01-01"),
});
```

#### `readLines(path, options?)`

Read a file and return its contents as an array of lines.

```ts
// Basic usage
const lines = await fs.readLines("file.txt");

// With options
const lines = await fs.readLines("file.txt", {
  trim: true, // Trim whitespace
  skipEmpty: true, // Skip empty lines
  maxLines: 100, // Limit number of lines
});
```

## Performance

This library is optimized for Bun's native file I/O APIs:

- **`Bun.file().bytes()`** - Direct binary reading without conversion overhead
- **`Bun.file().json()`** - Native JSON parsing
- **`Bun.write()`** - Uses optimized syscalls (`copy_file_range`, `sendfile`, `clonefile`, `fcopyfile`)
- **`Bun.file().exists()`** - Fast existence checks

Run benchmarks:

```bash
bun run perf.ts
```

## Migration from fs-extra

This library is designed as a drop-in replacement for the most commonly used `fs-extra` APIs:

```ts
// Before (fs-extra)
import * as fs from "fs-extra";

// After (@reliverse/dler-fs-utils)
import fs from "@reliverse/dler-fs-utils";

// API is identical for supported methods
await fs.ensureDir("dist");
await fs.copy("src", "dist");
await fs.readJson("package.json");
```

**Note:** This library focuses on the most commonly used `fs-extra` methods. For less common APIs, you may need to use `node:fs` directly.

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```ts
import type {
  CopyOptions,
  FileEncoding,
  ReadFileOptions,
  WriteFileOptions,
  JsonWriteOptions,
} from "@reliverse/dler-fs-utils";

const options: CopyOptions = {
  overwrite: true,
  filter: (path) => path.endsWith(".ts"),
};

// Type-safe encoding
const encoding: FileEncoding = "base64";
const data = await fs.readFile("file.bin", { encoding });
```

## Requirements

- **Bun** >= 1.0 (recommended for optimal performance)
- **Node.js** >= 18 (fallback to `node:fs` when Bun APIs aren't available)

## License

MIT
