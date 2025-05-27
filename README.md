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
- 🔌 plugin system with 14 built-in plugins included
- 📝 highly configurable flow via a configuration file
- 🔜 `libraries` plugin —> dler monorepo implementation
- 🧼 cleans up your internal logs from the build dist
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
bun dev # bun src/cli.ts --dev
```

### installation

1. **install**:

    **install as dev dep (recommended)**:

    ```sh
    bun add -D @reliverse/dler
    # or update as needed:
    bun update --latest
    ```

    **and/or install globally**:

    ```sh
    bun add -g @reliverse/dler
    # or update as needed:
    bun i -g update --latest
    ```

2. **prepare your project**:

    a. **configure `.gitignore`**:

    ```sh
    echo "dist*" >> .gitignore
    echo "logs" >> .gitignore
    ```

    b. **add `".config/**/*.ts"` to `include` in `tsconfig.json`**:

    ```json
    "include": [".config/**/*.ts", ...]
    ```

    c. **package.json**:

    ```json
    "scripts": {
      "build": "dler build", // this is optional
      "pub": "dler pub" // this does build+publish
    }
    ```

    d. **initialize config**:

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

dler ships with a flexible plugin system (aka plugins) and **14 built-in plugins** (from [reliverse addons](https://reliverse.org/addons) collection).

feel free to create your own plugins. plugins can be implemented as built-in directly in `src/app/<plugin>/impl/*` and then imported from `src/app/<plugin>/cmd.ts`; or implemented in your own library and then imported from `src/app/<plugin>/cmd.ts`.

if you run just `dler` — it will display a list of plugins which you can launch interactively.

## **available plugins**

[agg](#1-agg), [build](#2-build), [conv](#3-conv), [deps](#4-deps), [inject](#5-inject), [libs](#6-libs), [merge](#7-merge), [migrate](#8-migrate), [mono](#9-mono), [pub](#10-pub), [relifso](#11-relifso), [relinka](#12-relinka), [rempts](#13-rempts), [spell](#14-spell), [split](#15-split).

### 1. `agg`

generates aggregator file with content like `import { getsomething } from "./utils.js"`.

```bash
# interactively:
dler > "agg"
# non-interactively:
dler agg --input <dir> --out <file> [options]
```

**usage example**: if you're exploring the example [playground](#playground), you can try the following:

1. open [src/libs/sdk/sdk-mod.ts](https://github.com/reliverse/dler/blob/main/src/libs/sdk/sdk-mod.ts) in your ide.
2. press `ctrl+a`, then `backspace`. run the command below and watch the magic happen:

```bash
bun tools:agg # shortcut for:
bun src/cli.ts tools --dev --tool agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-mod.ts --recursive --named --strip src/libs/sdk
```

### 2. `build`

since dler is fully modular, build command is separated for its own build-in plugin as well.

```bash
dler build ...
```

### 3. `conv`

not yet documented.

### 4. `deps`

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

### 5. `inject`

not yet documented.

### 6. `libs`

builds and publishes specific subdirectories of your main project as standalone packages.

**usage example**:  
using `dler` to package [src/libs/sdk](https://github.com/reliverse/dler/tree/main/src/libs/sdk):

```ts
// .config/dler.ts
libsactmode: "main-and-libs",
libsdirdist: "dist-libs",
libsdirsrc: "src/libs",
libslist: {
  "@reliverse/dler-sdk": {
    libdeclarations: true,
    libdescription: "@reliverse/dler without cli",
    libdirname: "sdk",
    libmainfile: "sdk/sdk-mod.ts",
    libpkgkeepdeps: false,
    libtranspileminify: true,
  },
},
```

**dler task commands**:

- `// dler-replace-line` tells dler to grab the contents of `../../types.ts` and inject them directly in place of your command definition.

  ```ts
  export * from "../../types"; // dler-replace-line
  // or:
  export type { specificTypeName1, specificTypeName2 } from "../../types"; // dler-replace-line
  ```

- more magic commands coming soon...

### 7. `merge`

not yet documented.

### 8. `migrate`

helps migrate between different libraries and module resolution strategies. currently supports:

- `pathe-to-pathkit`: migrate from pathe to pathkit library
- `pathkit-to-pathe`: migrate from pathkit to pathe library
- `module-resolution`: migrate between module resolution strategies

**module resolution targets:**

- `nodenext`: adds `.js` extensions to imports and updates tsconfig
- `bundler`: removes extensions from imports and updates tsconfig

**usage examples:**

```bash
# Migrate from pathe to pathkit
dler migrate --lib pathe-to-pathkit

# Migrate to nodenext module resolution
dler migrate --lib module-resolution --target nodenext

# Migrate to bundler module resolution
dler migrate --lib module-resolution --target bundler

# Preview changes without applying them
dler migrate --lib module-resolution --target nodenext --dryRun
```

**what it does:**

- updates import statements in your code
- modifies tsconfig.json settings
- updates package.json type field
- provides a dry run option to preview changes
- handles both relative and alias imports
- supports both .ts and .tsx files

**next steps after migration:**

- for pathe-to-pathkit:
  1. run 'bun install' to install @reliverse/pathkit
  2. test your application
  3. consider using advanced pathkit features

- for module-resolution:
  1. test your application
  2. ensure your build tools support the new module resolution
  3. review any warnings in the migration output

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
- `replace-range` — replaces a range of lines with content from another file
- `rename-file` — renames the current file
- `remove-comment` — removes a specific comment from code
- `remove-line` — removes a specific line from code
- `remove-file` — deletes the current file
- `transform-content` — applies a transformation to the file content
- `transform-line` — applies a transformation to a specific line
- `copy-file` — copies the current file to a new location
- `move-file` — moves the current file to a new location
- `insert-at` — inserts content at a specific position in the file
- `insert-before` — inserts content before a specific line
- `insert-after` — inserts content after a specific line
- `conditional-execute` — executes spells conditionally

**params:**

params are optional and comma-separated.

- `hooked` (boolean, default: `true`)  
  - `true`: disables default behavior, so you can trigger the spell yourself (e.g. from your own cli function)
  - `false`: dler handles the spell automatically at postbuild
- `startLine` (number) — line number to start the operation (for range operations)
- `endLine` (number) — line number to end the operation (for range operations)
- `condition` (string) — condition to check before executing the spell
- `skipIfMissing` (boolean) — whether to skip the spell if the target file doesn't exist
- `createDir` (boolean) — whether to create the target directory if it doesn't exist

**usage examples:**

- `export * from "../../types"; // dler-replace-line` — injects file contents at this line (hooked=true by default)
- `// @ts-expect-error dler-remove-comment` — removes just this comment (hooked=true by default)
- `// dler-remove-line` — removes this line (hooked=true by default)
- `// dler-remove-file` — deletes this file (hooked=true by default)
- `// dler-rename-file-"tsconfig.json"-{hooked=false}` — renames this file (runs at postbuild because `hooked=false`)
- `// dler-replace-range-"../../types.js"-{startLine=1,endLine=5}` — replaces lines 1-5 with content from types.js
- `// dler-transform-line-"return line.toUpperCase()"` — transforms the line to uppercase
- `// dler-insert-before-"import { x } from 'y';"` — inserts import statement before this line
- `// dler-insert-after-"export { x };"` — inserts export statement after this line
- `// dler-conditional-execute-{condition="content.includes('TODO')"}` — executes spells only if file contains TODO

**using `hooked=false`:**

- `// dler-rename-file-"tsconfig.json"-{hooked=false}` — renames the file immediately at postbuild (not hooked)

**triggering spells:**

from dler's cli:  

- `dler spell --trigger rename-file,... --files tsconfig.json,...`
- `dler spell --trigger all`
- `dler spell`

from your own code:

```ts
await dler.spell({ spells: ["rename-file"], files: [] });
await dler.spell({}) // all spells, all files
spells: ["all"] // means all spells
spells: [] // also means all spells
files: [] // means all files
```

p.s. [see how rse cli uses hooked=true](https://github.com/reliverse/rse/blob/main/src/postbuild.ts)

### 15. `split`

splits your code/text file into multiple files.

```bash
dler split ...
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
