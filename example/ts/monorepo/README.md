# Monorepo Example

This example demonstrates the update command.

## Project Structure

```bash
monorepo/
├── package.json                 # Root with shared dev dependencies
├── packages/
│   ├── ui/                     # React UI components library  
│   └── utils/                  # Shared utility functions
├── apps/
│   ├── web/                    # Next.js web application
│   └── api/                    # Express.js API server
└── tools/
    └── build/                  # Custom build tools
```

## Update Command Examples

cd to `example/ts/monorepo` and then you can use the update command.

### Basic Updates

```bash
# Update ALL dependencies across ALL package.json files found
bun latest

# Preview changes without applying them  
bun latest --dryRun

# Update and automatically run install
bun latest --withInstall
```

### Pattern-Based Updates

```bash
# Update only TypeScript types across all packages
bun latest --name "@types/*"

# Update React ecosystem packages
bun latest --name "react*" --name "@react*"

# Update ESLint and TypeScript ESLint packages
bun latest --name "eslint*" --name "@typescript-eslint/*"

# Update build tools (esbuild, webpack, vite, etc.)
bun latest --name "*build*" --name "*webpack*" --name "vite"
```

### Exclusion Patterns

```bash
# Update everything EXCEPT ESLint packages
bun latest --ignore "eslint*" --ignore "@typescript-eslint/*"

# Update everything EXCEPT types and linting tools
bun latest --ignore "@types/*" --ignore "eslint*" --ignore "prettier"

# Complex ignore patterns using brace expansion
bun latest --ignore "{eslint,prettier,@typescript-eslint/*}"
```

### Advanced Usage

```bash
# Update with automatic install
bun latest --withInstall

# Disable major version updates (be more conservative)
bun latest --no-allowMajor

# Update only specific files in a large monorepo
cd packages/ui && bun ../../../cli.ts update
```

### Pre-configured Scripts

The root `package.json` includes useful update scripts:

```bash
# Standard update
bun latest

# Update with install
bun latest:install

# Update only TypeScript types
bun latest:types

# Update React ecosystem
bun latest:react

# Update everything except ESLint
bun latest:no-eslint

# Preview mode
bun latest:dry
```

## What Gets Updated

The enhanced command automatically finds and updates:

- ✅ **Root package.json** - Shared devDependencies and tooling
- ✅ **packages/ui/package.json** - React UI library with Radix UI components
- ✅ **packages/utils/package.json** - Utility library with lodash, date-fns
- ✅ **apps/web/package.json** - Next.js app with React Query, Zustand
- ✅ **apps/api/package.json** - Express API with JWT, bcrypt, Zod
- ✅ **tools/build/package.json** - Build tools with esbuild, commander

## Pattern Matching Features

### Glob Patterns Supported

- `*` - Match any characters
- `?` - Match single character  
- `[abc]` - Match character from set
- `{a,b,c}` - Match any of the options

### Example Patterns

- `@types/*` → `@types/node`, `@types/react`, `@types/express`
- `react*` → `react`, `react-dom`, `react-router`
- `eslint-*` → `eslint-config-next`, `eslint-plugin-react`
- `*build*` → `esbuild`, `webpack`, `rollup`
- `{prettier,biome}` → Exact match for either prettier or biome

## Smart Features

### Automatic Detection

- **No configuration needed** - Works with any monorepo structure
- **Smart ignore patterns** - Skips node_modules, dist, build directories
- **Per-file filtering** - Only updates dependencies that exist in each file

### Informative Output

```bash
✓ Found 5 package.json files
✓ Found 2 exact matches and 8 pattern matches  
✓ Updated 15 dependencies across 5 package.json files
  • Updated 3 dependencies in package.json
  • Updated 4 dependencies in packages/ui/package.json
  • Updated 3 dependencies in packages/utils/package.json  
  • Updated 3 dependencies in apps/web/package.json
  • Updated 2 dependencies in apps/api/package.json
```

### Workspace Dependencies

- Handles `workspace:*` dependencies correctly
- Skips non-semver specifiers (git:, file:, link:)
- Preserves peer dependencies as-is

This example showcases how the update command makes managing dependencies across complex monorepos simple and powerful!
