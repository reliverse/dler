---
title: "dler add"
description: "Add dependencies to package.json files with catalog support"
---

Add dependencies to package.json files with intelligent catalog support and workspace-aware dependency management.

## Usage

```bash
dler add <package> [package2...] [options]
```

## Description

The `add` command intelligently adds dependencies to package.json files in monorepo workspaces. It supports catalog-based dependency management, automatic version resolution, and can target specific workspace packages.

## Options

### Target Selection

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--target <packages>` | `-t` | string | Target workspace package(s). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns. |
| `--package <packages>` |  | string | Alias for `--target` |
| `--pkg <packages>` |  | string | Alias for `--target` |
| `--w` |  | boolean | Add dependency to root package.json |

### Catalog Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--catalog [name]` | `-c` | string \| boolean | Use catalog mode. Can be 'true', 'false', or a catalog name (e.g., 'testing'). Default: true |

### Dependency Scope

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--scope <type>` | `-s` | `'dev' \| 'prod' \| 'peer' \| 'optional'` | Dependency scope |
| `--dev` | `-D` | boolean | Add as devDependency |
| `--prod` | `-P` | boolean | Add as dependency |
| `--peer` | `-R` | boolean | Add as peerDependency |
| `--optional` | `-O` | boolean | Add as optionalDependency |

### Version Control

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--prefix <prefix>` | `-p` | string | Version prefix (default: '^') |

### Other Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--install` | `-i` | boolean | Run install after adding dependencies (default: true) |
| `--cwd <path>` |  | string | Working directory (monorepo root) |
| `--dry-run` | `-n` | boolean | Show what would be done without making changes |
| `--verbose` | `-v` | boolean | Verbose output |

## Examples

### Basic usage
```bash
# Add a single dependency
dler add lodash

# Add multiple dependencies
dler add react react-dom

# Add with specific version
dler add typescript@latest
```

### Dependency scopes
```bash
# Add as dev dependency
dler add typescript --dev
# or
dler add typescript -D

# Add as peer dependency
dler add react --peer

# Add as optional dependency
dler add some-optional-pkg --optional
```

### Target specific packages
```bash
# Add to specific workspace package
dler add lodash --target @scope/ui

# Add to multiple packages
dler add lodash --target "@scope/ui @scope/utils"

# Add to current directory package
dler add lodash --target .

# Add to root package.json
dler add lodash --w
```

### Catalog mode
```bash
# Use catalog mode (default)
dler add lodash --catalog

# Use specific catalog
dler add lodash --catalog testing

# Disable catalog mode
dler add lodash --catalog false
```

### Advanced usage
```bash
# Add with custom version prefix
dler add lodash --prefix "~"

# Dry run to see what would happen
dler add lodash --dry-run

# Verbose output
dler add lodash --verbose

# Don't install after adding
dler add lodash --no-install
```

## Catalog Support

When catalog mode is enabled (default), dler looks for catalog configurations in your workspace root. Catalogs allow you to define version ranges for commonly used dependencies.

Example catalog configuration in `package.json`:

```json
{
  "catalog": {
    "lodash": "^4.17.0",
    "typescript": "^5.0.0"
  },
  "catalog:testing": {
    "jest": "^29.0.0"
  }
}
```

## Package Specifications

You can specify package versions directly:

```bash
# Specific version
dler add lodash@4.17.21

# Version range
dler add lodash@^4.17.0

# Tag
dler add typescript@next
```

## Workspace Support

In monorepo environments, dler automatically detects workspace packages and can target specific ones:

- Use `--target` to specify which packages should receive the dependency
- Use glob patterns for targeting multiple packages: `--target "@scope/*"`
- Use `.` to target the current directory's package
- Use `--w` to target the workspace root

## Error Handling

The command provides helpful error messages and tips:

- Validates package names
- Checks for valid project structure
- Provides suggestions for common issues
- Supports dry-run mode for safe testing

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Valid project**: Must be run in a directory with package.json or in a monorepo root