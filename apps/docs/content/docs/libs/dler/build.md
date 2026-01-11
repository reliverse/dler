---
title: "dler build"
description: "Build workspace packages using configurable bundler"
---

Build all workspace packages using configurable bundler with support for multiple presets, bundlers, and optimization options.

## Usage

```bash
dler build [options]
```

## Description

The `build` command builds all workspace packages using a configurable bundler system. It automatically detects frontend apps and libraries, supports presets for common build scenarios, and provides extensive customization options for bundling, optimization, and deployment.

## Quick Start

### Basic build
```bash
dler build
```

### Production build
```bash
dler build --production
```

### Development build with watch
```bash
dler build --dev
```

### Library build
```bash
dler build --library
```

## Package Selection

| Option | Type | Description |
|--------|------|-------------|
| `--filter <packages>` | string | Package(s) to include (supports wildcards and comma-separated values like '@reliverse/rempts,@reliverse/build'). Takes precedence over --ignore. |
| `--ignore <packages>` | string | Package(s) to ignore (supports wildcards like @reliverse/*). |
| `--cwd <path>` | string | Working directory (monorepo root). |
| `--concurrency <number>` | number | Number of packages to build concurrently (default: 5). |
| `--stop-on-error` | boolean | Stop on first error instead of collecting all errors (default: false). |

## Build Configuration

### Entry & Output

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--entry <file>` | `-e` | string | Entry file (defaults to auto-detect), supports comma-separated multiple entries. |
| `--outdir <dir>` | `-o` | string | Output directory. |
| `--outfile <file>` |  | string | Output filename (for single executable). |

### Bundler & Target

| Option | Type | Description |
|--------|------|-------------|
| `--bundler <bundler>` | string | Bundler to use: bun (fast, bundles deps) or mkdist (preserves structure, default for libraries). |
| `--target <target>` | string | Build target: browser, bun, or node (default: bun). |
| `--runtime <runtime>` | `-r` | `'bun' \| 'node'` | Runtime target (for non-compiled builds). |

### Compilation

| Option | Type | Description |
|--------|------|-------------|
| `--compile` | boolean | Generate standalone executable (default: false). |
| `--targets <targets>` | `-t` | string | Target platforms for compilation (e.g., darwin-arm64,linux-x64,all,native). |
| `--compress` | boolean | Compress multi-target builds into tar.gz files (default: false). |

## Optimization

### Minification

| Option | Type | Description |
|--------|------|-------------|
| `--minify` | boolean | Enable all minification options (default: false). |
| `--minify-whitespace` | boolean | Minify whitespace (default: false). |
| `--minify-syntax` | boolean | Minify syntax and inline constants (default: false). |
| `--minify-identifiers` | boolean | Minify variable and function identifiers (default: false). |

### Code Splitting

| Option | Type | Description |
|--------|------|-------------|
| `--splitting` | boolean | Enable code splitting (default: true). |
| `--external <packages>` | string | External packages to exclude from bundle (supports wildcards). |
| `--packages <mode>` | string | How to handle dependencies: bundle or external (default: bundle). |

## Output Format

| Option | Type | Description |
|--------|------|-------------|
| `--format <format>` | string | Output format: esm, cjs, or iife (default: esm). |
| `--sourcemap <option>` | string | Sourcemap option: none, linked, inline, or external (default: none). |

## Development

### Watch & Hot Reload

| Option | Type | Description |
|--------|------|-------------|
| `--watch` | boolean | Watch mode for hot rebuild (default: false). |
| `--no-clear-screen` | boolean | Don't clear screen in watch mode (default: false). |
| `--react-fast-refresh` | boolean | Enable React Fast Refresh (default: false). |

### Development Server

| Option | Type | Description |
|--------|------|-------------|
| `--dev-server` | boolean | Enable development server (default: false). |
| `--port <number>` | number | Development server port (default: 3000). |
| `--open` | boolean | Open browser on dev server start (default: false). |

## Presets

### Build Modes

| Option | Type | Description |
|--------|------|-------------|
| `--production` | boolean | Enable production mode (minify=true, sourcemap=none, env=inline). |
| `--dev` | boolean | Enable development mode (watch=true, sourcemap=linked, env=disable). |
| `--library` | boolean | Enable library mode (packages=external, bundler=mkdist, generateTypes=true). |

### Framework Presets

| Option | Type | Description |
|--------|------|-------------|
| `--react` | boolean | Enable React preset (jsx=automatic, target=browser). |
| `--node` | boolean | Enable Node preset (target=node, format=cjs). |
| `--monorepo` | boolean | Enable monorepo preset (concurrency=auto, validateTsconfig=true). |

## TypeScript & Types

| Option | Type | Description |
|--------|------|-------------|
| `--generate-types` | boolean | Generate TypeScript declaration files (default: false). |
| `--type-check` | boolean | Run type checking during build (default: false). |
| `--validate-tsconfig` | boolean | Validate tsconfig.json for common issues (default: true). |
| `--strict-tsconfig` | boolean | Make tsconfig validation errors fatal (default: false). |
| `--dts-provider <provider>` | string | DTS generation provider: dts-bundle-generator, api-extractor, typescript, or mkdist (default: dts-bundle-generator). |

## Advanced Options

### Environment & Constants

| Option | Type | Description |
|--------|------|-------------|
| `--env <mode>` | string | Environment variable handling: inline, disable, or prefix like PUBLIC_*. |
| `--define <json>` | string | Define global constants (JSON format, e.g., '{"__VERSION__":"1.0.0"}'). |

### Naming & Paths

| Option | Type | Description |
|--------|------|-------------|
| `--public-path <path>` | string | Prefix for import paths in bundled code. |
| `--root <path>` | string | Project root for resolving relative paths. |
| `--naming <pattern>` | string | Customize output file naming (JSON format). |
| `--entry-naming <pattern>` | string | Naming pattern for entry files (e.g., '[dir]/[name].[ext]'). |
| `--chunk-naming <pattern>` | string | Naming pattern for chunk files (e.g., '[name]-[hash].[ext]'). |
| `--asset-naming <pattern>` | string | Naming pattern for asset files (e.g., '[name]-[hash].[ext]'). |

### Bytecode & Performance

| Option | Type | Description |
|--------|------|-------------|
| `--bytecode` | boolean | Generate bytecode for faster cold starts (requires format: cjs, target: bun). |
| `--drop <calls>` | string | Drop function calls (e.g., 'console.log', 'debugger'). |

### HTML & Assets

| Option | Type | Description |
|--------|------|-------------|
| `--html` | boolean | Generate HTML file (default: false). |
| `--public-assets <dir>` | string | Public assets directory (default: 'public'). |
| `--assets <dir>` | string | Assets directory (default: 'assets'). |

### Frameworks & Features

| Option | Type | Description |
|--------|------|-------------|
| `--app` | boolean | Enable app mode (default: false). |
| `--server-components` | boolean | Enable server components support (default: false). |
| `--css-modules` | boolean | Enable CSS modules (default: false). |
| `--css-chunking` | boolean | Enable CSS chunking (default: false). |
| `--svg-as-react` | boolean | Convert SVG to React components (default: false). |
| `--worker-support` | boolean | Enable worker support (default: false). |
| `--macros` | boolean | Enable Bun macros (default: false). |
| `--side-effects` | boolean | Mark package as side-effect free (default: false). |

### Optimization Features

| Option | Type | Description |
|--------|------|-------------|
| `--image-optimization` | boolean | Enable image optimization (default: false). |
| `--font-optimization` | boolean | Enable font optimization (default: false). |
| `--css-optimization` | boolean | Enable CSS optimization (default: false). |
| `--performance-monitoring` | boolean | Enable performance monitoring (default: false). |
| `--bundle-analyzer` | boolean | Enable bundle analyzer (default: false). |
| `--bundle-size-limit <bytes>` | number | Maximum bundle size in bytes (default: unlimited). |
| `--performance-budget <json>` | string | Performance budget configuration (JSON format). |

## Build Features

### Special Options

| Option | Type | Description |
|--------|------|-------------|
| `--no-bundle` | boolean | Disable bundling (transpile only) (default: false). |
| `--cache` | boolean | Enable build cache (default: true). |
| `--no-cache` | boolean | Disable build cache (default: false). |
| `--verbose` | boolean | Verbose mode (default: false). |

### Post-build Operations

| Option | Type | Description |
|--------|------|-------------|
| `--replace-exports` | boolean | Replace exports from ./dist/*.js to ./src/*.ts after build (default: false). |
| `--replace-exports-ignore-packages <packages>` | string | Packages to ignore when replacing exports (supports glob patterns like @reliverse/*). |
| `--logger-clear-internals` | boolean | Remove logger.internal() and logInternal() calls from built dist files (default: false). |
| `--logger-clear-internals-ignore-packages <packages>` | string | Packages to ignore when clearing logger internals (supports glob patterns like @reliverse/*). |

### Configuration

| Option | Type | Description |
|--------|------|-------------|
| `--max-config-depth <number>` | number | Maximum depth to search for dler.ts config files (default: 3). |
| `--kind <type>` | string | Package kind: app or library (default: auto-detect). |
| `--allow-private-build <pattern>` | string | Allow building packages with private: true in package.json. Can be a package name pattern or comma-separated patterns. |

### Debugging

| Option | Type | Description |
|--------|------|-------------|
| `--debug-dump-server-files` | boolean | Dump server files for debugging (default: false). |
| `--debug-no-minify` | boolean | Disable minification for debugging (default: false). |
| `--throw` | boolean | Throw on build errors instead of returning success: false. |

## Examples

### Basic Builds

```bash
# Build all packages
dler build

# Build specific packages
dler build --filter "@reliverse/ui,@reliverse/utils"

# Skip specific packages
dler build --ignore "@reliverse/docs"
```

### Preset Builds

```bash
# Production build
dler build --production

# Development build with watch
dler build --dev

# Library build
dler build --library

# React app build
dler build --react

# Node.js library build
dler build --node
```

### Custom Builds

```bash
# Custom entry and output
dler build --entry src/index.ts --outdir dist

# Multiple entries
dler build --entry "src/index.ts,src/cli.ts"

# Specific target and format
dler build --target node --format cjs

# With sourcemaps
dler build --sourcemap linked

# Minified build
dler build --minify
```

### Advanced Builds

```bash
# Standalone executable
dler build --compile --targets "linux-x64,darwin-arm64"

# With external dependencies
dler build --external "react,react-dom"

# Development server
dler build --dev-server --port 3001 --open

# With type checking
dler build --type-check --generate-types
```

### Watch & Development

```bash
# Watch mode
dler build --watch

# Development build with hot reload
dler build --dev --react-fast-refresh

# No screen clearing in watch
dler build --watch --no-clear-screen
```

## Build Configuration

Build behavior is controlled by `dler.ts` configuration files. The system searches for these files starting from the current directory up to the specified maximum depth.

Example configuration:

```typescript
export default defineConfig({
  build: {
    entries: ['src/index.ts'],
    outDir: 'dist',
    target: 'bun',
    format: 'esm',
    minify: true,
  }
})
```

## Build Cache

By default, builds are cached to improve performance. The cache can be disabled with `--no-cache` or cleared by deleting the cache directory.

## Post-build Operations

### Export Replacement
Replace package.json exports from built files back to source files:

```bash
dler build --replace-exports
```

### Logger Cleanup
Remove internal logger calls from production builds:

```bash
dler build --logger-clear-internals
```

## Error Handling

The build command collects errors from all packages by default. Use `--stop-on-error` to fail fast on the first error. Use `--verbose` for detailed error information.

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Valid workspace**: Must be run in a monorepo root or package directory