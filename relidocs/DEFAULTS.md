# Dler CLI Defaults

This document lists all default configuration values that the Dler CLI uses when no `dler.ts` config file is present in your project.

It is recommended to use Dler CLI in a monorepo setup and bun. The CLI is not too much tested with a single-repo projects.

The `dler.ts` config file is optional and can be used to override the defaults. CLI flags will override the config file settings.

## Private Package Handling

**Important**: Packages with `"private": true` in their package.json are treated specially:
- **Build**: Private packages are **skipped by default** (use `--allowPrivateBuild` to build them)
- **Publish**: Private packages are **NEVER published** (no override possible) to ensure npm and jsr compliance

## Build Command Defaults

### Global Build Settings

| Option | Default | Description |
|--------|---------|-------------|
| `verbose` | `false` | Enable verbose output |
| `concurrency` | `5` | Number of packages to build concurrently |
| `stopOnError` | `false` | Stop on first error instead of collecting all errors |
| `watch` | `false` | Enable watch mode for hot rebuild |
| `cache` | `true` | Enable build caching |
| `noCache` | `false` | Disable build caching |
| `validateTsconfig` | `true` | Validate tsconfig.json files (use --verbose to see the issues) |
| `strictTsconfig` | `false` | Make TSConfig validation errors fatal |
| `replaceExports` | `true` | Replace package.json exports from `./src/*.ts` to `./dist/*.js` after build |
| `allowPrivateBuild` | `undefined` | Allow building private packages (supports wildcards like `@reliverse/*`) |
| `maxConfigDepth` | `3` | Maximum directory levels to search for dler.ts config |

### Bundler Settings

| Option | Default | Description |
|--------|---------|-------------|
| `bundler` | `"mkdist"` | Bundler to use: bun or mkdist (mkdist for libraries, bun for browser-app/native-app) |
| `target` | `"node"` | Build target: browser, bun, or node |
| `format` | `"esm"` | Output format: esm, cjs, or iife |
| `minify` | `false` | Enable all minification options |
| `sourcemap` | `"none"` | Sourcemap option: none, linked, inline, or external |
| `splitting` | `true` | Enable code splitting |
| `external` | `['node-fetch-native']` | External packages to exclude from bundle |
| `bytecode` | `false` | Generate bytecode for faster cold starts |
| `drop` | `undefined` | Drop function calls (e.g., 'console.log', 'debugger') |
| `packages` | `"bundle"` | How to handle dependencies: bundle or external |
| `publicPath` | `undefined` | Prefix for import paths in bundled code |
| `root` | `undefined` | Project root for resolving relative paths |
| `define` | `undefined` | Define global constants (JSON format) |
| `naming` | `undefined` | Customize output file naming (JSON format) |
| `env` | `"disable"` | Environment variable handling: inline, disable, or prefix like PUBLIC_* |
| `banner` | `undefined` | Add banner to bundled code (e.g., 'use client') |
| `footer` | `undefined` | Add footer to bundled code |
| `conditions` | `undefined` | Package.json exports conditions for import resolution |
| `loader` | `undefined` | Custom loaders for file extensions (JSON format) |
| `ignoreDCEAnnotations` | `false` | Ignore dead code elimination annotations |
| `emitDCEAnnotations` | `true` | Force emit dead code elimination annotations |
| `throw` | `false` | Throw on build errors instead of returning success: false |

### Frontend-Specific Options

| Option | Default | Description |
|--------|---------|-------------|
| `html` | `undefined` (auto-detected) | Enable HTML entry point processing (auto-detected for frontend apps) |
| `cssChunking` | `true` (for frontend apps) | Chunk CSS to reduce duplication |
| `devServer` | `false` | Start dev server with HMR (requires --watch) |
| `port` | `3000` | Dev server port |
| `open` | `false` | Open browser on dev server start |
| `publicAssets` | `undefined` | Public assets directory (default: public) |
| `jsxRuntime` | `undefined` | JSX runtime: automatic or classic (default: automatic) |
| `jsxImportSource` | `undefined` | JSX import source (e.g., 'react' for classic runtime) |

### Bundle Options

| Option | Default | Description |
|--------|---------|-------------|
| `noBundle` | `false` | Transpile only — do not bundle |
| `keepNames` | `false` | Preserve original function and class names when minifying |
| `debug` | `false` | Enable debug mode with verbose internal logging |
| `reactFastRefresh` | `false` | Enable React Fast Refresh transform (for development testing) |
| `noClearScreen` | `false` | Don't clear the terminal when rebuilding with --watch |

### Enhanced Features

| Option | Default | Description |
|--------|---------|-------------|
| `macros` | `false` | Enable Bun macros support for compile-time code generation |
| `sideEffects` | `undefined` | Configure sideEffects for tree-shaking (boolean or JSON array) |
| `bundleAnalyzer` | `false` | Generate bundle analysis report |
| `bundleAnalysis` | `false` | Generate detailed bundle analysis |
| `typeCheck` | `false` | Run TypeScript type checking during build |
| `generateTypes` | `true` | Generate TypeScript declaration files (.d.ts) |
| `bundleSizeLimit` | `undefined` | Set maximum bundle size limit in bytes |
| `performanceBudget` | `undefined` | Set performance budget (JSON format) |
| `performanceMonitoring` | `false` | Enable performance monitoring and reporting |

### Asset Optimization

| Option | Default | Description |
|--------|---------|-------------|
| `imageOptimization` | `false` | Enable image optimization (WebP conversion, compression) |
| `fontOptimization` | `false` | Enable font optimization (subsetting, compression) |
| `cssOptimization` | `false` | Enable CSS optimization (purge, minify, autoprefixer) |
| `svgAsReact` | `false` | Transform SVG files into React components |
| `cssModules` | `false` | Enable CSS Modules support |
| `workerSupport` | `false` | Enable Web Worker support |

### Plugin System

| Option | Default | Description |
|--------|---------|-------------|
| `plugins` | `[]` | Load custom plugins (comma-separated list) |

### Package Preparation for Publishing

| Option | Default | Description |
|--------|---------|-------------|
| `kind` | `undefined` | Package kind: library, cli, browser-app, or native-app |
| `bin` | `undefined` | Binary definitions for CLI packages |

### TSConfig Validation

| Option | Default | Description |
|--------|---------|-------------|
| `strictTsconfig` | `false` | Make TSConfig validation errors fatal |
| `validateTsconfig` | `true` | Validate tsconfig.json files for common issues |

### Declaration File Generation

| Option | Default | Description |
|--------|---------|-------------|
| `dtsProvider` | `"mkdist"` | Provider for generating .d.ts files: mkdist (default), dts-bundle-generator, api-extractor, or typescript |

### Compilation Options

| Option | Default | Description |
|--------|---------|-------------|
| `compile` | `false` | Generate standalone Bun executable |

### Windows Executable Options

| Option | Default | Description |
|--------|---------|-------------|
| `windowsHideConsole` | `false` | Prevent a console window from opening when running a compiled Windows executable |
| `windowsIcon` | `undefined` | Set an icon for the Windows executable |
| `windowsTitle` | `undefined` | Set the Windows executable product name |
| `windowsPublisher` | `undefined` | Set the Windows executable company name |
| `windowsVersion` | `undefined` | Set the Windows executable version (e.g. 1.2.3.4) |
| `windowsDescription` | `undefined` | Set the Windows executable description |
| `windowsCopyright` | `undefined` | Set the Windows executable copyright notice |

## Publish Command Defaults

### Global Publish Settings

| Option | Default | Description |
|--------|---------|-------------|
| `verbose` | `false` | Verbose mode |
| `dryRun` | `false` | Simulate publishing without actually publishing |
| `concurrency` | `3` | Number of packages to publish concurrently |
| `bumpDisable` | `false` | Disable version bumping for all published packages |
| `tag` | `"latest"` | npm dist-tag |
| `access` | `"public"` | Access level: public or restricted |
| `registry` | `"npm"` | Registry to publish to: npm, jsr, vercel, npm-jsr, or none |
| `kind` | `undefined` | Package kind: library, browser-app, native-app, or cli |
| `authType` | `"web"` | Authentication method: web or legacy |
| `otp` | `undefined` | One-time password for 2FA authentication |

### Version Bumping

| Option | Default | Description |
|--------|---------|-------------|
| `bump` | `undefined` | Version bump type: major, minor, patch, premajor, preminor, prepatch, prerelease |

### Supported Kind-Registry Combinations

| Kind | Allowed Registries |
|------|-------------------|
| `library` | npm, jsr, npm-jsr, none |
| `browser-app` | vercel, none |
| `native-app` | none |
| `cli` | npm, none |

## Entry Point Detection Defaults

The build command automatically detects entry points in the following order:

1. **package.json "build" field**: If `build.entrypoints` is specified
2. **package.json "exports" field**: Parsed for entry points
3. **Frontend app patterns**: Checks for HTML files in common locations
   - `index.html`
   - `public/index.html`
   - `src/index.html`
   - `app.html`
   - `public/app.html`
4. **Common library patterns**: Falls back to standard entry points
   - `src/index.ts`
   - `src/mod.ts`
   - `index.ts`
   - `src/index.js`
   - `src/mod.js`
   - `index.js`

## Output Directory Resolution Defaults

The build command resolves output directories in the following order:

1. **tsconfig.json**: Uses `compilerOptions.outDir` if specified
2. **Fallback**: Uses `dist/` folder

## Auto-Detection Features

### Frontend App Detection

A package is detected as a frontend app if:
- HTML files are found in common locations (`index.html`, `public/index.html`, etc.)
- Frontend framework dependencies are present (react, preact, solid-js, lit, alpinejs)
- A `public` directory exists

### Bundler Auto-Selection

- **mkdist**: Default bundler for all packages (preserves file structure)
- **bun**: Used for browser-app or native-app packages (bundles dependencies)

### Target/Format Auto-Selection

By default, packages are treated as **libraries** with:
- `target`: `"node"` (default)
- `format`: `"esm"` (default)
- `bundler`: `"mkdist"` (default)
- `generateTypes`: `true` (default)

For detected frontend apps (when not compiling):
- `target`: `"browser"` (overrides default `"node"`)
- `format`: `"esm"` (keeps default)
- `splitting`: `true` (keeps default)
- `bundler`: `"bun"` (overrides default `"mkdist"`)

## Preset Defaults

When using presets with `dler build`:

### Production Preset
- `minify`: `true`
- `sourcemap`: `"none"`
- `env`: `"inline"`
- `drop`: `["console.log", "debugger"]`

### Development Preset
- `minify`: `false`
- `sourcemap`: `"inline"`
- `watch`: `true`

### Library Preset
- `bundler`: `"mkdist"`
- `external`: `"*"`
- `target`: `"node"`
- `format`: `"esm"`

### React Preset
- `target`: `"browser"`
- `format`: `"esm"`
- `html`: `true`
- `jsxRuntime`: `"automatic"`
- `reactFastRefresh`: `true` (in watch mode)

### Node Preset
- `target`: `"node"`
- `format`: `"cjs"`
- `external`: `["node:*"]`

### Monorepo Preset
- `concurrency`: `8`
- `cache`: `true`
- `bundler`: `"mkdist"` (for libraries)
