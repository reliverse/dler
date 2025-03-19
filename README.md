# Relidler: Reliverse Bundler

[💖 GitHub Sponsors](https://github.com/sponsors/blefnk) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [✨ Repo](https://github.com/reliverse/relidler-reliverse-bundler) • [📦 NPM](https://npmjs.com/@reliverse/relidler) • [📚 Docs](https://docs.reliverse.org)

**@reliverse/relidler** is a flexible, unified, and fully automated bundler for TypeScript/JavaScript projects, as well as an NPM/JSR publishing tool.

## Features

- 😘 Drop-in replacement for `unbuild`
- ⚡ `relidler` works via CLI and SDK
- 📦 Automates NPM/JSR publishing
- ✅ Ensures reliable JS/TS builds
- 🔄 Handles automatic version bumps
- 🔧 Eliminates package.json headaches
- 🎯 Optimized for speed & modern workflows
- 🛠️ Converts TypeScript aliases to relative paths
- ✨ Packed with powerful features under the hood
- 📝 Highly configurable via a config file
- 🔌 Plugin system for extensibility

## Getting Started

Ensure [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org), and [bun](https://bun.sh)/[pnpm](https://pnpm.io)/[yarn](https://yarnpkg.com)/[npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed. Then, follow these steps:

### Example Playground

Want to test Relidler before integrating it into your project? Clone the repo and build it with Relidler itself:

```sh
git clone https://github.com/reliverse/relidler.git
cd relidler
bun i
bun dev # Runs bun src/main.ts --dev
```

### Relidler Usage

1. **Install globally**:

    ```sh
    bun i -g @reliverse/relidler
    ```

    **Or update if needed**:

    ```sh
    bun -g update --latest
    ```

2. **Prepare your project**:

    Ensure that your gitignore includes log files and dist dirs:

    ```sh
    echo "*.log" >> .gitignore
    echo "dist-npm" >> .gitignore
    echo "dist-jsr" >> .gitignore
    echo "dist-libs" >> .gitignore
    ```

3. **Run and enjoy**:

    ```sh
    relidler
    ```

    The `relidler.cfg.ts` file will be created automatically on the first run. **It's recommended to edit this file according to your needs.** While `relidler.cfg.ts` is the recommended name, the following names are also available: `relidler.config.ts` • `build.cfg.ts` • `build.config.ts (⚠️soon)` • `build.pub.ts`.

## Plugins & SDK

Relidler includes a plugin system. The following built-in plugin is already available:

- **`libraries-relidler-plugin`**: Builds and publishes specified subdirectories of the main project's source directory as separate packages.

### API (for advanced users)

The SDK allows you to create new Relidler plugins and even extend your own CLI functionality.

```sh
bun add -D @reliverse/relidler-sdk # (⚠️soon)
```

## TODO

- [x] Implement stable `regular` build and publish
- [ ] Implement stable `library` build and publish
- [ ] Implement automatic migration from `unbuild`
- [ ] Achieve full drop-in replacement for `unbuild`
- [ ] Make configuration fully optional using defaults
- [ ] Allow plugins to extend Relidler's `defineConfig`
- [ ] Support configuration via `reliverse.{ts,jsonc}`

## Related

Kudos to the following projects that made Relidler possible:

- [unjs/unbuild](https://github.com/unjs/unbuild)

## License

🩷 [MIT](./LICENSE) © [blefnk Nazar Kornienko](https://github.com/blefnk)
