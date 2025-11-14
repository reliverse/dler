# CLI App Example

This is an example CLI application demonstrating the usage of `@reliverse/dler-prompt` and `@reliverse/dler-launcher` packages.

## Features

- **Command-based architecture** using `@reliverse/dler-launcher`
- **Interactive prompts** using `@reliverse/dler-prompt`:
  - `selectPrompt` - Single selection from options
  - `multiselectPrompt` - Multiple selections from options
  - `confirmPrompt` - Yes/No confirmation
  - `askQuestion` - Text input prompt

## Commands

### `interactive`
Demonstrates all interactive prompt types.

```bash
bun src/index.ts interactive
```

### `setup`
Interactive project setup wizard.

```bash
bun src/index.ts setup
bun src/index.ts setup --template basic
bun src/index.ts setup --skip-prompts
```

### `todo`
Interactive todo list manager with add, list, complete, delete, and clear actions.

```bash
bun src/index.ts todo add
bun src/index.ts todo list
bun src/index.ts todo complete
bun src/index.ts todo delete
bun src/index.ts todo clear
```

### `config`
Configuration management with interactive prompts.

```bash
bun src/index.ts config list
bun src/index.ts config set --key theme --value dark
bun src/index.ts config get --key theme
bun src/index.ts config reset
```

## Development

```bash
# Run in development mode
bun src/index.ts <command>

# Build for production
bun run build

# Run built executable
bun run start
```

## Project Structure

```text
cli-app/
├── src/
│   ├── index.ts          # Main entry point using runLauncher
│   └── cmds/             # Command definitions
│       ├── interactive/
│       │   └── cmd.ts
│       ├── setup/
│       │   └── cmd.ts
│       ├── todo/
│       │   └── cmd.ts
│       └── config/
│           └── cmd.ts
├── package.json
└── tsconfig.json
```

## How It Works

1. **Launcher**: The `runLauncher` function discovers commands from the `./cmds` directory
2. **Commands**: Each command is in its own directory (`cmds/<cmd-name>/cmd.ts`) and exports a default command definition using `defineCmd`
3. **Prompts**: Commands use various prompt functions for interactive user input
4. **Arguments**: Commands define their arguments using `defineCmdArgs` with validation

This example showcases how to build a fully interactive CLI application with a clean command structure and rich user interactions.
