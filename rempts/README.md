# Rempts

> The Complete CLI Development Ecosystem for Bun

Rempts is a minimal, type-safe CLI framework designed specifically for Bun. It leverages Bun's unique features like the Bun Shell, fast startup times, and native TypeScript support to create efficient command-line tools that compile to standalone binaries.

## Packages

### Core

- **[rempts-core](./packages/core)** - Core framework with type-safe command definitions
- **[rempts-utils](./packages/utils)** - Shared utilities (prompts, spinners, colors)
- **[rempts-test](./packages/test)** - Testing utilities for CLI applications
- **[rempts-generator](./packages/generator)** - Generate TypeScript definitions from commands

### Plugins

- **[rempts-plugin-ai-detect](./packages/plugin-ai-detect)** - Detect AI coding assistants
- **[rempts-plugin-config](./packages/plugin-config)** - Configuration file loading and merging

## Getting Started

```bash
# Install Rempts CLI globally
bun add -g rempts

# Create a new CLI project
bunx rempts my-cli

# Start development
cd my-cli
rempts dev
```

## Development

This is a monorepo managed with Bun workspaces.

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Start development
bun run dev
```

## Thanks

Thanks to [Dler](https://github.com/reliverse/dler), which `rempts` v2+ builds upon, [OpenTUI](https://github.com/anomalyco/opentui) for the great TUI library, [Bun](https://bun.com) for the incredibly fast JavaScript runtime, and the entire open-source community for making projects like these possible ❤️

## License

MIT
