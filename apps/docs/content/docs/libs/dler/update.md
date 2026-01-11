---
title: "dler update"
description: "Update all dependencies to their latest versions across all package.json files"
---

Update all dependencies to their latest versions across all package.json files with intelligent filtering and batch processing.

## Usage

```bash
dler update [options]
```

## Description

The `update` command finds all package.json files in your workspace and updates dependencies to their latest versions. It supports selective updates with glob patterns, comprehensive filtering options, and works across monorepo and single-repo setups.

## Philosophy

"Find all package.json files, update everything you find, skip only non-updateable specifiers (workspace:, catalog:, npm:, etc.)"

## Options

### Update Control

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--name <patterns>` |  | string | Specific dependencies to update, supports glob patterns (e.g. '@types/*', 'react*'). Can be specified multiple times or comma-separated. |
| `--ignore <patterns>` |  | string | Dependencies to exclude from updates, supports glob patterns (e.g. 'eslint-*', '@types/*') |
| `--allow-major` |  | boolean | Allow major version updates (default: true) |
| `--ignore-fields <fields>` |  | string | Dependency fields to ignore (e.g., 'peerDependencies,catalog') |

### Behavior Control

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--ci` |  | boolean | Run in CI mode (non-interactive) |
| `--cwd <path>` |  | string | Working directory |
| `--dry-run` | `-n` | boolean | Preview updates without making changes |
| `--install` | `-i` | boolean | Run install after updating (default: true) |
| `--details` | `-d` | boolean | Show detailed dependency information |
| `--verbose` | `-v` | boolean | Verbose output (shows install command output) |

## Examples

### Basic usage
```bash
# Update all dependencies in all package.json files
dler update

# Preview what would be updated
dler update --dry-run

# Update with detailed information
dler update --details
```

### Selective updates
```bash
# Update only specific packages
dler update --name "react,react-dom"

# Update packages matching glob patterns
dler update --name "@types/*"

# Update multiple patterns
dler update --name "eslint-*" --name "prettier-*"

# Exclude specific packages
dler update --ignore "eslint-*" --ignore "@types/*"
```

### Advanced usage
```bash
# Update only in current directory
dler update --cwd .

# Skip installation after update
dler update --no-install

# Verbose output
dler update --verbose

# Ignore certain dependency fields
dler update --ignore-fields "peerDependencies,catalog"
```

### CI/CD usage
```bash
# Non-interactive mode for CI
dler update --ci

# Dry run for CI validation
dler update --dry-run --ci
```

## Update Behavior

### Version Specifiers
The command intelligently handles different version specifier types:

- **Updatable**: `^1.0.0`, `~1.0.0`, `1.0.0`, `latest`
- **Skipped**: `workspace:*`, `catalog:*`, `npm:*`, `file:*`, `git+ssh://...`

### Dependency Fields
By default, updates all dependency fields:
- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

Use `--ignore-fields` to exclude specific fields from updates.

### Major Version Updates
- **Default**: Major updates are allowed (`--allow-major` is true by default)
- **Safety**: The command respects semantic versioning and only suggests updates that are likely safe

## Scope Detection

### Monorepo Mode
- Automatically finds all package.json files in the workspace
- Processes packages in parallel for optimal performance
- Updates dependencies across all packages simultaneously

### Single-repo Mode
- Limits scope to the current directory if it contains a package.json
- Faster processing for smaller projects

## Output Formats

### Standard Output
Shows a summary of updates per package.json file:
```
Updated 3 dependencies in packages/ui/package.json: react→18.2.0, react-dom→18.2.0, lodash→4.17.21
Updated 1 dependency in packages/utils/package.json: typescript→5.0.2
```

### Detailed Output (`--details`)
Shows comprehensive information including:
- Current version
- Latest version
- Version specifiers
- Update status
- Error information

### Verbose Output (`--verbose`)
Includes installation command output and additional processing information.

## Caching

The command uses persistent caching to optimize performance:
- Caches package registry information
- Reduces API calls for repeated updates
- Automatically manages cache lifecycle

## Error Handling

- **Graceful failures**: Individual file failures don't stop the entire process
- **Detailed errors**: Shows specific error information for failed updates
- **Recovery**: Continues processing other files even if some fail

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Network access**: Needs internet access to check package registries
- **Valid package.json**: Must have at least one valid package.json file

## Performance

- **Parallel processing**: Updates multiple files concurrently
- **Batch operations**: Optimizes registry API calls
- **Smart filtering**: Only processes relevant dependencies
- **Caching**: Reduces redundant network requests