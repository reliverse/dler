---
title: "dler senv"
description: "Inspect and modify environment variables"
---

Inspect and modify environment variables at both process and user-level with cross-platform support.

## Usage

```bash
dler senv --action <action> [options]
```

## Description

The `senv` command provides comprehensive environment variable management with support for both temporary process-level changes and persistent user-level modifications. It handles cross-platform differences between Windows and POSIX systems automatically.

## Options

### Action Control

| Option | Type | Description |
|--------|------|-------------|
| `--action <action>` | string | Operation to perform: list, get, set, append, remove, contains |

### Variable Control

| Option | Type | Description |
|--------|------|-------------|
| `--name <name>` | string | Environment variable name (optional for list) |
| `--value <value>` | string | Value for set/append/remove/contains operations |

### Persistence

| Option | Type | Description |
|--------|------|-------------|
| `--persist` | boolean | Persist change to user environment (default: true) |
| `--yes` | boolean | Skip interactive confirmation message |

## Examples

### Listing variables
```bash
# List all environment variables
dler senv --action list

# Show specific variable
dler senv --action list --name PATH
```

### Getting values
```bash
# Get variable value
dler senv --action get --name NODE_ENV
```

### Setting values
```bash
# Set variable for current process and persist to user environment
dler senv --action set --name MY_VAR --value "hello world"

# Set without persistence (process only)
dler senv --action set --name TEMP_VAR --value "temporary" --persist false

# Skip confirmation prompt
dler senv --action set --name MY_VAR --value "value" --yes
```

### Path manipulation
```bash
# Add to PATH (cross-platform)
dler senv --action append --name PATH --value "/usr/local/bin"

# Add to PATH on Windows
dler senv --action append --name Path --value "C:\Users\your-user-name\.local\bin"

# Remove from PATH
dler senv --action remove --name PATH --value "/usr/local/bin"
```

### Checking contents
```bash
# Check if PATH contains specific directory
dler senv --action contains --name PATH --value "/usr/local/bin"
```

## Actions

### `list`
Display environment variables.

```bash
# All variables (alphabetically sorted)
dler senv --action list

# Specific variable
dler senv --action list --name HOME
```

### `get`
Retrieve the value of a specific environment variable.

```bash
dler senv --action get --name NODE_ENV
# Output: development
```

### `set`
Set an environment variable value.

```bash
dler senv --action set --name API_URL --value "https://api.example.com"
```

By default, changes are persisted to the user environment and applied to the current process.

### `append`
Add an entry to a PATH-like variable (semicolon/colon separated).

```bash
# Add directory to PATH
dler senv --action append --name PATH --value "/opt/myapp/bin"
```

Handles duplicates and maintains proper path separators.

### `remove`
Remove an entry from a PATH-like variable.

```bash
# Remove directory from PATH
dler senv --action remove --name PATH --value "/opt/myapp/bin"
```

### `contains`
Check if a PATH-like variable contains a specific entry.

```bash
dler senv --action contains --name PATH --value "/usr/local/bin"
# Exit code: 0 (found) or 1 (not found)
```

## Platform Support

### Windows
- Uses PowerShell for user environment modifications
- Handles PATH variable case-insensitively
- Supports both forward and backward slashes
- Creates backups of modified files

### POSIX (Linux/macOS)
- Modifies `~/.profile` for persistence
- Uses colon (`:`) as path separator
- Creates timestamped backups
- Handles shell variable escaping

## Persistence

### User Environment
Changes are persisted to the user environment by default:

- **Windows**: Registry (user-level environment variables)
- **POSIX**: `~/.profile` with proper export statements

### Process Environment
Changes are applied to the current process immediately.

### Backup Creation
Before modifying any files, the command creates timestamped backups:

```
.profile.bak.2024-01-11T10-30-45-123Z.abc123
```

## Safety Features

### Confirmation Prompts
- Interactive confirmation before persisting changes
- Can be skipped with `--yes` flag
- Clear messaging about what will be modified

### Backup Creation
- Automatic backup of modified files
- Timestamped and randomized backup names
- Prevents accidental data loss

### Duplicate Prevention
- Prevents duplicate entries in PATH-like variables
- Case-insensitive comparison on Windows
- Maintains entry order

## Path Handling

### Normalization
- Normalizes path separators (forward/backward slashes)
- Trims whitespace
- Removes empty entries

### Case Sensitivity
- **Windows**: Case-insensitive PATH operations
- **POSIX**: Case-sensitive operations

### Separator Handling
- **Windows**: Uses semicolon (`;`)
- **POSIX**: Uses colon (`:`)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Entry not found (contains action) |
| 2 | Invalid arguments |
| 3 | Fatal error |

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Platform-specific tools**: PowerShell on Windows, shell access on POSIX
- **File system permissions**: Write access to profile files and registry

## Common Use Cases

### Development Setup
```bash
# Add local bin directory to PATH
dler senv --action append --name PATH --value "$HOME/.local/bin"

# Set development environment
dler senv --action set --name NODE_ENV --value "development"
```

### Tool Installation
```bash
# Add tool to PATH after installation
dler senv --action append --name PATH --value "/opt/my-tool/bin"
```

### Temporary Overrides
```bash
# Temporary environment override (process only)
dler senv --action set --name DEBUG --value "*" --persist false
```

## Troubleshooting

### Permission Issues
- Ensure write access to profile files (`~/.profile`)
- On Windows, run as administrator for system-wide changes
- Check PowerShell execution policy

### Path Issues
- Use absolute paths when possible
- Verify path separators match platform conventions
- Check for conflicting entries

### Persistence Problems
- Verify backup files weren't corrupted
- Check shell configuration loading
- Restart shell sessions after changes