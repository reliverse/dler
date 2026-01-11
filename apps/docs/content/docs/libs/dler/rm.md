---
title: "dler rm"
description: "Remove dependencies from package.json files with catalog support"
---

Remove dependencies from package.json files with intelligent catalog support and workspace-aware dependency management.

## Usage

```bash
dler rm <package> [package2...] [options]
```

## Description

The `rm` command intelligently removes dependencies from package.json files in monorepo workspaces. It supports catalog-based dependency management and can target specific workspace packages. If no scope is specified, it removes the package from all dependency sections.

## Options

### Target Selection

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--target <packages>` | `-t` | string | Target workspace package(s). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns. |
| `--package <packages>` |  | string | Alias for `--target` |
| `--pkg <packages>` |  | string | Alias for `--target` |
| `--w` |  | boolean | Remove dependency from root package.json |

### Catalog Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--catalog [name]` | `-c` | string \| boolean | Use catalog mode. Can be 'true', 'false', or a catalog name (e.g., 'testing'). Default: true |

### Dependency Scope

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--scope <type>` | `-s` | `'dev' \| 'prod' \| 'peer' \| 'optional'` | Dependency scope to remove from |
| `--dev` | `-D` | boolean | Remove from devDependencies |
| `--prod` | `-P` | boolean | Remove from dependencies |
| `--peer` | `-R` | boolean | Remove from peerDependencies |
| `--optional` | `-O` | boolean | Remove from optionalDependencies |

### Other Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--install` | `-i` | boolean | Run install after removing dependencies (default: true) |
| `--cwd <path>` |  | string | Working directory (monorepo root) |
| `--dry-run` | `-n` | boolean | Show what would be done without making changes |
| `--verbose` | `-v` | boolean | Verbose output |

## Examples

### Basic usage
```bash
# Remove a single dependency
dler rm lodash

# Remove multiple dependencies
dler rm react react-dom

# Remove from all scopes (default behavior)
dler rm typescript
```

### Dependency scopes
```bash
# Remove from dev dependencies
dler rm typescript --dev
# or
dler rm typescript -D

# Remove from peer dependencies
dler rm react --peer

# Remove from optional dependencies
dler rm some-optional-pkg --optional
```

### Target specific packages
```bash
# Remove from specific workspace package
dler rm lodash --target @scope/ui

# Remove from multiple packages
dler rm lodash --target "@scope/ui @scope/utils"

# Remove from current directory package
dler rm lodash --target .

# Remove from root package.json
dler rm lodash --w
```

### Catalog mode
```bash
# Use catalog mode (default)
dler rm lodash --catalog

# Use specific catalog
dler rm lodash --catalog testing

# Disable catalog mode
dler rm lodash --catalog false
```

### Advanced usage
```bash
# Dry run to see what would happen
dler rm lodash --dry-run

# Verbose output
dler rm lodash --verbose

# Don't install after removing
dler rm lodash --no-install
```

## Scope Behavior

### No Scope Specified (Default)
When no scope flags are provided, `dler rm` removes the package from **all** dependency sections where it exists:
- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

### Scope Specified
When a specific scope is provided, only that section is targeted:

```bash
# Only removes from devDependencies
dler rm typescript --dev

# Only removes from peerDependencies
dler rm react --peer
```

## Catalog Support

When catalog mode is enabled (default), dler considers catalog configurations when removing dependencies. This ensures consistency with catalog-managed version ranges.

## Workspace Support

In monorepo environments, dler automatically detects workspace packages and can target specific ones:

- Use `--target` to specify which packages should have the dependency removed
- Use glob patterns for targeting multiple packages: `--target "@scope/*"`
- Use `.` to target the current directory's package
- Use `--w` to target the workspace root

## Error Handling

The command provides helpful error messages and tips:

- Validates package names
- Checks if packages are actually installed
- Provides suggestions for common issues
- Supports dry-run mode for safe testing

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Valid project**: Must be run in a directory with package.json or in a monorepo root