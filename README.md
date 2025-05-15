# dler (prev. relidler) • reliverse bundler

> @reliverse/dler (`/ˈdiː.lər/`, dealer) is a flexible, unified, and fully automated bundler for typescript and javascript projects, as well as an npm and jsr publishing tool. dler is not only a bundler, it also tries to serve as the most powerful codemod toolkit for js/ts.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/pb8ukbwpsj) — [repo](https://github.com/reliverse/dler) — [npm](https://npmjs.com/@reliverse/dler) — [docs](https://docs.reliverse.org/reliverse/dler)

## features

- 😘 replacement for `unjs/unbuild`
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
- 🔜 `libraries` plugin —> dler monorepo implementation
- 🪄 magic spells (built-in plugin)

### supported bundlers

- ✅ [mkdist](https://github.com/unjs/mkdist#readme)
- ✅ jsr
- 🏗️ copy
- 🏗️ [bun](https://bun.sh/docs/bundler)
- 🏗️ [rollup](https://rollupjs.org)
- 🏗️ [untyped](https://untyped.unjs.io)
- 🔜 [tsdown](https://rolldown.rs)
- 🔜 copy (prev. jsr)

**legend**:

- ✅ well tested with big projects
- 🏗️ not well tested yet
- 🔜 coming soon

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
bun dev # bun src/mod.ts --dev
```

### installation

1. **install**:

    **install as dev dep (recommended)**:

    ```sh
    bun add -D @reliverse/dler
    # or update as needed:
    bun update --latest
    ```

    **or install globally**:

    ```sh
    bun i -g @reliverse/dler
    # or update as needed:
    bun -g update --latest
    ```

2. **prepare your project**:

    a. **configure `.gitignore`**:

    ```sh
    echo "dist*" >> .gitignore
    echo "logs" >> .gitignore
    ```

    b. **install config intellisense**:

    ```sh
    bun add -d @reliverse/dler-cfg
    ```

    c. **add `".config/**/*.ts"` to `include` in `tsconfig.json`**:

    ```json
    "include": [".config/**/*.ts", ...]
    ```

    d. **package.json**:

    ```json
    "scripts": {
      "build": "dler build", // this is optional
      "pub": "dler pub" // this does build+publish
    }
    ```

    e. **initialize config**:

    ```sh
    bun [build|pub] # if installed as dev dep
    dler [build|pub] # if installed globally
    ```

    - the `.config/dler.ts` file is automatically created on first run.
    - **it's recommended to customize this file according to your needs.**
    - you can check an example config here: [.config/dler.ts](https://github.com/reliverse/dler/blob/main/.config/dler.ts)

3. **run and enjoy**:

    ```sh
    bun [build|pub] # if installed as dev dep
    dler [build|pub] # if installed globally
    ```

## 🔌 plugins

dler ships with a flexible plugin system and **15 built-in plugins** (from [@reliverse/addons](https://reliverse.org/addons)).

feel free to create your own plugins. plugins can be implemented as built-in directly in `src/app/plugin-name/impl/*` and then imported from `src/app/plugin-name/cmd.ts`; or implemented in your own library and then imported from `src/app/plugin-name/cmd.ts`.

### 1. `agg`

generates aggregator file with content like `import { getsomething } from "./utils.js"`.

```bash
dler agg ...
```

### 2. `auth`

best friend of auth+db libs like [better-auth](https://better-auth.com) and [drizzle-orm](https://orm.drizzle.team).

```bash
dler auth better-auth generate
```

### 3. `build`

since dler is fully modular, build command is separated for its own build-in plugin as well.

```bash
dler build ...
```

### 4. `conv`

not yet documented.

### 5. `deps`

finds missing dependencies in your project by scanning your code for imports and comparing them to your `package.json`.

**what it does:**

- traverses all `.js`, `.jsx`, `.ts`, and `.tsx` files in your project (by default, in the current directory)
- detects all used packages, including scoped ones (`@org/dep-name`)
- supports both es modules (`import ... from "dep"`) and commonjs (`require("dep")`)
- normalizes deep imports like `dep/some/file` to just `dep`
- ignores local/relative imports (`./foo`, `../bar`)
- skips `node_modules`, `.git`, and common build folders
- compares all used packages to those listed in your `package.json`
- shows you which dependencies are missing (not listed)
- can also show all used dependencies (listed and missing)
- optionally includes node.js built-in modules in the report
- outputs results in a readable format or as json

**usage examples:**

```bash
# basic usage - scan current directory
dler deps

# scan a specific directory
dler deps --directory ./my-project

# show all dependencies (both listed and missing)
dler deps --all

# ignore specific patterns
dler deps --ignore "test/**,example/**"

# output in json format
dler deps --json

# include node.js built-in modules
dler deps --include-builtins

# combine options
dler deps --all --directory ./src --include-builtins
```

**pro tip:**  
missing dependencies are shown only once, even if used in multiple files.  
deep imports like `dep/some/file` or `@org/dep/some/thing` are always resolved to their root package.

### 6. `inject`

not yet documented.

### 7. `libs`

builds and publishes specific subdirectories of your main project as standalone packages.

**usage example**:  
using `@reliverse/dler-cfg` to package [src/libs/cfg](https://github.com/reliverse/dler/tree/main/src/libs/cfg):

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
    libmainfile: "cfg/cfg-mod.ts",
    libpkgkeepdeps: false,
    libtranspileminify: true,
  },
},
```

**dler task commands**:

- `// dler-replace-line` tells dler to grab the contents of `../../types.ts` and inject them directly in place of your command definition.

  ```ts
  export * from "../../types.js"; // dler-replace-line
  // or:
  export type { specificTypeName1, specificTypeName2 } from "../../types.js"; // dler-replace-line
  ```

- more magic commands coming soon...

### 8. `merge`

not yet documented.

### 9. `mono`

not yet documented.

### 10. `pub`

pub command is separated for its own build-in plugin as well.

it already calls build command by itself, so you don't need to run `dler build` separately.

```bash
dler pub ...
```

### 11. `relifso`

```bash
dler relifso init ...
```

### 12. `relinka`

@reliverse/relinka's best friend. learn more in its [docs](https://github.com/reliverse/relinka).

```bash
dler relinka --console-to-relinka
```

### 13. `rempts`

@reliverse/rempts's best friend. learn more in its [docs](https://github.com/reliverse/rempts).

```bash
dler rempts init --cmd my-cmd-1
dler rempts init --cmds
```

### 14. `spell`

**available spell types:**

- `replace-line` — injects contents from one file into another
- `rename-file` — renames the current file
- `remove-comment` — removes a specific comment from code
- `remove-line` — removes a specific line from code
- `remove-file` — deletes the current file
- `transform-content` — applies a transformation to the file content
- `copy-file` — copies the current file to a new location
- `move-file` — moves the current file to a new location
- `insert-at` — inserts content at a specific position in the file

**params:**

params are optional and comma-separated.

currently, only the first param is supported:

- `hooked` (boolean, default: `false`)  
  - `false`: dler handles the spell automatically at postbuild  
  - `true`: disables default behavior, so you can trigger the spell yourself (e.g. from your own cli function)

more params coming soon...

**usage examples:**

- `export * from "../../types.js"; // <dler-replace-line-{hooked=false}>` — injects file contents at this line
- `// @ts-expect-error <dler-remove-comment-{hooked=false}>` — removes just this comment
- `// <dler-remove-line-{hooked=false}>` — removes this line
- `// <dler-remove-file-{hooked=false}>` — deletes this file
- `// <dler-rename-file-"tsconfig.json"-{hooked=false}>` — renames this file (runs at postbuild because `hooked=false`)

**using `hooked=true`:**

- `// <dler-rename-file-"tsconfig.json"-{hooked=true}>` — renames the file, but only when you trigger it yourself (hooked from your side)

**triggering spells:**

from dler’s cli:  

- `dler spell --trigger rename-file,... --files tsconfig.json,...`
- `dler spell --trigger all`
- `dler spell`

from your own code:

```ts
await dler.spell({ spells: ["rename-file"], files: [] });
// await dler.spell({}) // means all spells and all files
// spell: ["all"] // means all spells
// spell: [] // means all spells
// files: [] // means all files
```

p.s. [see how rse cli uses hooked=true](https://github.com/reliverse/rse/blob/main/src/postbuild.ts)

### 15. `tools`

lets you run standalone dler features directly from the cli:

```bash
dler tools --tool <tool> --input <dir> --out <file> [options]
```

**available tools**:

- `agg`: generates aggregator file with content like `export { getsomething } from "./utils.js"`. **note**: currently it replaces the file content, not appends.

**usage example**: if you're exploring the example [playground](#playground), you can try the following:

1. open [src/libs/sdk/sdk-mod.ts](https://github.com/reliverse/dler/blob/main/src/libs/sdk/sdk-mod.ts) in your ide.
2. press `ctrl+a`, then `backspace`. run the command below and watch the magic happen:

```bash
bun tools:agg # shortcut for:
bun src/mod.ts tools --dev --tool agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-mod.ts --recursive --named --strip src/libs/sdk
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
- [ ] support configuration via `.config/rse.{ts,jsonc}`
- [ ] make config file optional with sensible defaults

## related

special thanks to the project that inspired `@reliverse/dler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## support

- if dler saves you time and effort, please consider supporting its development: [github sponsors](https://github.com/sponsors/blefnk);
- even a simple star on [github](https://github.com/reliverse/dler) shows your love. thank you!

## license

🩷 [mit](./license) © 2025 [blefnk nazar kornienko](https://github.com/blefnk)
