# Hello World - Rempts CLI

The absolute simplest Rempts CLI example. Perfect for understanding the basics in under 30 seconds.

## Quick Start

```bash
# Install dependencies
bun install

# Run the CLI
bun cli.ts greet --name "World" --loud

# Or with short flags
bun cli.ts greet -n "Rempts" -l -t 3
```

## What This Example Shows

- **Single command** with basic options
- **Schema validation** using Zod
- **Type coercion** (string → boolean, string → number)
- **Default values** and **short flags**
- **Colored output** with built-in utilities

## The Command

```typescript
const greetCommand = defineCommand({
  name: 'greet' as const,
  description: 'A minimal greeting CLI',
  options: {
    name: option(type("string", "=", "world")),
    loud: option(type("boolean", "=", false), {
      short: 'l',
      description: 'Shout the greeting'
    }),
    times: option(type("number", { divisor: 1 }, ">0", "=", 1), {
      short: 't',
      description: 'Number of times to greet'
    })
  },
  handler: async ({ flags, colors }) => {
    const greeting = `Hello, ${flags.name}!`
    const message = flags.loud ? greeting.toUpperCase() : greeting

    for (let i = 0; i < flags.times; i++) {
      console.log(relico.cyan(message))
    }
  }
})
```

## Key Concepts

1. **`defineCommand`** - Creates a command with options and handler
2. **`option()`** - Wraps Zod schemas with CLI metadata (short flags, descriptions)
3. **Type coercion** - `z.coerce.boolean()` converts strings to booleans
4. **Handler context** - Access to `flags`, `colors`, `spinner`, etc.

## Development

```bash
# Generate types (creates .dler/commands.gen.ts)
bun run generate

# Start development with hot reload
bun run dev greet --name Developer

# Build for production
bun run build

# Run the built executable
./dist/cli greet --name "Production User" --loud
```

### Adding New Commands

To add a new command:

1. Create a new file in `commands/` (e.g., `commands/help.ts`)
2. Define the command using `defineCommand`
3. Export it as default
4. Import and register it in `cli.ts`
5. Run `bun run generate` to update types

## Next Steps

Ready for more? Try the **[task-runner](../task-runner/README.md)** example to learn about:

- Complex validation patterns
- Interactive prompts and wizards
- Progress indicators and spinners
- Real-world task automation

## Project Structure

```
hello-world/
├── cli.ts              # CLI entry point
├── commands/           # Command definitions
│   └── greet.ts        # Greet command
├── .dler/            # Generated files (auto-created)
│   └── commands.gen.ts # Generated TypeScript types
├── dler.config.ts     # Configuration
├── package.json        # Dependencies
└── README.md          # This file
```

That's it! This is the simplest possible Rempts CLI. Everything else builds on these concepts.
