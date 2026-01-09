# rempts-core

The minimal, type-safe CLI framework for Bun.

## Installation

```bash
bun add rempts-core
```

## Quick Start

```typescript
import { defineCommand, option } from '@reliverse/rempts-core'
import { type } from 'arktype'

export default defineCommand({
  name: 'greet',
  description: 'A friendly greeting',
  options: {
    name: option(
      type("string", ">0"),
      { description: 'Name to greet', short: 'n' }
    ),
    excited: option(
      type("boolean", "=", false),
      { description: 'Add excitement', short: 'e' }
    )
  },
  handler: async ({ flags }) => {
    const greeting = `Hello, ${flags.name}${flags.excited ? '!' : '.'}`
    console.log(greeting)
  }
})
```

## Features

- 🚀 **Type-safe** - Full TypeScript support with automatic type inference
- ⚡ **Fast** - Powered by Bun's native speed
- 📦 **Zero config** - Works out of the box with sensible defaults
- 🎯 **Minimal API** - Learn once, use everywhere
- 🔌 **Extensible** - Plugin system for custom functionality
- 🧪 **Testable** - First-class testing utilities included

## Core Concepts

### Commands

Define commands with automatic type inference:

```typescript
import { defineCommand } from '@reliverse/rempts-core'

export default defineCommand({
  name: 'build',
  description: 'Build the project',
  handler: async () => {
    console.log('Building...')
  }
})
```

### Options

Use the `option` helper with Standard Schema validation:

```typescript
import { defineCommand, option } from '@reliverse/rempts-core'
import { type } from 'arktype'

export default defineCommand({
  name: 'deploy',
  options: {
    env: option(
      type("'dev'|'staging'|'prod'"),
      { description: 'Target environment' }
    ),
    force: option(
      type("boolean", "=", false),
      { description: 'Force deployment', short: 'f' }
    )
  },
  handler: async ({ flags }) => {
    // TypeScript knows:
    // flags.env is 'dev' | 'staging' | 'prod'
    // flags.force is boolean
  }
})
```

### Multi-Command CLIs

Create complex CLIs with multiple commands:

```typescript
import { createCLI } from '@reliverse/rempts-core'
import build from './commands/build'
import deploy from './commands/deploy'
import test from './commands/test'

const cli = createCLI({
  name: 'my-tool',
  version: '1.0.0',
  description: 'My awesome CLI tool',
  commands: [build, deploy, test]
})

await cli.run()
```

## API Reference

### `defineCommand(config)`

Creates a command definition with full type inference.

### `option(schema, config)`

Creates a typed option with schema validation.

### `createCLI(config)`

Creates a multi-command CLI application.

### `defineConfig(config)`

Defines shared configuration for your CLI.

## Plugin System

Rempts provides a powerful plugin system with compile-time type safety:

### Basic Plugin

```typescript
import { RemptsPlugin, createPlugin } from '@reliverse/rempts-core'

interface MyPluginStore {
  apiKey: string
  isAuthenticated: boolean
}

const myPlugin: RemptsPlugin<MyPluginStore> = {
  name: 'my-plugin',
  version: '1.0.0',

  // Define the plugin's store
  store: {
    apiKey: '',
    isAuthenticated: false
  },

  // Lifecycle hooks
  setup(context) {
    // One-time initialization
    context.updateConfig({ customField: 'value' })
  },

  configResolved(config) {
    // Called after all configuration is resolved
  },

  beforeCommand(context) {
    // Called before each command - context.store is type-safe!
    context.store.apiKey = process.env.API_KEY || ''
    context.store.isAuthenticated = !!context.store.apiKey
  },

  afterCommand(context) {
    // Called after each command with results
    if (context.error) {
      console.error('Command failed:', context.error)
    }
  }
}
```

### Plugin Factory

Use `createPlugin` for better ergonomics:

```typescript
import { createPlugin } from '@reliverse/rempts-core'

export const authPlugin = createPlugin((options: AuthOptions) => {
  return {
    name: 'auth-plugin',
    store: {
      token: '',
      user: null as User | null
    },
    async beforeCommand(context) {
      const token = await loadToken()
      context.store.token = token
      context.store.user = await fetchUser(token)
    }
  }
})
```

### Using Plugins with Type Safety

```typescript
const cli = await createCLI({
  name: 'my-cli',
  version: '1.0.0',
  plugins: [
    authPlugin({ provider: 'github' }),
    myPlugin
  ]
})

// In your command files (e.g., cmds/deploy/cmd.ts), the store is fully typed!
// cmds/deploy/cmd.ts
import { defineCommand } from '@reliverse/rempts-core'

export default defineCommand({
  name: 'deploy',
  handler: async ({ context }) => {
    // TypeScript knows about all plugin stores!
    if (!context?.store.isAuthenticated) {
      throw new Error('Not authenticated')
    }
    console.log(`Deploying as ${context.store.user?.name}`)
  }
})
```

### Plugin Development Utilities

Rempts provides utilities for plugin development and testing:

```typescript
import {
  createTestPlugin,
  composePlugins,
  createMockPluginContext,
  testPluginHooks,
  assertPluginBehavior
} from '@reliverse/rempts-core/plugin'

// Create a test plugin
const testPlugin = createTestPlugin(
  { count: 0, message: '' },
  {
    beforeCommand(context) {
      context.store.count++
      console.log(`Count: ${context.store.count}`)
    }
  }
)

// Compose multiple plugins
const composedPlugin = composePlugins(
  authPlugin({ provider: 'github' }),
  loggingPlugin({ level: 'debug' }),
  metricsPlugin({ enabled: true })
)

// Test plugin behavior
const results = await testPluginHooks(testPlugin, {
  config: { name: 'test-cli', version: '1.0.0' },
  store: { count: 0, message: 'test' }
})

assertPluginBehavior(results, {
  beforeCommandShouldSucceed: true
})
```

### Module Augmentation

Plugins can extend Rempts's interfaces:

```typescript
declare module '@reliverse/rempts-core' {
  interface EnvironmentInfo {
    isCI: boolean
    ciProvider?: string
  }
}
```

## Runtime Validation

Rempts provides runtime validation utilities for dynamic type checking:

```typescript
import {
  validateValue,
  validateValues,
  isValueOfType,
  createValidator,
  createBatchValidator
} from '@reliverse/rempts-core'

// Validate a single value
const result = await validateValue(
  'hello',
  type("string", ">0"),
  { option: 'message', command: 'greet' }
)

// Validate multiple values
const validated = await validateValues(
  { name: 'John', age: 25 },
  {
    name: type("string"),
    age: type("number")
  },
  'user'
)

// Check value types
if (isValueOfType(value, 'string')) {
  console.log('Value is a string')
}

// Create reusable validators
const nameValidator = createValidator(type("string", ">0"))
const userValidator = createBatchValidator({
  name: type("string"),
  age: type("number")
})
```

## Type Utilities

Rempts exports advanced TypeScript type utilities for complex type manipulation:

```typescript
import {
  UnionToIntersection,
  MergeAll,
  Expand,
  DeepPartial,
  Constrain,
  NonEmptyArray,
  IsNever,
  IsAny,
  IsUnknown
} from '@reliverse/rempts-core'
```

### Key Utilities

**UnionToIntersection** - Convert union types to intersection types:

```typescript
type Example = UnionToIntersection<{ a: string } | { b: number }>
// Result: { a: string } & { b: number }
```

**MergeAll** - Merge multiple object types:

```typescript
type Example = MergeAll<[{ a: string }, { b: number }, { c: boolean }]>
// Result: { a: string; b: number; c: boolean }
```

**Expand** - Expand complex types for better IntelliSense:

```typescript
type Example = Expand<{ nested: { deep: { value: string } } }>
// Shows full type structure in IDE
```

**DeepPartial** - Make all properties optional recursively:

```typescript
type Example = DeepPartial<{ user: { name: string; age: number } }>
// Result: { user?: { name?: string; age?: number } }
```

**Constrain** - Constrain types with fallback:

```typescript
type Example = Constrain<string, 'a' | 'b' | 'c', 'a'>
// Result: 'a' | 'b' | 'c' (or 'a' if string doesn't match)
```


## Related Packages

- **[rempts-generator](/docs/packages/generator)** - Generate TypeScript definitions from commands
- **[rempts-utils](/docs/packages/utils)** - Shared utilities for CLI development
- **[rempts-test](/docs/packages/test)** - Testing utilities for CLI applications

## Documentation

- [Getting Started](/docs/getting-started) - Step-by-step tutorial
- [Type Generation Guide](/docs/guides/type-generation) - Learn about code generation
- [API Reference](/docs/api) - Complete API documentation

## License

MIT © blefnk
