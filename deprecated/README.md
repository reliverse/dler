# Dler v1

> **📜 Note:**  
> You are reading the README for the **deprecated version** of **Dler (v1)** — **`@reliverse/dler-v1`** (`library + CLI`) located at `./deprecated/dler-v1/README.md`.
>
> The **new and actively maintained version (v2+)** is available here: 👉 [github.com/reliverse/dler](https://github.com/reliverse/dler) as **`@reliverse/dler` (CLI)** and **`@reliverse/dler-*` (libraries)**.

## What is Dler?

- [💖 Sponsor](https://github.com/sponsors/blefnk)  
- [💬 Discord](https://discord.gg/pb8ukbwpsj)  
- [📦 GitHub](https://github.com/reliverse/dler)  
- [📃 npm](https://npmjs.com/@reliverse/dler)

Both **@reliverse/dler-v1** and **@reliverse/dler** (formerly *relidler*; pronounced */ˈdiː.lər/*, "dealer") are frameworks designed to make **TypeScript/JavaScript library and CLI tool development** easier, faster, and more consistent.

Think of it as **Next.js**, but for libraries and CLI tools.  

Dler v1 is both:

- 🧩 A **unified package manager extension** for bun, pnpm, yarn, npm. v2 is for bun only.
- ⚡ A **modern framework** for creating, building, bundling, and publishing your JS/TS projects to npm and JSR.

## Core Features

- **Universal Bundler** — Fully automated build tool with out‑of‑the‑box TypeScript support.  
- **One‑Command Publishing** — Quickly release your packages to npm and JSR.  
- **Codemod Toolkit** — Modern utilities for refactoring and maintaining TS/JS codebases.  
- **Cross‑Package Integration** — Works seamlessly with other package managers.  
- **Flexible API** — Extend or automate workflows for any kind of JS/TS project.

## features

- **drop-in `unjs/unbuild` support** with extended capabilities like publishing
- **automated publishing** to npm and jsr with smart workflow orchestration
- **reliable builds** with robust typescript/javascript support and error handling
- **smart versioning** with semantic release and automatic version bumping
- **zero-config setup** — forget about `package.json` maintenance
- **built-in bun environment** when used as a standalone cli app
- **performance-optimized** using fast build pipelines and aggressive caching
- **17 built-in commands** — see [dler commands](/rse/cmds) for everything it can do
- **path alias resolution** — automatically rewrites tsconfig aliases to relative imports
- **configurable by design** — dedicated config files with sane defaults
- **dual interface** — use via cli or import as sdk for programmatic use
- **clean dist output** — strips internal logs and debug code automatically
- **monorepo support** with experimental `libs` mode for multi-library setups
- **magic spells** — plugin system for custom build logic and extensions
- **codemod toolkit** — powerful code transformation utilities out of the box
- **full monorepo system** with optimized cross-package dependency handling
- **esp. designed for** cli tool creators, project bootstrappers (like [rse](https://github.com/reliverse/rse))
- **perfect for** anyone who wants their package manager to have *sweet powers*

## getting started

before using dler, make sure you have [git](https://git-scm.com/downloads), [node.js](https://nodejs.org/en/download), and a supported package manager installed — **[bun](https://bun.sh/get) is highly recommended** for the best experience.

### 0. try the playground

> 💡 **tip**
> curious to see dler in action before integrating it into your project?
> clone the repo and try e.g. `bun dler build` to build dler using... dler itself!

```sh
git clone https://github.com/reliverse/dler.git
cd dler
bun i
bun dler build # runs dler bun ts edition from source (cli entry: npm/dler.ts)
```

### 1. install dler

it is recommended to install dler both globally and as a dev dependency:

- **global install** — `bun add -g @reliverse/dler` — lets you use dler anywhere, like a system-level cli.
- **dev dependency** — `bun add -D @reliverse/dler` — pins the version per project, so all contributors use the same version.

instead of global install, you can alternatively install dler as a standalone binary: `bunx @reliverse/dler`

> usage depends on how dler is installed:
>
> - `dler` → if installed globally (or as standalone binary)
> - `bun dler` → if installed as a dev dependency

### 2. initialize dler config

first-time dler run initializes config, repeatable runs launches dler interactive menu.

```sh
bun dler # if installed locally
dler     # if installed globally
```

this creates a starter config file: `.config/dler.ts`

- it is recommended to tweak the config to match your project structure
- example config: [.config/dler.ts →](https://github.com/reliverse/dler/blob/main/.config/dler.ts)
- useful options:

  - `buildPreExtensions`: support additional file types like `["ts", "js", "vue", "tsx", "jsx"]`
  - `buildTemplatesDir`: exclude a directory from being built; it will be copied as-is (e.g. `src/foo/templates → dist-*/bin/foo/templates`)

### 3. run and enjoy

```sh
bun dler [build|pub|--help] # if local
dler [build|pub|--help]     # if global
```

> 💡 run `dler` for an interactive menu, or `dler --help` for full command list.

### 4. upgrade your dev tools

keeping your tools fresh is always a good practice.

the command below **upgrades not just dler**, but also your local setup — including `git`, `node.js`, `bun`, `npm`, `yarn`, `pnpm`, and more.

just run:

```sh
bun dler upgrade
```

> ⚠️ don’t confuse this with `dler update`, which upgrades your **project dependencies** and **global packages**, not your system tools.
> 👉 *note:* both `upgrade` and `update` will update **dler** itself — globally and in your `dependencies` or `devDependencies` if run inside a project with a `package.json` — depends on how dler is installed.

## contributors

### helper scripts

- `libs:pack`: Creates two templates, `cfg` and `sdk`, based on dist-libs directory structure (using **dler pack** command).
- `libs:unpack`: Creates a project structure using all templates from the `cfg` and `sdk` templates (using **dler unpack** command).
- `libs:example`: Since `libs:unpack`'s serves as a dist-libs mock, then `libs:example` helps easily test dler's features like `resolveAllCrossLibs()`.

### how to build

#### ts bun binaries

```bash
bun dler build binary
```

#### rust binaries

```bash
cargo build --release # release build is used for publishing
cargo build # debug build is used for development testing
```

### notes

- `dlerust` and `dlergo` are temporary names for the experimental rust and go binaries, they will be probably changed to `dler` in the future (or... maybe not 😅)
- `<src | dist-npm | dist-jsr>/libs/<lib-name>/<files live here>` === `dist-libs/<lib-name>/<jsr | npm>/bin/<files live here>`

### todo

- [ ] `dist-*`-> `dist/dist-*`
- [x] implement stable `regular` build and publish
- [ ] implement stable `library` build and publish
- [ ] achieve full drop-in replacement for `unbuild`
- [ ] support auto migration from `build.config.ts`
- [ ] support configuration via `.config/rse.{ts,jsonc}` 🤔
- [ ] make config file fully optional with sensible defaults
- [ ] use `dler remdn` ([@reliverse/remdn](https://github.com/reliverse/remdn)) to generate npm/jsr specific readme and a single `docs` dir for a whole project (only readmes will be published, docs are only stored in project's source cpde and can be deployed to user's website)
- [x] allow plugins to extend dler's `defineconfig` (`hooksBeforeBuild` and `hooksAfterBuild` are now available, plugin's options can be passed directly to plugin's params, e.g. `hooksBeforeBuild: [ async () => { await myCoolPlugin({ /* plugin's options */ }); } ],`)
- [ ] at the moment any bundler like `mkdist` can be called using `bun`, but bun's own bundler is not yet fully supported
- [ ] support all well-known package managers (currently only bun is fully supported)
- [ ] `dler <command> [...flags] [...args]` usage should support both `bun` and `dler` own commands and flags
- [ ] fully support deno and jsr

## related

special thanks to the project that inspired `@reliverse/dler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## support

- if dler saves you time and effort, please consider supporting its development: [github sponsors](https://github.com/sponsors/blefnk);
- even a simple star on [github](https://github.com/reliverse/dler) shows your love. thank you!

## license

🩷 [mit](./license) © 2025 [blefnk nazar kornienko](https://github.com/blefnk)
