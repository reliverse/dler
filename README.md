# 🧬 dler • extend your bun/pnpm/yarn/npm usage

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/pb8ukbwpsj) — [github](https://github.com/reliverse/dler) — [npm](https://npmjs.com/@reliverse/dler)

> @reliverse/dler (formerly relidler; `/ˈdiː.lər/`, dealer) is like nextjs, but for libraries and cli tools development. it is both a unified package manager for typescript/javascript projects and a flexible framework for creating, building, and publishing js/ts libraries to npm and jsr.
>
> dler is your package manager’s best friend — it extends bun, deno (🔜), pnpm, yarn, and npm with powerful and modern features.
>
> at its core, dler is a flexible and fully automated bundler that also doubles as an npm/jsr publishing tool. beyond bundling, dler provides a rich codemod toolkit designed for modern typescript/javascript development.
>
> dler-sdk serves also like a terminal component library, its like shadcn but for libraries and cli tools.

## features

- **drop-in `unjs/unbuild` support** with extended capabilities like publishing
- **automated publishing** to npm and jsr with smart workflow orchestration
- **reliable builds** with robust typescript/javascript support and error handling
- **smart versioning** with semantic release and automatic version bumping
- **zero-config setup** — forget about `package.json` maintenance
- **built-in bun environment** when used as a standalone cli app
- **performance-optimized** using fast build pipelines and aggressive caching
- **17 built-in commands** — see [dler commands](#dler-commands) for everything it can do
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

## dler commands

dler ships with a flexible command system (prev. plugins) and **17 built-in commands** (from [reliverse addons](https://reliverse.org/addons) collection).

feel free to create your own commands. commands can be implemented as built-in directly in `src/app/<command>/impl/*` and then imported from `src/app/<command>/cmd.ts`; or implemented in your own library and then imported from `src/app/<command>/cmd.ts`.

if you run just `dler` — it will display a list of commands which you can launch interactively.

## **available commands**

[build](#1-build) — [pub](#2-pub) — [agg](#3-agg) — [check](#4-check) — [conv](#5-conv) — [fs](#6-fs) — [init](#7-init) — [inject](#8-inject) — [libs](#9-libs) — [merge](#10-merge) — [migrate](#11-migrate) — [rempts](#12-rempts) — [x](#13-x) — [spell](#14-magic) — [split](#15-split) — [pack](#16-pack)

### 0. `core`

#### `install`

```bash
# Install all dependencies
dler install

# Install with workspace filtering
dler install --filter "pkg-*" --filter "!pkg-c"
dler install --filter "./packages/pkg-*"

# Install specific package in filtered workspaces
dler install lodash --filter "pkg-*"
```

#### `remove`

```bash
# Remove package from all workspaces
dler remove lodash

# Remove from specific workspaces
dler remove lodash --filter "pkg-*" --filter "!pkg-c"
```

#### `update`

when dler detects that you are in a monorepo, it will uses linked dependencies (`--linker`).

```bash
# Update all dependencies
dler update

# Update with workspace filtering
dler update --filter "pkg-*" --filter "!pkg-c"

# Update specific packages in filtered workspaces
dler update lodash --filter "pkg-*"
```

### 1. `build`

since dler is fully modular, build command is separated for its own build-in plugin as well.

```bash
bun dler build ...
```

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

#### 1.1. `build binary` - Standalone Executable Builder

creates standalone executables for different platforms using bun's `--compile` feature.

```bash
# build for default targets (linux x64, windows x64, macos arm64)
bun dler build binary

# build for all supported platforms
bun dler build binary --targets=all

# build for specific platforms
bun dler build binary --targets=bun-linux-x64,bun-windows-x64

# build with optimization
bun dler build binary --bytecode --minify --sourcemap

# windows-specific options
bun dler build binary --windows-icon=icon.ico --windows-hide-console

# debugging options
bun dler build binary --no-compile --external=c12,terminal-kit,problematic-package

# list all available targets
bun dler build binary --targets=list
```

**supported platforms:**

- linux: x64, x64-baseline, x64-modern, arm64 (with glibc/musl variants)
- windows: x64, x64-baseline, x64-modern (with .exe extension)
- macos: x64, arm64

**output files:**

- executables: `mycli-linux`, `mycli-windows.exe`, `mycli-darwin-arm64`
- bundled scripts: `mycli-linux.js`, `mycli-windows.js`, `mycli-darwin-arm64.js`

**typical file sizes:** 60-120mb per executable (includes bun runtime and dependencies)

### 2. `pub`

it already calls build command by itself, so you don't need to run `dler build` separately.

```bash
bun dler pub ...
```

### 3. `agg`

generates aggregator file with content like `import { getsomething } from "./utils.js"`.

```bash
# interactively:
dler > "agg"
# non-interactively:
dler agg --input <dir> --out <file> [options]
```

**usage example**: if you're exploring the example [playground](#0-try-the-playground), you can try the following:

1. open [src/libs/sdk/sdk-mod.ts](https://github.com/reliverse/dler/blob/main/src/libs/sdk/sdk-mod.ts) in your ide.
2. press `ctrl+a`, then `backspace`. run the command below and watch the magic happen:

```bash
bun tools:agg # shortcut for:
bun src/cli.ts tools --dev --tool agg --input src/libs/sdk/sdk-impl --out src/libs/sdk/sdk-mod.ts --recursive --named --strip src/libs/sdk
```

### 4. `check`

checks your project for common issues and potential improvements. This command performs several types of checks (aka rules of dler):

- **File Extensions**: Validates that files have the correct extensions based on their location and module resolution strategy
  - Enforces `.ts` files in source and JSR distributions
  - Enforces `.js` files in NPM distributions
  - Supports `.css` and `.json` files in all environments
  - Adapts to your module resolution strategy (bundler/nodenext)

- **Path Extensions**: Ensures import statements use the correct file extensions
  - Validates import paths match your module resolution strategy
  - Checks for proper extension usage in import statements
  - Supports both relative and absolute imports

- **Dependencies**: Identifies missing dependencies in your project
  - Scans all source files for imports
  - Compares against package.json
  - Reports missing dependencies

- **Self-Include**: Prevents circular dependencies and self-imports
  - Checks for imports from the main package in dist directories
  - Prevents libraries from importing themselves
  - Allows libraries to import from other libraries

- **Module Resolution**: Validates TypeScript module resolution settings
  - Ensures proper moduleResolution in tsconfig.json
  - Supports both "bundler" and "nodenext" strategies
  - Reports configuration issues

- **Dler Config Health**: Validates your dler configuration
  - Checks libs main file format
  - Ensures proper configuration structure
  - Reports configuration issues

- **Package.json Validation**: Ensures your package.json follows best practices
  - Requires: name, version, type=module, keywords
  - Forbids: bin, exports, files, main, module (they are auto-generated by dler)
  - Helps maintain consistent package configuration

```bash
# Fully interactive mode (when no args provided)
dler check

# Mixed mode (some args provided, prompts for the rest)
dler check --directory src
dler check --checks file-extensions,path-extensions
dler check --strict

# Fully automated mode (all args provided)
dler check --directory src --checks file-extensions,path-extensions --strict

# Output in JSON format
dler check --json
```

**arguments:**

- `--directory`: directory to check (src, dist-npm, dist-jsr, dist-libs/npm, dist-libs/jsr, or all)
- `--checks`: comma-separated list of checks to run (missing-deps, file-extensions, path-extensions, dler-config-health, self-include, tsconfig-health, package-json-health)
- `--strict`: enable strict mode (requires explicit extensions)
- `--json`: output results in JSON format

**pro tip:**  
the command will prompt you only for the arguments you haven't provided. for example, if you specify `--directory` but not `--checks`, it will only prompt you to select which checks to run.

**how deps check works**:

finds missing dependencies in your project by scanning your code for imports and comparing them to your `package.json`. This command is particularly useful for maintaining clean dependency lists and preventing runtime errors.

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
- exits with error code 1 if missing dependencies are found
- detects packages that are only in `devDependencies` but used in production code
- identifies packages listed in both `dependencies` and `devDependencies`

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

missing dependencies are shown only once, even if used in multiple files.  
deep imports like `dep/some/file` or `@org/dep/some/thing` are always resolved to their root package.

**warning types:**

- **Missing Dependencies**: Packages that are imported but not listed in `package.json`
- **Dev-only Dependencies**: Packages that are only in `devDependencies` but imported in production code
- **Duplicate Dependencies**: Packages listed in both `dependencies` and `devDependencies`

### 5. `conv`

not yet documented.

### 6. `fs`

```bash
# simple example:
bun dler fs --mode copy --s "src/**/*.ts" --d "dist"
bun dler fs --mode rm --target "node_modules"
bun dler fs --mode rename --source "index.ts" --destination "index.ts.bak"

# advanced example:
bun dler fs --mode copy --s ".temp/packages/*/lib/**/*" --d "src/libs/sdk/sdk-impl/rules/external"
bun dler fs --mode rm --target "**/node_modules"
```

### 7. `init`

not yet documented.

### 8. `inject`

not yet documented.

### 9. `libs`

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
    libmainfile: "sdk-mod.ts",
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

### 10. `merge`

merges multiple files into a single file. The command is built for both CI and interactive use, with support for glob patterns and advanced options.

**key features:**

- merges text files with optional commented path headers/footers
- skips binary/media files by default
- supports both glob patterns and simple paths
- preserves directory structure when merging to a directory
- generates source maps for merged output
- handles file deduplication
- supports custom separators and comment styles
- provides interactive mode with prompts
- includes backup functionality
- validates file permissions and sizes
- enforces output path conflict detection
- handles both single file and directory output modes
- implements interactive prompts via `@reliverse/rempts`
- provides reporting with logging via `@reliverse/relinka`

**usage examples:**

```bash
# simple example:
bun dler merge --s "src/**/*.ts" --d "dist/merged.ts"

# advanced example:
bun dler merge --s ".temp1/packages/*/lib/**/*" --d ".temp2/merged.ts" --sort "mtime" --header "// Header" --footer "// Footer" --dedupe
```

**arguments:**

- `--s`: Input glob patterns (array)
- `--d`: Output file path or directory
- `--ignore`: Extra ignore patterns (array)
- `--format`: Fallback extension when output path is omitted (default: "txt")
- `--stdout`: Print to stdout
- `--noPath`: Don't inject relative path below each file
- `--pathAbove`: Print file path above each file's content (default: true)
- `--separator`: Custom separator (default: "\n\n")
- `--comment`: Custom comment prefix (e.g. '# ')
- `--forceComment`: Force custom comment prefix for all file types
- `--batch`: Disable interactive prompts (CI/non-interactive mode)
- `--recursive`: Recursively process all files in subdirectories (default: true)
- `--preserveStructure`: Preserve source directory structure in output (default: true)
- `--increment`: Attach an incrementing index to each output filename
- `--concurrency`: Number of concurrent file operations (default: 8)
- `--sort`: Sort files by: name, path, mtime, none (default: path)
- `--dryRun`: Show what would be done, but don't write files
- `--backup`: Backup output files before overwriting
- `--dedupe`: Remove duplicate file contents in merge
- `--header`: Header text to add at the start of merged output
- `--footer`: Footer text to add at the end of merged output
- `--select-files`: Prompt for file selection before merging
- `--interactive`: Enable interactive mode with prompts
- `--depth`: Depth level to start processing from (default: 0)
- `--sourcemap`: Generate source map for the merged output

**implementation details:**

- uses `magic-string` for efficient string manipulation and source map generation
- leverages `@reliverse/reglob` for glob pattern matching
- implements concurrent file operations with `p-map`
- provides file type detection and appropriate comment styles
- includes safety checks for file sizes and permissions
- handles both single file and directory output modes
- implements interactive prompts via `@reliverse/rempts`
- provides reporting with logging via `@reliverse/relinka`

### 11. `migrate`

helps migrate between different libraries and module resolution strategies. currently supports:

- `anything-bun`: migrate Node.js projects to Bun runtime
- `path-pathkit`: migrate from node:path and unjs/pathe to pathkit library
- `fs-relifso`: migrate from node:fs and fs-extra to relifso library
- `nodenext-bundler`: migrate between module resolution strategies
- `readdir-glob`: migrate from fs.readdir to globby for better file system operations

**path-pathkit features:**

- Migrates from both `pathe` and `node:path` to `@reliverse/pathkit`
- Handles both default and named exports
- Supports multi-line imports
- Converts require statements
- Updates package.json dependencies

**fs-relifso features:**

- Migrates from both `node:fs` and `fs-extra` to `@reliverse/relifso`
- Handles both default and named exports
- Supports multi-line imports
- Converts require statements
- Updates package.json dependencies
- Preserves import structure and formatting

**anything-bun features:**

- Migrates Node.js imports to use `node:` prefix
- Replaces npm/yarn/pnpm features with bun equivalents
- Converts to Bun-native APIs:
  - Database: `pg`/`postgres` → `Bun.sql`, `sqlite3` → `bun:sqlite`
  - Redis: `redis`/`ioredis` → `Bun.redis`
  - Utilities: `glob` → `Bun.Glob`, `bcrypt`/`argon2` → `Bun.password`
  - Testing: `jest`/`vitest` → `bun:test`
  - FFI: `node-ffi` → `bun:ffi`
- Transforms file operations to `Bun.file` API
- Converts Express apps to `Bun.serve`
- Updates package.json scripts and dependencies
- Generates Bun configuration files
- Creates Dockerfile for Bun deployment

**readdir-glob features:**

- Migrates from `fs.readdir` and `fs.readdirSync` to `globby`
- Handles both synchronous and asynchronous readdir operations
- Supports `fs.promises.readdir` migration
- Adds globby import if not present
- Updates package.json with globby dependency
- Preserves target directory paths
- Maintains async/await usage

**usage examples:**

```bash
# Preview changes without applying them
dler migrate --lib readdir-glob --dryRun

# Apply changes
dler migrate --lib readdir-glob

# Migrate specific project
dler migrate --lib readdir-glob --project ./my-app
```

**module resolution targets:**

- `nodenext`: adds `.js` extensions to imports and updates tsconfig
- `bundler`: removes extensions from imports and updates tsconfig

**usage examples:**

```bash
# Migrate from node:path and/or pathe to pathkit
dler migrate --lib path-pathkit

# Migrate from node:fs and/or fs-extra to relifso
dler migrate --lib fs-relifso

# Migrate to nodenext module resolution
dler migrate --lib nodenext-bundler --target nodenext

# Migrate to bundler module resolution
dler migrate --lib nodenext-bundler --target bundler

# Preview changes without applying them
dler migrate --lib nodenext-bundler --target nodenext --dryRun
```

**what it does:**

- updates import statements in your code
- modifies tsconfig.json settings
- updates package.json type field
- provides a dry run option to preview changes
- handles both relative and alias imports
- supports both .ts and .tsx files

**`console-relinka`**:

[@reliverse/relinka](https://github.com/reliverse/relinka)'s best friend. Converts between different logging formats (console, consola method/object, and relinka's function/method/object styles).

```bash
# Basic usage
dler relinka --input <file> --from <source> --to <target>

# Examples:
# Convert console.log to relinka function style
dler relinka --input src/app.ts --from console --to relinkaFunction

# Convert consola method to relinka method style
dler relinka --input src/app.ts --from consolaMethod --to relinkaMethod

# Convert between relinka styles
dler relinka --input src/app.ts --from relinkaMethod --to relinkaObject

# Convert to consola object style
dler relinka --input src/app.ts --from relinkaFunction --to consolaObject
```

**Supported formats**:

- `console`: Standard console logging (`console.log(message, ...args)`)
- `consolaMethod`: Consola method style (`consola.log(message, ...args)`)
- `consolaObject`: Consola object style (`consola({ level, message, title?, args? })`)
- `relinkaFunction`: Relinka function style (`relinka("level", message, ...args)`)
- `relinkaMethod`: Relinka method style (`relinka.level(message, ...args)`)
- `relinkaObject`: Relinka object style (`relinka({ level, message, title?, args? })`)

**Special features**:

- Preserves additional arguments in all formats
- Handles special box format with title and message
- Maintains proper escaping and formatting
- Supports conversion between any combination of formats
- Supports both consola method and object styles

**next steps after migration**:

- for path-pathkit:
  1. run 'bun install' to install @reliverse/pathkit
  2. test your application
  3. consider using advanced pathkit features

- for fs-relifso:
  1. run 'bun install' to install @reliverse/relifso
  2. test your application
  3. review any file system operations that might need manual updates

- for nodenext-bundler:
  1. test your application
  2. ensure your build tools support the new module resolution
  3. review any warnings in the migration output

- for anything-bun:
  1. run 'bun install' to install dependencies with Bun
  2. test your application thoroughly
  3. review async/await usage in converted file operations
  4. update any custom database queries to use Bun.sql syntax
  5. review and update any custom middleware in Express apps

- for readdir-glob:
  1. run 'bun install' to install globby
  2. test your application
  3. review any file system operations that might need manual updates
  4. consider using globby's advanced features like pattern matching and recursive searching

### 12. `rempts`

@reliverse/rempts's best friend. learn more in its [docs](https://github.com/reliverse/rempts).

```bash
bun dler rempts
bun dler rempts --init cmd1 cmd2
```

### 13. `x`

`dler x` — your package manager — refined.

```bash
bun dler x ...
```

### 14. `magic`

**programmatic usage:**

```ts
function main() {
  // may be useful when your cli is a project bootstrapper tool like @reliverse/rse
  // so you can apply spells to each bootstrapped by you cli project's file
  await applyMagicSpells(["my-target-dir"]);
}
await main();
```

**or, call it from dler config's hook**:

```ts
{
  hooksAfterBuild: [
    async () => {
      // useful when you want to apply spells right after dler's build
      await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs"]);
    }
  ],
}
```

**or, use `dler magic`**:

```bash
dler magic --targets "my-target-dir"
```

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

> Contributors: Please check the [docs/cmds/SPELLS.md](./docs/cmds/SPELLS.md) file for more technical details.

### 15. `split`

splits your code/text file into multiple files.

```bash
bun dler split ...
```

### 16. `pack`

packs a directory of templates into TypeScript modules. This command is useful for creating reusable template packages that can be distributed and used by other projects.

**key features:**

- Converts directory structure into TypeScript modules
- Handles binary files with automatic hashing and storage
- Preserves JSON comments and formatting
- Supports custom whitelabeling
- Generates type-safe template definitions
- Creates an aggregator module for easy imports
- Tracks file metadata (update time and content hash)
- Supports selective file updates
- Handles file conflicts gracefully
- Preserves JSON type information for package.json and tsconfig.json

**usage examples:**

```bash
# Basic usage
dler pack --dir ./templates --output ./dist-templates

# With custom whitelabel
dler pack --dir ./templates --output ./dist-templates --whitelabel MYAPP

# Update specific files only
dler pack --dir ./templates --output ./dist-templates --files "src/index.ts,src/config.ts"

# Force overwrite existing files
dler pack --dir ./templates --output ./dist-templates --force

# Update mode (default: true)
dler pack --dir ./templates --output ./dist-templates --update
```

**arguments:**

- `--dir`: Directory containing templates to process (required)
- `--output`: Output directory for generated modules (default: "my-templates")
- `--whitelabel`: Custom prefix to use instead of 'DLER' (default: "DLER")
- `--cdn`: Remote CDN for binary assets upload (not yet implemented)
- `--force`: Force overwrite existing files (default: false)
- `--update`: Update existing templates and add new ones (default: true)
- `--files`: Comma-separated list of specific files to update
- `--lastUpdate`: Override lastUpdate timestamp

**output structure:**

```bash
output/
├── impl/
│   ├── binaries/ # binary files stored with hash-based names (dler reads/writes this dir when --cdn is not used)
│   │   └── [hashed-files]
│   ├── template1.ts
│   └── template2.ts
├── types.ts
└── mod.ts
```

**--unpack**:

creates file structure from packed templates. This command is the counterpart to `pack` and is used to extract and restore template files from a packed template package.

**key features:**

- Restores complete directory structure from packed templates
- Handles binary files with automatic lookup
- Preserves JSON comments and formatting
- Supports custom output locations
- Maintains file permissions and structure
- Validates template integrity
- Supports cleanup of existing template files
- Provides dry-run mode for previewing changes
- Handles empty directory cleanup

**usage examples:**

```bash
# Basic usage
dler pack ./dist-templates --output ./my-project --unpack

# With custom output directory
dler pack ./dist-templates --output ./custom-location --unpack

# Preview changes without applying
dler pack ./dist-templates --output ./my-project --dry-run --unpack

# Clean up existing template files before unpacking
dler pack ./dist-templates --output ./my-project --cleanup --unpack
```

**arguments:**

- `templatesDir`: Directory containing mod.ts (required)
- `--output`: Where to write files (default: "unpacked")
- `--cdn`: Remote CDN base for binary assets download (not yet implemented)
- `--cleanup`: Clean up template files before unpacking (default: false)
- `--dry-run`: Preview changes without applying them (default: false)

**implementation details:**

- Uses `jiti` for dynamic template file loading
- Implements template validation and type checking
- Provides detailed error handling and reporting
- Handles file system operations safely
- Preserves JSON comments and formatting
- Supports binary file restoration
- Cleans up empty directories after unpacking
- Validates template structure before unpacking

## api (for advanced usage)

the sdk lets you build custom dler cli plugins or even extend your own cli tools.

```sh
bun add @reliverse/dler-sdk
```

**usage example**: [@reliverse/rse](https://github.com/reliverse/rse-website-builder) leverages this sdk to extend its functionality.

### 17. `update`

updates your project's dependencies to the latest version.

updates not only `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`, but also [monorepo catalogs](https://bun.sh/docs/install/catalogs).

```bash
bun dler update
```

**params:**

- `--with-check-script` (boolean) — runs `bun check` after updating (exclusive for bun environment at the moment)

**example package.json:**

```json
{
  "scripts": {
    "latest": "bun dler update --with-check-script",
    "check": "tsc --noEmit && eslint --cache --fix . && biome check --fix --unsafe . && knip"
  }
}
```

**coming soon:**

- recursive lookup for deps in multiple package.json files (e.g. monorepo; or case when you have `C:/foo/bar1/package.json` and `C:/foo/bar2/package.json` and using `dler update` in `C:/foo`).

## workspaces and catalogs

dler has full workspaces and catalogs support for the package management commands. Catalog logic is similar to Bun across all package management commands.

### **Catalog Features:**

#### **1. Install Dependencies as Catalogs**

```bash
# Add to default catalog
dler install react react-dom --as-catalog default

# Add to named catalog
dler install jest testing-library --as-catalog testing
dler install webpack babel --as-catalog build --catalog-name build

# With workspace filtering
dler install lodash --as-catalog default --filter "pkg-*"
```

#### **2. Remove Dependencies from Catalogs**

```bash
# Remove from default catalog
dler remove react react-dom --from-catalog default

# Remove from named catalog
dler remove jest --from-catalog testing
dler remove webpack --from-catalog build --catalog-name build
```

#### **3. List Catalogs**

```bash
# List all catalogs and their dependencies
dler catalog list
dler catalog ls
```

#### **4. Update Catalogs**

```bash
# Update all catalog dependencies to latest versions
dler update --update-catalogs
```

### **Technical Implementation:**

#### **Smart Version Management**

- Dler automatically fetches latest versions from npm registry
- Uses `^` and `~` prefixes for semver compatibility
- Handles scoped packages correctly

### **Catalog Structure Support:**

#### **Default Catalog**

```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  }
}
```

#### **Named Catalogs**

```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "catalogs": {
      "testing": {
        "jest": "^30.0.0",
        "testing-library": "^14.0.0"
      },
      "build": {
        "webpack": "^5.88.2",
        "babel": "^7.22.10"
      }
    }
  }
}
```

### **Usage Examples:**

#### **Setting up a React Monorepo with Catalogs:**

```bash
# 1. Add core React dependencies to default catalog
dler install react react-dom react-router-dom --as-catalog default

# 2. Add build tools to named catalog
dler install webpack babel --as-catalog build

# 3. Add testing tools to named catalog
dler install jest react-testing-library --as-catalog testing

# 4. List all catalogs
dler catalog list

# 5. Update all catalogs to latest versions
dler update --update-catalogs
```

#### **Workspace Package Usage:**

```json
// packages/app/package.json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-router-dom": "catalog:"
  },
  "devDependencies": {
    "webpack": "catalog:build",
    "jest": "catalog:testing"
  }
}
```

#### **Advanced Operations:**

```bash
# Add dependencies to specific workspaces as catalogs
dler install lodash --as-catalog default --filter "pkg-*" --filter "!pkg-c"

# Remove dependencies from catalogs in filtered workspaces
dler remove typescript --from-catalog default --filter "pkg-*"

# Update catalogs and then install
dler update --update-catalogs
dler install
```

### **Benefits:**

1. **Consistency**: Ensures all packages use the same version of critical dependencies
2. **Maintenance**: Update a dependency version in one place instead of across multiple package.json files
3. **Clarity**: Makes it obvious which dependencies are standardized across your monorepo
4. **Simplicity**: No need for complex version resolution strategies or external tools
5. **Workspace Integration**: Seamlessly works with workspace filtering
6. **Cross-Package Manager**: Works with Bun (full support) and provides helpful messages for others

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

### todo: commands

- [ ]  run       ./my-script.ts       Execute a file with Bun
- [ ]            lint                 Run a package.json script
- [ ]  test                           Run unit tests with Bun
- [ ]  x         nuxi                 Execute a package binary (CLI), installing if needed (dler x)
- [ ]  repl                           Start a REPL session with Bun
- [ ]  exec                           Run a shell script directly with Bun
- [ ]  install                        Install dependencies for a package.json (dler i)
- [ ]  add       elysia               Add a dependency to package.json (dler a)
- [ ]  remove    backbone             Remove a dependency from package.json (dler rm)
- [ ]  update    @shumai/shumai       Update outdated dependencies
- [ ]  audit                          Check installed packages for vulnerabilities
- [ ]  outdated                       Display latest versions of outdated dependencies
- [ ]  link      [<package>]          Register or link a local npm package
- [ ]  unlink                         Unregister a local npm package
- [ ]  publish                        Publish a package(s) to the npm/jsr registry
- [ ]  patch <pkg>                    Prepare a package for patching
- [ ]  pm <subcommand>                Additional package management utilities
- [ ]  info      hono                 Display package metadata from the registry
- [ ]  build     ./a.ts ./b.jsx       Bundle TypeScript & JavaScript into a single file
- [ ]  init                           Start an empty project from a built-in template
- [ ]  create    next-app             Create a new project from a template (bun c)
- [ ]  upgrade                        Upgrade to latest version both of dler and your package manager.
- [x]  <command> --help               Print help text for command.

### todo: flag

- [ ]      --watch                         Automatically restart the process on file change
- [ ]      --hot                           Enable auto reload in the Bun runtime, test runner, or bundler
- [ ]      --no-clear-screen               Disable clearing the terminal screen on reload when --hot or --watch is enabled
- [ ]      --smol                          Use less memory, but run garbage collection more often
- [ ]  -r, --preload=<val>                 Import a module before other modules are loaded
- [ ]      --require=<val>                 Alias of --preload, for Node.js compatibility
- [ ]      --import=<val>                  Alias of --preload, for Node.js compatibility
- [ ]      --inspect=<val>                 Activate Bun's debugger
- [ ]      --inspect-wait=<val>            Activate Bun's debugger, wait for a connection before executing
- [ ]      --inspect-brk=<val>             Activate Bun's debugger, set breakpoint on first line of code and wait
- [ ]      --if-present                    Exit without an error if the entrypoint does not exist
- [ ]      --no-install                    Disable auto install in the Bun runtime
- [ ]      --install=<val>                 Configure auto-install behavior. One of "auto" (default, auto-installs when no node_modules), "fallback" (missing packages only), "force" (always).
- [ ]  -i                                  Auto-install dependencies during execution. Equivalent to --install=fallback.
- [ ]  -e, --eval=<val>                    Evaluate argument as a script
- [ ]  -p, --print=<val>                   Evaluate argument as a script and print the result
- [ ]      --prefer-offline                Skip staleness checks for packages in the Bun runtime and resolve from disk
- [ ]      --prefer-latest                 Use the latest matching versions of packages in the Bun runtime, always checking npm
- [ ]      --port=<val>                    Set the default port for Bun.serve
- [ ]      --conditions=<val>              Pass custom conditions to resolve
- [ ]      --fetch-preconnect=<val>        Preconnect to a URL while code is loading
- [ ]      --max-http-header-size=<val>    Set the maximum size of HTTP headers in bytes. Default is 16KiB
- [ ]      --dns-result-order=<val>        Set the default order of DNS lookup results. Valid orders: verbatim (default), ipv4first, ipv6first
- [ ]      --expose-gc                     Expose gc() on the global object. Has no effect on Bun.gc().
- [ ]      --no-deprecation                Suppress all reporting of the custom deprecation.
- [ ]      --throw-deprecation             Determine whether or not deprecation warnings result in errors.
- [ ]      --title=<val>                   Set the process title
- [ ]      --zero-fill-buffers             Boolean to force Buffer.allocUnsafe(size) to be zero-filled.
- [ ]      --redis-preconnect              Preconnect to $REDIS_URL at startup
- [ ]      --sql-preconnect                Preconnect to PostgreSQL at startup
- [ ]      --no-addons                     Throw an error if process.dlopen is called, and disable export condition "node-addons"
- [ ]      --unhandled-rejections=<val>    One of "strict", "throw", "warn", "none", or "warn-with-error-code"
- [ ]      --console-depth=<val>           Set the default depth for console.log object inspection (default: 2)
- [ ]      --silent                        Don't print the script command
- [ ]      --elide-lines=<val>             Number of lines of script output shown when using --filter (default: 10). Set to 0 to show all lines.
- [ ]  -v, --version                       Print version and exit
- [ ]      --revision                      Print version with revision and exit
- [ ]  -F, --filter=<val>                  Run a script in all workspace packages matching the pattern
- [ ]  -b, --bun                           Force a script or package to use Bun's runtime instead of Node.js (via symlinking node)
- [ ]      --shell=<val>                   Control the shell used for package.json scripts. Supports either 'bun' or 'system'
- [ ]      --env-file=<val>                Load environment variables from the specified file(s)
- [ ]      --cwd=<val>                     Absolute path to resolve files & entry points from. This just changes the process' cwd.
- [ ]  -c, --config=<val>                  Specify path to Bun config file. Default $cwd/bunfig.toml
- [ ]  -h, --help                          Display this menu and exit

## related

special thanks to the project that inspired `@reliverse/dler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## support

- if dler saves you time and effort, please consider supporting its development: [github sponsors](https://github.com/sponsors/blefnk);
- even a simple star on [github](https://github.com/reliverse/dler) shows your love. thank you!

## license

🩷 [mit](./license) © 2025 [blefnk nazar kornienko](https://github.com/blefnk)
