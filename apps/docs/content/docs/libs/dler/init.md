---
title: "dler init"
description: "Initialize a new Rempts CLI project"
---

Initialize a new Rempts CLI project with predefined templates and configurations.

## Usage

```bash
dler init [project-name] [options]
```

## Description

The `init` command creates a new Rempts CLI project by bootstrapping it with one of the available templates. This command is essentially a wrapper around the `@reliverse/rempts` project initializer, providing a streamlined experience for creating CLI tools.

## Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--name <name>` | `-n` | string | Project name |
| `--template <template>` | `-t` | `'basic' \| 'advanced' \| 'monorepo'` | Project template |
| `--dir <path>` | `-d` | string | Directory to create project in |
| `--git` | `-g` | boolean | Initialize git repository (default: true) |
| `--install` |  | boolean | Install dependencies (default: true) |
| `--package-manager <pm>` | `-p` | `'bun' \| 'pnpm' \| 'yarn' \| 'npm'` | Package manager to use |

## Templates

### `basic`
A minimal CLI project template with essential configurations.

### `advanced`
An advanced CLI project template with additional features and configurations.

### `monorepo`
A monorepo CLI project template for managing multiple packages.

## Examples

### Create a basic project
```bash
dler init my-cli-tool
```

### Create a project with specific template
```bash
dler init my-cli-tool --template advanced
```

### Create project in specific directory
```bash
dler init my-cli-tool --dir ./projects/my-tool
```

### Create project without git initialization
```bash
dler init my-cli-tool --no-git
```

### Create project without installing dependencies
```bash
dler init my-cli-tool --no-install
```

### Use specific package manager
```bash
dler init my-cli-tool --package-manager pnpm
```

## What happens

When you run `dler init`, it:

1. Calls `@reliverse/rempts` with the specified options
2. Creates a new project structure based on the chosen template
3. Initializes a git repository (unless `--no-git` is specified)
4. Installs dependencies using the specified package manager (unless `--no-install` is specified)
5. Provides next steps for getting started

## Next steps

After successful project creation:

```bash
cd <project-name>
@reliverse/rempts dev
```

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **@reliverse/rempts**: The underlying tool that handles project creation

## Related

- [`@reliverse/rempts`](https://github.com/reliverse/rempts) - The CLI project generator