# Rempts Examples

This directory contains example Rempts CLI applications demonstrating various features and patterns, organized from simple to complex.

## Examples Overview

### hello-world

The absolute simplest possible Rempts CLI with a single command. Perfect starting point to understand the basics.

- Basic command definition
- Simple flag handling
- Minimal configuration
- Type generation for enhanced DX

### task-runner

A practical task automation CLI showcasing validation and interactivity patterns.

- Schema validation with Zod
- Interactive prompts and confirmations
- Progress indicators and spinners
- Build, test, deploy, and setup workflows
- Conditional flows based on options

### git-tool

A Git workflow helper demonstrating command organization and external tool integration.

- Nested command structure
- Command aliases
- Integration with external tools (git)
- Shell command execution
- Colored output for status

### dev-server

A development server CLI showcasing advanced plugin system and configuration management.

- Plugin system with lifecycle hooks
- Type-safe plugin context
- Configuration management
- Long-running processes
- Real-time updates and log following

## Getting Started

Each example demonstrates the recommended Rempts development workflow:

```bash
# Navigate to an example
cd hello-world

# Install dependencies (includes rempts CLI)
bun install

# Generate types (creates .dler/commands.gen.ts)
bun run generate

# Start development with hot reload
bun run dev

# Build for production
bun run build

# Run the built executable
bun run start

# Or run directly (without hot reload)
bun cli.ts
```

All examples include:

- `dler.config.ts` - Configuration with required `commands.directory`
- `commands/` directory - All command definitions (REQUIRED structure)
- `.dler/commands.gen.ts` - Generated TypeScript definitions (auto-created)
- Development scripts using `rempts dev` for hot reload
- Build scripts using `rempts build` for production
- Type generation for enhanced developer experience

## Progression Path

Follow this learning path to master Rempts:

1. **hello-world** (5 min) - Learn the absolute basics
2. **task-runner** (15 min) - Validation and interactivity
3. **git-tool** (15 min) - Command structure and organization
4. **dev-server** (20 min) - Plugins and advanced patterns

Each example builds on the previous concepts and introduces new patterns.

## Key Concepts

### Schema-Driven Options

Rempts uses Standard Schema for validation, allowing you to use any compatible validation library:

```typescript
import { defineCommand, option } from '@reliverse/rempts-core'
import { z } from 'zod'

export default defineCommand({
  options: {
    port: option(
      z.number().min(1000).max(65535),
      { short: 'p', description: 'Port number' }
    )
  }
})
```

### Command Organization

For larger CLIs, organize commands in a clear structure:

```typescript
// commands/mod.ts
export const commands = [
  buildCommand,
  testCommand,
  deployCommand
]
```

### Interactive Prompts

Create engaging CLI experiences with built-in prompts:

```typescript
const name = await prompt.text('What is your name?')
const color = await prompt.select('Favorite color?', ['red', 'green', 'blue'])
const confirmed = await prompt.confirm('Continue?')
```

### Plugin System

Extend functionality with type-safe plugins:

```typescript
import { createPlugin } from '@reliverse/rempts-core/plugin'

export const myPlugin = createPlugin({
  name: 'my-plugin',
  store: { count: 0 },
  beforeCommand({ store }) {
    store.count++
  }
})
```

## Building for Distribution

All examples use `dler.config.ts` for build configuration:

```typescript
// dler.config.ts
import { defineConfig } from '@reliverse/rempts-core'

export default defineConfig({
  name: 'my-cli',
  version: '1.0.0',
  description: 'My awesome CLI',

  // REQUIRED: commands directory
  commands: {
    directory: './commands'
  },

  // REQUIRED: plugins array (can be empty)
  plugins: [],

  build: {
    entry: './cli.ts',
    outdir: './dist',
    targets: ['native'],  // Default target
    compress: false,      // Default: false
    minify: false,        // Default: false
    sourcemap: true       // Default: true
  },

  dev: {
    watch: true,
    inspect: false
  }
})
```

Build commands:

```bash
# Build for current platform
bun run build

# Build for specific platforms
rempts build --targets darwin-arm64,linux-x64

# Build for all platforms
rempts build --targets all

# Build with custom settings
rempts build --minify --sourcemap
```

The Rempts CLI handles:

- Hot reload in development (`rempts dev`)
- Standalone executable creation with Bun's `--compile` flag
- Multi-platform builds
- Automatic compression for releases

## Learn More

- [Rempts Documentation](https://rempts.dev)
- [Standard Schema](https://github.com/standard-schema/standard-schema)
- [Bun Documentation](https://bun.sh)

## Thanks

Thanks to [Bunli](https://github.com/reliverse/bunli), which `@reliverse/rempts` v2+ builds upon, [OpenTUI](https://github.com/anomalyco/opentui) for the great TUI library, [Bun](https://bun.com) for the incredibly fast JavaScript runtime, and the entire open-source community for making projects like these possible ❤️

## License

MIT
