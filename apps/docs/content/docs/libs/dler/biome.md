---
title: "dler biome"
description: "Run Biome linting and formatting check on workspace"
---

Run Biome linting and formatting check on workspace packages with diagnostic reporting and clipboard integration.

## Usage

```bash
dler biome [options]
```

## Description

The `biome` command runs Biome's linting and formatting checks across your workspace, providing comprehensive code quality analysis with detailed diagnostics and optional clipboard integration for easy issue tracking.

## Options

| Option | Type | Description |
|--------|------|-------------|
| `--cwd <path>` | string | Working directory to run biome from (default: current directory). |
| `--verbose` | boolean | Verbose mode (default: false). |
| `--copy-logs` | boolean | Copy diagnostics to clipboard (default: true, skipped in CI). |

## Examples

### Basic usage
```bash
# Run biome check on current directory
dler biome

# Run on specific directory
dler biome --cwd packages/ui

# Verbose output
dler biome --verbose
```

### Clipboard integration
```bash
# Copy diagnostics to clipboard (default)
dler biome

# Disable clipboard copying
dler biome --copy-logs false

# Force clipboard copying even in CI
dler biome --copy-logs
```

## Behavior

### CI Environment Detection
- Automatically detects CI environments (`CI=true` or non-TTY)
- Skips clipboard operations in CI by default
- Can be overridden with `--copy-logs` flag

### Diagnostic Reporting
- Runs Biome's comprehensive linting and formatting checks
- Reports all issues found across the workspace
- Provides detailed error and warning information

### Clipboard Integration
When enabled, copies diagnostic output to system clipboard for:
- Easy sharing with team members
- Quick reference during development
- Integration with issue tracking systems

## Configuration

Biome behavior is controlled by your `biome.json` configuration file:

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false
  }
}
```

## Exit Codes

- **0**: All checks passed successfully
- **1**: Linting or formatting issues found

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Biome**: Must be available in the project (usually as a dev dependency)
- **biome.json**: Optional configuration file for custom rules