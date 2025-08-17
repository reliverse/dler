# High-Level Generator Utilities

For common patterns, you can check example of the high-level utilities from `./typed-generators`:

```typescript
import { 
  generateCrudModule, 
  generateApiModule, 
  generateMultipleModules 
} from "./typed-generators";
```

```ts
// Generate CRUD commands for a resource
await generateCrudModule("user", {
  moduleRoot: "src/modules"
});
```

```ts
// Generate API endpoint commands
await generateApiModule("posts", ["get", "post", "put", "delete"], {
  moduleRoot: "src/api"
});
```

```ts
// Generate multiple modules at once
await generateMultipleModules([
  { name: "auth", commands: ["login", "logout", "register"] },
  { name: "profile", commands: ["get", "update", "delete"] }
], {
  moduleRoot: "src/features"
});
```

## Examples

See example/typed-cmds-example.ts for comprehensive usage examples.
See example/generators-example.ts for generator-specific examples.
See example/high-level-generators.ts for high-level utility examples.

## Utilities

- dler rempts --overwrite - Automatically regenerate cmds.ts with updated types
- bun example/typed-cmds-example.ts - Run examples to test the system
- bun example/generators-example.ts - Run generator examples
- bun example/high-level-generators.ts - Run high-level generator utility examples
