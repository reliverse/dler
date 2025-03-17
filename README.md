# Relidler: Reliverse Bundler

[📦 NPM](https://npmjs.com/@reliverse/relidler) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [💖 Patreon](https://patreon.com/blefnk) • [📚 Docs](https://docs.reliverse.org)

**@reliverse/relidler** is a flexible, unified bundler and NPM/JSR publishing tool for TypeScript and JavaScript projects.

## Features

- Drop-in replacement for `unbuild` 😘
- `relidler` works via CLI or as a lib
- Automates publishing to NPM and JSR
- No more package.json headaches
- Handles version bumps automatically
- Ensures reliable builds for JS/TS projects
- Optimized for speed and modern workflows
- Supports path conversion and symbol resolution
- Highly configurable via an optional config file

## Getting Started

Ensure [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org), and [Bun](https://bun.sh)/[pnpm](https://pnpm.io)/[Yarn](https://yarnpkg.com)/[npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed. Then:

### Example Playground

Want to try Relidler before using it in your own project? Just clone the repo and let Relidler build itself!

```sh
git clone https://github.com/reliverse/relidler.git
cd relidler
bun i
bun dev # bun src/main.ts cli --dev
```

### Relidler CLI Usage

1. Install globally:

    ```sh
    bun i -g @reliverse/relidler
    ```

2. Generate a config (recommended):

    ```sh
    bun add -D @reliverse/relidler-cfg # (⚠️soon)
    relidler init
    ```

    Supported config files: relidler.cfg.ts, relidler.config.ts, build.cfg.ts, build.config.ts (⚠️soon), build.pub.ts

3. Run and enjoy the magic:

    ```sh
    relidler cli
    ```

## Plugins

Relidler includes a plugin system. The following built-in plugin is already available:

- `libraries-relidler-plugin`: Builds and publishes specified directories of the main project's source directory as separate packages.

### API (for advanced users)

Build a new Relidler plugin or extend your own CLI functionality with:

```sh
bun add -D @reliverse/relidler-sdk # (⚠️soon)
```

## Related

- [unjs/unbuild](https://github.com/unjs/unbuild)

## License

🩷 [MIT](./LICENSE.md) © [blefnk Nazar Kornienko](https://github.com/blefnk)
