# dler (prev. relidler) • reliverse bundler

[💖 github sponsors](https://github.com/sponsors/blefnk) — [💬 discord](https://discord.gg/pb8ukbwpsj) — [✨ repo](https://github.com/reliverse/dler-js-bundler) — [📦 npm](https://npmjs.com/@reliverse/dler) — [📚 docs](https://docs.reliverse.org)

> @reliverse/dler (`/ˈdiː.lər/`, dealer) is a flexible, unified, and fully automated bundler for typescript and javascript projects, as well as an npm and jsr publishing tool.

## features

- 😘 replacement for `unbuild`
- ⚡ `dler` works via cli and sdk
- 📦 automated npm/jsr publishing
- ✅ ensures reliable js/ts builds
- 🔄 handles automatic version bumps
- 🔧 eliminates `package.json` headaches
- 🎯 optimized for speed and modern workflows
- ✨ packed with powerful features under the hood
- 🛠️ converts typescript aliases to relative paths
- 🔌 plugin system with two built-in plugins included
- 📝 highly configurable flow via a configuration file

## getting started

ensure git, node.js, and bun/pnpm/yarn/npm are installed. then:

### playground

> **💡 tip**:
> want to test dler before integrating it into your project?
> clone the repo and build it using dler itself!

```sh
git clone https://github.com/reliverse/dler.git
cd dler
bun i
bun dev # bun src/main.ts --dev
```

### installation

1. **install globally**:

    ```sh
    bun i -g @reliverse/dler
    ```

    **or update as needed**:

    ```sh
    bun -g update --latest
    ```

2. **prepare your project**:

    a. **configure `.gitignore`**:

    ```sh
    echo "*.log" >> .gitignore
    echo "dist-npm" >> .gitignore
    echo "dist-jsr" >> .gitignore
    echo "dist-libs" >> .gitignore
    ```

    b. **install config intellisense**:

    ```sh
    bun add -d @reliverse/dler-cfg
    ```

    c. **initialize config**:

    ```sh
    dler cli
    ```

    - the `.config/dler.ts` file is automatically created on first run.
    - **it's recommended to customize this file according to your needs.**
    - you can check an example config here: [.config/dler.ts](https://github.com/reliverse/dler-js-bundler/blob/main/.config/dler.ts)

3. **run and enjoy**:

    ```sh
    dler cli
    ```

## 🔌 plugins

dler includes a plugin system with **two built-in plugins** (from [@reliverse/addons](https://github.com/reliverse/addons)):

### 1. `libraries-dler-plugin`

builds and publishes specific subdirectories of your main project as standalone packages.

**usage example**:  
using `@reliverse/dler-cfg` to package [src/libs/cfg](https://github.com/reliverse/dler-js-bundler/tree/main/src/libs/cfg):

```ts
// .config/dler.ts
libsactmode: "main-and-libs",
libsdirdist: "dist-libs",
libsdirsrc: "src/libs",
libslist: {
  "@reliverse/dler-cfg": {
    libdeclarations: true,
    libdescription: "@reliverse/dler defineconfig",
    libdirname: "cfg",
    libmainfile: "cfg/cfg-main.ts",
    libpkgkeepdeps: false,
    libtranspileminify: true,
  },
},
```

**dler task commands**:

- `// dler-replace-me` tells dler to grab the contents of `../../types.ts` and inject them directly in place of your command definition.

  ```ts
  export * from "../../types.js"; // dler-replace-me
  // or:
  export type { specificTypeName1, specificTypeName2 } from "../../types.js"; // dler-replace-me
  ```

- more magic commands coming soon...

---

### 2. `tools-dler-plugin`

lets you run standalone dler features directly from the cli:

```bash
dler tools --tool <tool> --input <dir> --out <file> [options]
```

**available tools**:

- `agg`: generates aggregator file with content like `export { getsomething } from "./utils.js"`. **note**: currently it replaces the file content, not appends.

**usage example**: if you're exploring the example [playground](#playground), you can try the following:

1. open [src/libs/sdk/sdk-main.ts](https://github.com/reliverse/dler-js-bundler/blob/main/src/libs/sdk/sdk-main.ts) in your ide.
2. press `ctrl+a`, then `backspace`. run the command below and watch the magic happen:

```bash
bun tools:agg # shortcut for:
bun src/main.ts tools --dev --tool agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-main.ts --recursive --named --strip src/libs/sdk
```

## api (for advanced users)

the sdk lets you build custom dler cli plugins or even extend your own cli tools.

```sh
bun add @reliverse/dler-sdk
```

**usage example**: [@reliverse/rse](https://github.com/reliverse/rse-website-builder) leverages this sdk to extend its functionality.

## todo

- [x] ~~implement stable `regular` build and publish~~
- [ ] implement stable `library` build and publish
- [ ] achieve full drop-in replacement for `unbuild`
- [ ] support auto migration from `build.config.ts`
- [ ] allow plugins to extend dler's `defineconfig`
- [ ] support configuration via `reliverse.{ts,jsonc}`
- [ ] make config file optional with sensible defaults

## related

special thanks to the project that inspired `@reliverse/dler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## support

- if dler saves you time and effort, please consider supporting its development: [github sponsors](https://github.com/sponsors/blefnk);
- even a simple star on [github](https://github.com/reliverse/dler) shows your love. thank you!

## license

🩷 [mit](./license) © 2025 [blefnk nazar kornienko](https://github.com/blefnk)
