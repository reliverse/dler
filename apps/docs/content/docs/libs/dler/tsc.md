---
title: "dler tsc"
description: "Run TypeScript type checking on all workspace packages"
---

Run TypeScript type checking on all workspace packages with advanced caching, concurrency control, and diagnostic reporting.

## Usage

```bash
dler tsc [options]
```

## Description

The `tsc` command runs TypeScript type checking across all workspace packages with optimized performance, intelligent caching, and comprehensive error reporting. It supports concurrent checking, incremental compilation, and clipboard integration for diagnostics.

## Options

### Package Selection

| Option | Type | Description |
|--------|------|-------------|
| `--filter <packages>` | string | Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore. |
| `--ignore <packages>` | string | Package(s) to ignore (supports wildcards like @reliverse/*). |
| `--cwd <path>` | string | Working directory (monorepo root). |

### Performance Control

| Option | Type | Description |
|--------|------|-------------|
| `--concurrency <number>` | number | Number of packages to check concurrently (default: CPU cores). |
| `--auto-concurrency` | boolean | Auto-detect optimal concurrency based on CPU cores (default: false). |
| `--stop-on-error` | boolean | Stop on first error instead of collecting all errors (default: false). |

### Caching & Optimization

| Option | Type | Description |
|--------|------|-------------|
| `--cache` | boolean | Enable caching for faster subsequent runs (default: true). |
| `--incremental` | boolean | Use TypeScript incremental compilation (default: true). |
| `--skip-unchanged` | boolean | Skip packages with no changes since last check (default: true). |
| `--build-mode` | boolean | Use tsc --build for project references (default: false). |

### Output Control

| Option | Type | Description |
|--------|------|-------------|
| `--verbose` | boolean | Verbose mode (default: false). |
| `--copy-logs` | boolean | Copy failed package logs to clipboard (default: true, skipped in CI). |

## Examples

### Basic usage
```bash
# Type check all packages
dler tsc

# Check specific packages
dler tsc --filter "@reliverse/ui,@reliverse/utils"

# Skip specific packages
dler tsc --ignore "@reliverse/docs"
```

### Performance optimization
```bash
# Custom concurrency
dler tsc --concurrency 4

# Auto-detect optimal concurrency
dler tsc --auto-concurrency

# Stop on first error
dler tsc --stop-on-error
```

### Caching control
```bash
# Disable caching
dler tsc --cache false

# Disable incremental compilation
dler tsc --incremental false

# Don't skip unchanged packages
dler tsc --skip-unchanged false
```

### Build mode
```bash
# Use TypeScript project references
dler tsc --build-mode
```

### Output options
```bash
# Verbose output
dler tsc --verbose

# Disable clipboard copying
dler tsc --copy-logs false
```

## Caching Behavior

### Incremental Compilation
- Tracks changes between runs for faster subsequent checks
- Maintains `.tsbuildinfo` files for incremental builds
- Can be disabled with `--incremental false`

### Change Detection
- Automatically skips packages with no file changes
- Uses file modification times for quick checks
- Can be bypassed with `--skip-unchanged false`

### Cache Management
- Persistent cache across command runs
- Optimized for monorepo workflows
- Can be disabled with `--cache false`

## Project References

When `--build-mode` is enabled:
- Uses `tsc --build` for project reference support
- Builds packages in dependency order
- Supports composite TypeScript projects
- Faster builds for large monorepos

## Error Reporting

### Clipboard Integration
- Automatically copies error logs to clipboard (except in CI)
- Facilitates sharing diagnostics with team members
- Can be disabled with `--copy-logs false`

### Error Collection
- Collects errors from all packages by default
- Stops on first error with `--stop-on-error`
- Provides detailed error messages per package

### Verbose Mode
- Shows detailed progress information
- Displays cache hit/miss statistics
- Reports timing information per package

## Configuration

TypeScript checking can be configured through `tsconfig.json` files in each package:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

For monorepos with project references:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

## Performance Tips

1. **Use caching**: Keep `--cache` and `--incremental` enabled for faster runs
2. **Optimize concurrency**: Use `--auto-concurrency` or set manually based on your CPU
3. **Enable build mode**: Use `--build-mode` for projects with TypeScript references
4. **Skip unchanged**: Let the system skip packages that haven't changed

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **TypeScript**: Must be available in each package (usually as a dev dependency)
- **Valid tsconfig.json**: Each package should have proper TypeScript configuration