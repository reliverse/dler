# File-Based Commands Example

This example demonstrates how to use file-based command loading in @rempts.

## Structure

```
commands/
├── build.ts           # Top-level build command
├── build/
│   └── cmd.ts         # Nested build cmd command
└── test.ts            # Top-level test command
```

## Usage

```bash
# Run the CLI
bun run start

# Run build command
bun run start build

# Run nested build cmd command
bun run start build cmd

# Run test command
bun run start test
```

## Configuration

The `commands.directory` option in `createCLI()` enables automatic command discovery from the `./commands` directory.

```typescript
const cli = await createCLI({
  name: "my-cli",
  version: "1.0.0",
  commands: {
    directory: "./commands", // Enable file-based loading
  },
});
```

## Features

- **Automatic Discovery**: Commands are automatically discovered from the directory structure
- **Nested Commands**: Directory structure creates nested command hierarchies
- **Multiple Extensions**: Supports `.ts`, `.js`, and `.mjs` files
- **Conflict Detection**: Throws errors when commands conflict between files
- **Mixed Usage**: Can combine with manifest-based loading
