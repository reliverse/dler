# 🧬 Dler

> **@reliverse/dler** is an open-source CLI & framework which helps developers build TypeScript/JavaScript libraries and CLI tools easily. It provides ready-to-use primitives, so you don't have to write them from scratch.

[Sponsor](https://github.com/sponsors/blefnk) — [Discord](https://discord.gg/Pb8uKbwpsJ) — [GitHub](https://github.com/reliverse/dler) — [NPM](https://npmjs.com/@reliverse/dler) — [Introduction](https://blefnk.reliverse.org/blog/articles/package-managers)

## CLI Installation

```bash
# install as a dev dep:
bun add -D @reliverse/dler
# or/and install globally:
bun i -g @reliverse/dler
```

## CLI Usage

```bash
# when installed as a dev dep:
bun dler [command] [options]
# when installed globally:
dler [command] [options]
```

## Framework Installation

Both CLI and framework packages work independently, you're not required to install both.

```bash
bun add @reliverse/relinka
```

## Framework Usage

```ts
import { logger } from "@reliverse/relinka";
logger.success("Hello, Reliverse!"); // > ✓ Hello, Reliverse!
```

## Available Packages

1. `@reliverse/build`
2. `@reliverse/bump`
3. `@reliverse/config`
4. `@reliverse/datetime`
5. `@reliverse/helpers`
6. `@reliverse/mapkit`
7. `@reliverse/matcha`
8. `@reliverse/pathkit`
9. `@reliverse/publish`
10. `@reliverse/relico`
11. `@reliverse/relifso`
12. `@reliverse/relinka`
13. `@reliverse/rempts`
14. `@reliverse/tsconfig`
15. `@reliverse/typerso`

## Available CLI Commands

All `@reliverse/dler` v2+ commands support both monorepo (recommended) and single-repo (not tested too much yet) contexts.

1. `dler build` can build packages as libraries, frontends (experimental), or standalone apps (experimental; already includes Bun, so the user doesn't even need to install it). Handles not only building, but also package.json modification, and other build-related tasks. Supports dler.ts configuration for per-package settings.
2. `dler clean` nicely cleans up the codebase, with presets and with support for custom paths.
3. `dler publish` publishes all packages to npm and jsr (soon). Handles version bumping, and different validations. Automatically loads .env files for authentication. Supports dler.ts configuration for per-package settings.
4. `dler senv` helps you manage system environment variables easily. Example: `dler senv --action append --name Path --value C:\Users\your-user-name\.local\bin` (on Windows it automates the following steps: System Properties →
  Environment Variables → Edit User PATH → New → Add the path). The command is especially useful for Windows users, when you have too many vars so OS will not allow you to add more.
5. `dler tsc` finds TypeScript errors across all monorepo packages and shows only real ones (unlike the native `tsc`, which sometimes shows errors of its dependencies). It also has a `--copy-logs` flag that copies errors/warnings straight to your clipboard (with an inserted prompt for fixing them), so you can just hit Ctrl/Cmd+V and send it to AI.
6. `dler biome` runs biome check on all packages, provides compact biome's output, copies errors/warnings to clipboard (with an inserted prompt for fixing them).
7. `dler update` updates the dependencies of all packages to the latest version (yes, even across the monorepo).

## Environment Variables (.env) Support

The `dler publish` command automatically loads environment variables from `.env` files for authentication and configuration:

- **NPM_CONFIG_TOKEN** or **NPM_TOKEN**: npm authentication token (required for publishing)
- **NPM_CONFIG_OTP**: One-time password for 2FA (if enabled)
- **CI**, **DEBUG**, **TMPDIR**: Optional build and development settings

Create a `.env` file in your project root with your npm token to avoid manual authentication:

```bash
# Copy from .env.example and add your npm token
cp .env.example .env
# Then edit .env and add: NPM_CONFIG_TOKEN=your_npm_token_here
```

.env.example:

```bash
# NPM Authentication
# Get your token from: https://www.npmjs.com/ → Account → Access Tokens → Generate New Token
NPM_CONFIG_TOKEN="your_npm_token_here"
# Alternative token variable (also supported)
#NPM_TOKEN="your_npm_token_here"

# 2FA One-Time Password (if required)
# Only needed if your npm account has 2FA enabled
# AND bypass=false for NPM_CONFIG_TOKEN/NPM_TOKEN
# NPM_CONFIG_OTP="your_otp_here"

# Registry Configuration (optional, defaults to npm)
# NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"

# Build and Development
# Set to true for CI environments
CI="false"

# Debug logging
DEBUG="false"

# Temporary directory (optional, defaults to system temp)
TMPDIR="/tmp"
```

## v2 Docs

Docs for v2 will be available soon. For now, you can read the v1 docs, or check alpha docs in [relidocs](./relidocs) directory in the root of the project. For example, you can [learn Dler CLI defaults](./relidocs/DEFAULTS.md) there.

## v1 Docs

Visit [docs.reliverse.org/libraries/dler](https://docs.reliverse.org/libraries/dler) to learn how to install and use `@reliverse/dler` library.

## Contributing

A Bun monorepo created with the monorepo bootstrapper.

## Getting Started

```bash
bun install
```

## Workspaces

This monorepo was generated by dler init. It uses bun workspaces to manage multiple packages.

## Locations

- `dler` (v2): `./cli`;
- `dler-v1`: `./deprecated` (contains both CLI and all-in-one library);
- packages: `./packages/*`;

### Scripts

Run scripts across all workspaces:

```bash
bun --filter '*' <script>
```

Run scripts for specific packages:

```bash
bun --filter <package-name> <script>
```

## Stand With Ukraine

- 💙 Please help fund drones, medkits, and victory. [Donate now](https://u24.gov.ua), please, it matters.
- 💛 Every dollar helps stop [russia's war crimes](https://war.ukraine.ua/russia-war-crimes) and saves lives.

## Stand With Reliverse

[Star the project repo](https://github.com/reliverse/dler) to help Reliverse community grow; Follow this project's author, [Nazar Kornienko](https://github.com/blefnk) & [Reliverse](https://github.com/reliverse), to get updates about new projects; [Become a sponsor](https://github.com/sponsors/blefnk) and power the next wave of tools that _just feel right_.

## License

Licensed under [MIT](LICENSE) © 2026 [Nazar Kornienko (blefnk)](https://github.com/blefnk), [Bleverse](https://bleverse.com), [Reliverse](https://github.com/reliverse)
