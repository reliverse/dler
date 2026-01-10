---
title: Monorepo
description: Monorepo Build Orchestration Features
---

## Overview

The `rse`'s monorepo functionality provides intelligent build orchestration and caching for JavaScript/TypeScript monorepos. It automatically detects workspace configurations, builds dependency graphs, and caches build outputs to speed up subsequent builds.

## Features Implemented

### 1. Monorepo Detection

- **Workspace Detection**: Automatically detects pnpm-workspace.yaml and package.json workspaces
- **Package Manager Detection**: Supports pnpm, bun, npm, and yarn
- **Package Discovery**: Finds all packages in the monorepo using glob patterns

### 2. Dependency Graph Management

- **Graph Building**: Creates dependency graphs from package.json files
- **Build Order Calculation**: Determines correct build order based on dependencies
- **Active Package Detection**: Finds the package containing the current working directory
- **Visual Graph Printing**: Displays dependency tree structure

### 3. Intelligent Build Caching

- **File-based Caching**: Uses MD5 hashes to detect file changes
- **Configurable Patterns**: Supports include/exclude patterns for cache keys
- **Cache Invalidation**: Automatically rebuilds when files change
- **Cache Restoration**: Restores build outputs from cache when possible

### 4. Build Process Management

- **Dependency Building**: Builds packages in correct dependency order
- **Environment Handling**: Manages nested build processes with environment variables
- **Error Handling**: Proper error handling and exit codes
- **Progress Reporting**: Clear build progress and status messages

## Commands Available

### `monorepo-build`

Build dependencies and run a command in a monorepo.

```bash
bun rse monorepo-build --command "unbuild" --args "--minify"
bun rse monorepo-build --command "tsup" --args "--minify" "--sourcemap"
```

### `monorepo-deps`

Build dependencies for the current package only.

```bash
bun rse monorepo-deps
```

### `monorepo-all`

Build all packages in the monorepo.

```bash
bun rse monorepo-all
```

### `monorepo-graph`

Print the dependency graph of the monorepo.

```bash
bun rse monorepo-graph
```

### `monorepo-clean`

Clean the build cache for the monorepo.

```bash
bun rse monorepo-clean
```

## Configuration

Each package can be configured using a `dler` field in its package.json:

```json
{
  "name": "my-package",
  "dler": {
    "cache": true,
    "outDir": "dist",
    "include": ["src/**/*"],
    "exclude": ["**/*.test.*", "**/__tests__/**"]
  }
}
```

### Configuration Options

- **`cache`** (boolean): Whether to cache build outputs (default: true)
- **`outDir`** (string): Output directory for build artifacts (default: "dist")
- **`include`** (string[]): Glob patterns for files to include in cache key (default: ["src/**/*"])
- **`exclude`** (string[]): Glob patterns for files to exclude from cache key (default: test patterns)

## Usage Examples

### Basic Usage

```bash
# Build dependencies and run a command
bun rse monorepo-build --command "unbuild"

# Build all packages
bun rse monorepo-all

# Show dependency graph
bun rse monorepo-graph
```

### With Debug Logging

```bash
# Enable debug logging
DEBUG=dler bun rse monorepo-build --command "unbuild"
```

### CI/CD Usage

```bash
# Run in CI mode
bun rse monorepo-all --ci
```

## Implementation Details

### File Structure

```bash
src-ts/impl/monorepo/
├── mod.ts                 # Main exports
├── monorepo-mod.ts       # Monorepo detection and workspace management
├── graph-mod.ts          # Dependency graph building and traversal
├── cache-mod.ts          # Build caching system
└── commands-mod.ts       # Command implementations
```

### Key Components

1. **MonorepoModule**: Handles workspace detection and package discovery
2. **DependencyGraph**: Manages dependency relationships and build ordering
3. **CacheModule**: Provides file-based caching with hash invalidation
4. **CommandsModule**: Implements the CLI commands

### Dependencies

- `@reliverse/relifso`: File system operations
- `@reliverse/pathkit`: Path utilities
- `@reliverse/relinka`: Logging
- `globby`: File globbing
- `execa`: Process execution
- `node:crypto`: Hashing

## Architecture

The TypeScript implementation provides comprehensive monorepo build orchestration:

| Feature | Implementation |
|---------|----------------|
| `deps` command | `monorepo-deps` command |
| `all` command | `monorepo-all` command |
| `graph` command | `monorepo-graph` command |
| `clean` command | `monorepo-clean` command |
| Build orchestration | `monorepo-build` command |
| Workspace detection | `findMonorepo()` function |
| Dependency graphs | `DependencyGraph` class |
| File-based caching | `hashPackage()`, `cachePackageOutput()` |
| Environment handling | `INSIDE_DLER` environment variable |

## Testing

A test monorepo is provided in the `test-monorepo/` directory. Run the test script to verify functionality:

```bash
cd test-monorepo
bun run test-dler.ts
```

This will test:

- Monorepo detection
- Dependency graph creation
- Build order calculation
- Active package detection
- Package hashing

## Future Enhancements

Potential future improvements:

- Parallel build execution
- Incremental build support
- Remote caching
- Build pipeline visualization
- Integration with CI/CD systems
