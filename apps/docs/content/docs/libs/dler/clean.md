---
title: "dler clean"
description: "Clean build artifacts and generated files from workspace packages"
---

Clean build artifacts and generated files from workspace packages with support for presets and custom patterns.

## Usage

```bash
dler clean [options]
```

## Description

The `clean` command removes build artifacts, generated files, and other temporary content from workspace packages. It supports predefined presets for common cleanup scenarios and allows custom patterns for specific needs. Works in both monorepo and single-repo modes.

## Options

### Package Selection

| Option | Type | Description |
|--------|------|-------------|
| `--filter <packages>` | string | Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore when both are provided. |
| `--ignore <packages>` | string | Package(s) to ignore (supports wildcards like @reliverse/*) |

### Cleaning Options

| Option | Type | Description |
|--------|------|-------------|
| `--presets <presets>` | string | Comma-separated presets to clean: build,db,cms,frontend,docs,email,build-tools,deps,all |
| `--custom <patterns>` | string | Comma-separated custom patterns to clean (e.g., 'dist/,*.log,node_modules/') |

### Directory Control

| Option | Type | Description |
|--------|------|-------------|
| `--cwd <path>` | string | Working directory (monorepo root) |
| `--subdirs` | boolean | Search recursively in subdirectories (single-repo mode only) |

### Safety Options

| Option | Type | Description |
|--------|------|-------------|
| `--dry-run` | boolean | Preview what would be deleted without actually deleting |
| `--force` | boolean | Required flag to proceed with deletion (no prompts, args-only) |
| `--verbose` | boolean | Verbose mode with detailed logging |

### Special Options

| Option | Type | Description |
|--------|------|-------------|
| `--delete-lock-files` | boolean | Include lock files (bun.lock, package-lock.json, etc.) when using deps preset |
| `--replace-exports` | boolean | Replace exports from ./src/*.ts to ./dist/*.js before cleaning (default: true) |
| `--replace-exports-ignore-packages <packages>` | string | Packages to ignore when replacing exports (supports glob patterns like @reliverse/*) |

## Presets

### `build`
Cleans common build artifacts:
- `dist/`, `dist-*`, `build/`, `out/`
- `.tsbuildinfo`, `*.tsbuildinfo`
- TypeScript cache files

### `db`
Cleans database-related files:
- SQLite files: `*.db`, `*.sqlite`, `*.sqlite3`
- Database logs and temp files

### `cms`
Cleans content management system files:
- `content/`, `contents/`
- CMS cache and temp directories

### `frontend`
Cleans frontend build artifacts:
- `node_modules/.vite`, `.next/`, `nuxt/`
- Frontend cache directories
- Generated CSS and JS files

### `docs`
Cleans documentation build files:
- `docs/.vitepress/dist/`, `docs/build/`
- Generated documentation files

### `email`
Cleans email-related build artifacts:
- Email template caches
- Generated email files

### `build-tools`
Cleans build tool caches:
- `.turbo/`, `.cache/`
- Build tool configuration caches

### `deps`
Cleans dependency-related files:
- `node_modules/` (unless `--delete-lock-files` is specified)
- Lock files (when `--delete-lock-files` is used): `bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`

### `all`
Applies all presets for a complete cleanup.

## Examples

### Basic usage
```bash
# Clean build artifacts
dler clean --presets build

# Clean multiple preset types
dler clean --presets build,frontend

# Clean everything
dler clean --presets all
```

### Custom patterns
```bash
# Clean custom patterns
dler clean --custom "dist/,*.log,temp/"

# Combine presets and custom patterns
dler clean --presets build --custom "*.tmp,logs/"
```

### Package targeting
```bash
# Clean specific packages
dler clean --filter "@reliverse/ui,@reliverse/utils"

# Ignore specific packages
dler clean --ignore "@reliverse/docs" --presets build

# Clean only current directory (single-repo mode)
dler clean --presets build
```

### Safety and preview
```bash
# Preview what would be deleted
dler clean --presets build --dry-run

# Force deletion without prompts
dler clean --presets build --force

# Verbose output
dler clean --presets build --verbose
```

### Special scenarios
```bash
# Clean dependencies including lock files
dler clean --presets deps --delete-lock-files

# Skip export replacement
dler clean --presets build --replace-exports false

# Clean recursively in subdirectories
dler clean --presets build --subdirs
```

## Export Replacement

By default, the clean command replaces exports in `package.json` from `./dist/*.js` to `./src/*.ts` before cleaning. This ensures that the package can still function during development after build artifacts are removed.

To skip this behavior:
```bash
dler clean --presets build --replace-exports false
```

You can also ignore specific packages from export replacement:
```bash
dler clean --replace-exports-ignore-packages "@reliverse/docs"
```

## Monorepo vs Single-repo

### Monorepo Mode (default)
- Automatically detects workspace packages
- Uses `--filter` and `--ignore` to control which packages to clean
- Processes packages concurrently

### Single-repo Mode
- Use `--subdirs` to search recursively in subdirectories
- Operates on the current directory

## Safety Features

- **Dry-run mode**: Preview deletions before they happen
- **Force flag required**: Must explicitly use `--force` to delete files
- **Verbose logging**: See exactly what files are being processed
- **Selective targeting**: Clean only specific packages or directories

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **File system permissions**: Must have write permissions for the directories being cleaned