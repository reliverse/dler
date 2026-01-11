---
title: "dler unused"
description: "Find unused dependencies in package.json files"
---

Find unused dependencies in package.json files with intelligent code analysis and scope filtering.

## Usage

```bash
dler unused [options]
```

## Description

The `unused` command analyzes your codebase to identify dependencies that are declared in package.json but not actually used in your code. It supports workspace packages, scope filtering, and customizable ignore lists.

## Options

### Target Selection

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--target <packages>` | `-t` | string | Target workspace package(s). Use '.' for current directory package. Supports multiple packages (space-separated) and glob patterns. |
| `--package <packages>` |  | string | Alias for `--target` |
| `--pkg <packages>` |  | string | Alias for `--target` |
| `--w` |  | boolean | Check unused dependencies in root package.json |

### Scope Filtering

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--scope <type>` | `-s` | `'dev' \| 'prod' \| 'peer' \| 'optional'` | Check specific dependency scope |
| `--dev` | `-D` | boolean | Check only devDependencies |
| `--prod` | `-P` | boolean | Check only dependencies |
| `--peer` | `-R` | boolean | Check only peerDependencies |
| `--optional` | `-O` | boolean | Check only optionalDependencies |

### Analysis Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--ignore <packages>` | `-i` | string | Comma-separated list of package names to ignore when checking |
| `--include-peer` |  | boolean | Include peerDependencies in the analysis (default: false) |

### Other Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--cwd <path>` |  | string | Working directory (monorepo root) |
| `--verbose` | `-v` | boolean | Verbose output |

## Examples

### Basic usage
```bash
# Check all dependencies in current package
dler unused

# Check specific workspace packages
dler unused --target "@reliverse/ui,@reliverse/utils"

# Check root package.json
dler unused --w
```

### Scope filtering
```bash
# Check only production dependencies
dler unused --prod

# Check only dev dependencies
dler unused --dev

# Check specific scope
dler unused --scope optional

# Include peer dependencies
dler unused --include-peer
```

### Ignoring packages
```bash
# Ignore specific packages
dler unused --ignore "lodash,chalk"

# Ignore multiple packages with different scopes
dler unused --dev --ignore "@types/node,@types/react"
```

### Advanced usage
```bash
# Verbose output with detailed analysis
dler unused --verbose

# Check current directory package explicitly
dler unused --target .

# Combine with scope filtering
dler unused --target "@reliverse/*" --dev --verbose
```

## Analysis Behavior

### Code Analysis
The command analyzes your source code to determine which dependencies are actually used:

- **Imports**: `import`, `require()`, dynamic imports
- **Type references**: TypeScript type imports and references
- **Binary usage**: Executables called via package.json scripts
- **Configuration**: Dependencies referenced in config files

### Smart Detection
- Recognizes different import patterns and module systems
- Handles TypeScript path mapping and aliases
- Considers package.json script references
- Accounts for conditional imports and dynamic requires

### Scope Handling
- **devDependencies**: Checked by default unless `--prod` is specified
- **dependencies**: Always checked (unless scope-filtered)
- **peerDependencies**: Excluded by default, include with `--include-peer`
- **optionalDependencies**: Checked by default unless `--prod` is specified

## Output Format

The command provides detailed reports:

```
🔍 Finding unused dependencies...

📦 @reliverse/ui
  ❌ lodash (devDependency) - not used in code
  ❌ chalk (dependency) - not used in code

📦 @reliverse/utils
  ✅ All dependencies are used

📊 Summary: 2 unused, 15 used
```

## Ignoring Dependencies

### Common Ignore Patterns
```bash
# Build tools that might not be directly imported
dler unused --ignore "typescript,esbuild,rollup"

# CLI tools used in scripts
dler unused --ignore "husky,lint-staged,commitizen"

# Type definitions
dler unused --ignore "@types/node,@types/react,@types/jest"
```

### Configuration-Based Ignoring
You can maintain ignore lists for consistent analysis:

```bash
# Create a standard ignore list
dler unused --ignore "typescript,@types/node,@types/react,husky,lint-staged"
```

## Workspace Support

In monorepo environments:
- Automatically detects workspace packages
- Can target specific packages with `--target`
- Analyzes each package independently
- Provides per-package reports

## Performance Considerations

- Analyzes all source files in each package
- Respects `.gitignore` patterns
- Excludes `node_modules` and build directories
- Uses efficient AST parsing for import detection

## Limitations

- **Dynamic imports**: May not detect all dynamically imported modules
- **String references**: Cannot detect dependencies referenced as strings
- **Plugin systems**: May miss dependencies used by plugins or frameworks
- **Build tools**: Some build-time dependencies might be flagged incorrectly

## Best Practices

1. **Regular checks**: Run periodically to keep dependencies clean
2. **Review before removal**: Always verify before removing flagged dependencies
3. **Use ignore lists**: Maintain consistent ignore patterns for your project
4. **CI integration**: Add to CI pipeline to prevent unused dependency accumulation

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Valid package.json**: Must have package.json with dependencies
- **Source code**: Requires access to source files for analysis