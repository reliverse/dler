---
title: "dler test"
description: "Run tests for your CLI"
---

Run tests for your CLI project with support for workspace testing, watch mode, and coverage reports.

## Usage

```bash
dler test [options]
```

## Description

The `test` command runs tests using Bun's test runner with support for workspace packages, watch mode, coverage reporting, and various testing options.

## Options

### Test Selection

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--pattern <patterns>` | `-p` | string \| string[] | Test file patterns (default: "**/*.test.ts"). |
| `--all` |  | boolean | Run tests in all packages (workspace mode). |

### Test Behavior

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--watch` | `-w` | boolean | Watch for changes and re-run tests. |
| `--coverage` | `-c` | boolean | Generate coverage report. |
| `--bail` | `-b` | boolean | Stop on first failure. |
| `--timeout <ms>` |  | number | Test timeout in milliseconds. |

## Examples

### Basic usage
```bash
# Run all tests
dler test

# Run specific test files
dler test --pattern "src/**/*.test.ts"

# Run multiple patterns
dler test --pattern "src/**/*.test.ts" --pattern "lib/**/*.test.ts"
```

### Watch mode
```bash
# Watch for changes
dler test --watch

# Watch with coverage
dler test --watch --coverage
```

### Coverage reports
```bash
# Generate coverage report
dler test --coverage
```

### Error handling
```bash
# Stop on first failure
dler test --bail

# Set test timeout
dler test --timeout 5000
```

### Workspace testing
```bash
# Run tests in all workspace packages
dler test --all

# Run tests in all packages with bail
dler test --all --bail
```

## Test Patterns

The `--pattern` option supports glob patterns for test file discovery:

```bash
# Default pattern
dler test

# Custom patterns
dler test --pattern "**/*.spec.ts"
dler test --pattern "test/**/*.js"
dler test --pattern "src/**/test.ts"

# Multiple patterns
dler test --pattern "**/*.test.ts" --pattern "**/*.spec.ts"
```

## Workspace Mode

When using `--all`, the command will:

1. Find all workspace packages defined in your `dler.ts` config
2. Run tests in each package directory
3. Report results per package
4. Continue with other packages if one fails (unless `--bail` is used)

## Configuration

Test behavior can be configured in your `dler.ts` file:

```typescript
export default defineConfig({
  test: {
    pattern: "**/*.test.ts",
    watch: false,
    coverage: false,
  }
})
```

Command-line flags will override configuration values.

## Output

The command provides detailed test results:

- **Passed tests**: `✓ N tests passed`
- **Failed tests**: `✗ N tests failed`
- **Skipped tests**: `⊝ N tests skipped`

In workspace mode, results are shown per package:
```
✓ packages/ui tests passed
✓ packages/utils tests passed
✗ packages/core tests failed
```

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Test files**: Test files should be written for Bun's test runner
- **Valid project**: Must be run in a directory with proper test setup