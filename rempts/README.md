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

## Examples

rempts is validator agnostic. It uses [Standard Schema v1](https://github.com/standard-schema/spec) for validation under the hood, so you can use any validator you want.

```typescript
import { defineCommand, option } from '@reliverse/rempts-core'
import { z } from 'zod'

export default defineCommand({
  name: 'greet',
  description: 'A friendly greeting',
  options: {
    name: option(z.string()),
  },
})
```

**Supported types:**
- Booleans: default: true or default: false
- Strings: default: "some-string"
- Numbers: default: 42 or default: 8080
- Arrays: default: ["item1", "item2"]
- Objects: default: { key: "value" }
- **Any type** that your validator supports

```typescript
#!/usr/bin/env bun

// Test file to verify default values work for all types
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

// This demonstrates that defaults work for all types
const testCommand = defineCommand({
  description: "Test defaults for all types",
  options: {
    // Boolean default
    enabled: option(type("boolean | undefined"), {
      description: "Enable feature",
      default: true,
    }),

    // String default
    name: option(type("string | undefined"), {
      description: "Name",
      default: "default-name",
    }),

    // Number default
    port: option(type("number | undefined"), {
      description: "Port number",
      default: 8080,
    }),

    // Array default (if schema supports it)
    tags: option(type("string[] | undefined"), {
      description: "Tags",
      default: ["default", "tag"],
    }),

    // No default (should be undefined or false for boolean)
    optional: option(type("string | undefined"), {
      description: "Optional value",
    }),

    // Boolean without default (should default to false)
    flag: option(type("boolean | undefined"), {
      description: "Flag without default",
    }),
  },
  handler: async ({ flags }) => {
    console.log("=== Default Values Test ===");
    console.log("enabled (boolean default: true):", flags.enabled, typeof flags.enabled);
    console.log("name (string default: 'default-name'):", flags.name, typeof flags.name);
    console.log("port (number default: 8080):", flags.port, typeof flags.port);
    console.log("tags (array default):", flags.tags, Array.isArray(flags.tags));
    console.log("optional (no default):", flags.optional, typeof flags.optional);
    console.log("flag (boolean no default):", flags.flag, typeof flags.flag);

    // Type checks
    const checks = [
      ["enabled", flags.enabled === true],
      ["name", flags.name === "default-name"],
      ["port", flags.port === 8080],
      ["tags", Array.isArray(flags.tags) && flags.tags.length === 2],
      ["optional", flags.optional === undefined],
      ["flag", flags.flag === false], // Boolean without default should be false
    ];

    console.log("\n=== Type Checks ===");
    let allPassed = true;
    for (const [name, passed] of checks) {
      const status = passed ? "✓" : "✗";
      console.log(`${status} ${name}:`, passed ? "correct" : "WRONG");
      if (!passed) allPassed = false;
    }

    console.log(`\n${allPassed ? "✅ All defaults work correctly!" : "❌ Some defaults failed!"}`);
  },
});

export default testCommand;
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
```

## License

MIT
