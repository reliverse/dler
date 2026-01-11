---
title: "dler publish"
description: "Publish packages to NPM, JSR, GitHub Releases, or multiple registries"
---

Publish packages to NPM, JSR (coming soon), GitHub Releases, Vercel (coming soon), or multiple registries with version bumping, dist-tags, access control, and concurrent publishing.

## Usage

```bash
dler publish [options]
```

## Description

The `publish` command handles the complete package publishing workflow including version bumping, building, testing, and publishing to one or more registries. It supports monorepo publishing with concurrent processing and comprehensive error handling.

## Quick Start

### Basic publish
```bash
dler publish
```

### Dry run to test
```bash
dler publish --dry-run
```

### Full release workflow
```bash
dler publish --release --version patch
```

## Package Selection

| Option | Type | Description |
|--------|------|-------------|
| `--filter <packages>` | string | Package(s) to include (supports wildcards and comma-separated values like 'rempts,@reliverse/build'). Takes precedence over --ignore. |
| `--ignore <packages>` | string | Package(s) to ignore (supports wildcards like @reliverse/*). |
| `--cwd <path>` | string | Working directory (monorepo root). |

## Version Control

| Option | Type | Description |
|--------|------|-------------|
| `--bump <type>` | `'major' \| 'minor' \| 'patch' \| 'premajor' \| 'preminor' \| 'prepatch' \| 'prerelease'` | Version bump type (default: patch). |
| `--bump-disable` | boolean | Disable version bumping for all published packages. |
| `--tag <tag>` | string | npm dist-tag (default: latest). |
| `--version <version>` | `'patch' \| 'minor' \| 'major' \| string` | Version to release (only used with --release). |

## Registry Options

| Option | Type | Description |
|--------|------|-------------|
| `--registry <registry>` | `'npm' \| 'jsr' \| 'vercel' \| 'npm-jsr' \| 'none'` | Registry to publish to (default: npm). |
| `--access <level>` | `'public' \| 'restricted'` | Access level (default: public). |
| `--bun-registry <url>` | string | Registry URL for bun publish (overrides .npmrc and bunfig.toml). |

## Authentication

| Option | Type | Description |
|--------|------|-------------|
| `--otp <code>` | string | One-time password for 2FA authentication. |
| `--auth-type <type>` | `'web' \| 'legacy'` | Authentication method (default: legacy). Note: web auth is not supported. |

## Release Workflow

| Option | Type | Description |
|--------|------|-------------|
| `--release` | boolean | Run full release workflow (test, build, version, tag, publish, GitHub). |
| `--github` | boolean | Create GitHub release (only used with --release). |
| `--no-test` | boolean | Skip tests during release (only used with --release). |
| `--no-build` | boolean | Skip build during release (only used with --release). |

## Publishing Options

| Option | Type | Description |
|--------|------|-------------|
| `--concurrency <number>` | number | Number of packages to publish concurrently (default: 3). |
| `--kind <type>` | `'library' \| 'browser-app' \| 'native-app' \| 'cli'` | Package kind (default: library). |
| `--gzip-level <level>` | string | Level of gzip compression when packing (0-9, default: 9). |

## Output Control

| Option | Type | Description |
|--------|------|-------------|
| `--verbose` | boolean | Verbose mode (default: false). |
| `--dry-run` | boolean | Simulate publishing without actually publishing. |
| `--with-npm-logs` | boolean | Display bun publish logs directly to terminal (default: true). |
| `--silent` | boolean | Suppress all output from bun publish (default: false). |
| `--no-progress` | boolean | Hide progress bar from bun publish (default: false). |
| `--no-summary` | boolean | Don't print publish summary from bun publish (default: false). |
| `--skip-tip-2fa` | boolean | Skip the 2FA tip message and wait when using --with-npm-logs. |
| `--stop-on-error` | boolean | Stop on first error instead of collecting all errors (default: false). |

## Security

| Option | Type | Description |
|--------|------|-------------|
| `--ca <cert>` | string | Certificate Authority signing certificate (inline). |
| `--cafile <path>` | string | Path to Certificate Authority certificate file. |
| `--ignore-scripts` | boolean | Skip lifecycle scripts during packing and publishing. |

## Examples

### Basic Publishing

```bash
# Publish all packages to npm
dler publish

# Publish specific packages
dler publish --filter "@reliverse/ui,@reliverse/utils"

# Skip specific packages
dler publish --ignore "@reliverse/docs"

# Dry run to test
dler publish --dry-run
```

### Version Control

```bash
# Publish with specific version bump
dler publish --bump major

# Publish with custom dist-tag
dler publish --tag beta

# Disable version bumping
dler publish --bump-disable
```

### Registry Options

```bash
# Publish to specific registry
dler publish --registry npm-jsr

# Set access level
dler publish --access restricted

# Use custom registry URL
dler publish --bun-registry "https://registry.npmjs.org/"
```

### Authentication

```bash
# With 2FA
dler publish --otp 123456

# Legacy authentication
dler publish --auth-type legacy
```

### Full Release Workflow

```bash
# Complete release with testing, building, and GitHub release
dler publish --release --version patch

# Release without tests
dler publish --release --version minor --no-test

# Release without building
dler publish --release --version major --no-build

# Release with GitHub release
dler publish --release --version patch --github
```

### Advanced Options

```bash
# Verbose output
dler publish --verbose

# Hide npm logs
dler publish --with-npm-logs false

# Concurrent publishing
dler publish --concurrency 5

# Stop on first error
dler publish --stop-on-error
```

## Release Workflow

When using `--release`, the command follows this workflow:

1. **Test**: Run tests (unless `--no-test` is specified)
2. **Build**: Build packages (unless `--no-build` is specified)
3. **Version**: Bump version numbers
4. **Publish**: Publish to registries
5. **Git Tag**: Create git tags
6. **GitHub Release**: Create GitHub releases (if `--github` is specified)

## Configuration

Publishing behavior can be customized through `dler.ts` configuration:

```typescript
export default defineConfig({
  publish: {
    registry: "npm",
    access: "public",
    tag: "latest",
    bump: "patch",
    concurrency: 3,
  },
  release: {
    github: true,
    test: true,
    build: true,
  }
})
```

## Environment Variables

The command automatically loads `.env` files for authentication:

- `NPM_TOKEN` - NPM authentication token
- `JSR_TOKEN` - JSR authentication token
- `GITHUB_TOKEN` - GitHub authentication token

## Registries

### Supported Registries

- **npm**: Node Package Manager
- **jsr**: JavaScript Registry (coming soon)
- **vercel**: Vercel platform (coming soon)
- **npm-jsr**: Publish to both npm and jsr
- **none**: Skip publishing (useful for version bumping only)

### Registry URLs

Use `--bun-registry` to override the default registry URL for bun publish operations.

## Package Types

### Package Kind

| Kind | Description |
|------|-------------|
| `library` | Standard npm package (default) |
| `browser-app` | Browser application |
| `native-app` | Native application |
| `cli` | Command-line interface |

## Error Handling

- **Graceful failures**: Continues with other packages if one fails
- **Detailed errors**: Shows specific error messages for each package
- **Stop on error**: Use `--stop-on-error` to fail fast
- **Dry run**: Test the entire workflow without publishing

## Private Packages

Packages with `"private": true` in their package.json are automatically skipped during publishing with a debug message.

## Requirements

- **Bun runtime**: This command requires Bun to be available
- **Authentication**: Valid tokens for target registries
- **Built packages**: Packages should be built before publishing
- **Valid package.json**: All packages must have valid metadata