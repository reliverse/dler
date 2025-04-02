# @reliverse/relidler | Relidler | Reliverse Bundler

[💖 GitHub Sponsors](https://github.com/sponsors/blefnk) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [✨ Repo](https://github.com/reliverse/relidler-js-bundler) • [📦 NPM](https://npmjs.com/@reliverse/relidler) • [📚 Docs](https://docs.reliverse.org)

**@reliverse/relidler** is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.

## Features

- 😘 Drop-in replacement for `unbuild`
- ⚡ `relidler` works via CLI and SDK
- 📦 Automated NPM/JSR publishing
- ✅ Ensures reliable JS/TS builds
- 🔄 Handles automatic version bumps
- 🔧 Eliminates `package.json` headaches
- 🎯 Optimized for speed and modern workflows
- 🛠️ Converts TypeScript aliases to relative paths
- ✨ Packed with powerful features under the hood
- 📝 Highly configurable flow via a configuration file
- 🔌 Plugin system with two built-in plugins included

## Getting Started

Ensure Git, Node.js, and bun/pnpm/yarn/npm are installed. Then:

### Playground

> **💡 Tip**:
> Want to test Relidler before integrating it into your project?
> Clone the repo and build it using Relidler itself!

```sh
git clone https://github.com/reliverse/relidler.git
cd relidler
bun i
bun dev # bun src/main.ts --dev
```

### Installation

1. **Install globally**:

    ```sh
    bun i -g @reliverse/relidler
    ```

    **Or update as needed**:

    ```sh
    bun -g update --latest
    ```

2. **Prepare your project**:

    a. **Configure `.gitignore`**:

    ```sh
    echo "*.log" >> .gitignore
    echo "dist-npm" >> .gitignore
    echo "dist-jsr" >> .gitignore
    echo "dist-libs" >> .gitignore
    ```

    b. **Install config intellisense**:

    ```sh
    bun add -D @reliverse/relidler-cfg
    ```

    c. **Initialize config**:

    ```sh
    relidler cli
    ```

    - The `.reliverse/relidler.config.ts` file is automatically created on first run.
    - **It's recommended to customize this file according to your needs.**
    - You can check an example config here: [relidler.config.ts](https://github.com/reliverse/relidler-js-bundler/blob/main/relidler.config.ts)

3. **Run and enjoy**:

    ```sh
    relidler cli
    ```

## 🔌 Plugins

Relidler includes a plugin system with **two built-in plugins** (from [@reliverse/addons](https://github.com/reliverse/addons)):

### 1. `libraries-relidler-plugin`

Builds and publishes specific subdirectories of your main project as standalone packages.

**Usage example**:  
Using `@reliverse/relidler-cfg` to package [src/libs/cfg](https://github.com/reliverse/relidler-js-bundler/tree/main/src/libs/cfg):

```ts
// relidler.config.ts
libsActMode: "main-and-libs",
libsDirDist: "dist-libs",
libsDirSrc: "src/libs",
libsList: {
  "@reliverse/relidler-cfg": {
    libDeclarations: true,
    libDescription: "@reliverse/relidler defineConfig",
    libDirName: "cfg",
    libMainFile: "cfg/cfg-main.ts",
    libPkgKeepDeps: false,
    libTranspileMinify: true,
  },
},
```

**Relidler Task Commands**:

- `// relidler-replace-me` tells Relidler to grab the contents of `../../types.ts` and inject them directly in place of your command definition.

  ```ts
  export * from "../../types.js"; // relidler-replace-me
  // OR:
  export type { SpecificTypeName1, SpecificTypeName2 } from "../../types.js"; // relidler-replace-me
  ```

- More magic commands coming soon...

---

### 2. `tools-relidler-plugin`

Lets you run standalone Relidler features directly from the CLI:

```bash
relidler tools --tool <tool> --input <dir> --out <file> [options]
```

**Available tools**:

- `agg`: Generates aggregator file with content like `export { getSomething } from "./utils.js"`. **Note**: Currently it replaces the file content, not appends.

**Usage example**: If you're exploring the example [Playground](#playground), you can try the following:

1. Open [src/libs/sdk/sdk-main.ts](https://github.com/reliverse/relidler-js-bundler/blob/main/src/libs/sdk/sdk-main.ts) in your IDE.
2. Press `Ctrl+A`, then `Backspace`. Run the command below and watch the magic happen:

```bash
bun tools:agg # Shortcut for:
bun src/main.ts tools --dev --tool agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-main.ts --recursive --named --strip src/libs/sdk
```

## API (for advanced users)

The SDK lets you build custom Relidler CLI plugins or even extend your own CLI tools.

```sh
bun add @reliverse/relidler-sdk
```

**Usage example**: [@reliverse/cli](https://github.com/reliverse/cli-website-builder) leverages this SDK to extend its functionality.

## TODO

- [x] ~~Implement stable `regular` build and publish~~
- [ ] Implement stable `library` build and publish
- [ ] Achieve full drop-in replacement for `unbuild`
- [ ] Support auto migration from `build.config.ts`
- [ ] Allow plugins to extend Relidler's `defineConfig`
- [ ] Support configuration via `reliverse.{ts,jsonc}`
- [ ] Make config file optional with sensible defaults

## Related

Special thanks to the project that inspired `@reliverse/relidler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## Support

- If Relidler saves you time and effort, please consider supporting its development: [GitHub Sponsors](https://github.com/sponsors/blefnk);
- Even a simple star on [GitHub](https://github.com/reliverse/relidler) shows your love. Thank you!

## License

🩷 [MIT](./LICENSE) © 2025 [blefnk Nazar Kornienko](https://github.com/blefnk)
