# dler (prev. relidler) • framework for ts/js libs/cli/apps

> @reliverse/dler (`/ˈdiː.lər/`, dealer) is a flexible, unified, and fully automated bundler for ts/js projects, as well as an npm/jsr publishing tool. dler is not only a bundler, it also tries to serve as the most powerful codemod toolkit for ts/js.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/pb8ukbwpsj) — [github](https://github.com/reliverse/dler) — [npm](https://npmjs.com/@reliverse/dler) — [docs](https://docs.reliverse.org/reliverse/dler)

## features

- 😘 replacement for `unjs/unbuild`
- ⚡ `dler` works via cli and sdk
- 📦 automated npm/jsr publishing
- ✅ ensures reliable ts/js builds
- 🔄 handles automatic version bumps
- 🔧 eliminates `package.json` headaches
- 🎯 optimized for speed and modern workflows
- ✨ packed with powerful features under the hood
- 🛠️ converts typescript aliases to relative paths
- 🔌 19 built-in helper [dler commands](#-commands) included
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

## 🔌 commands

dler ships with a flexible command system (prev. plugins) and **19 built-in commands** (from [reliverse addons](https://reliverse.org/addons) collection).

feel free to create your own commands. commands can be implemented as built-in directly in `src/app/<command>/impl/*` and then imported from `src/app/<command>/cmd.ts`; or implemented in your own library and then imported from `src/app/<command>/cmd.ts`.

if you run just `dler` — it will display a list of commands which you can launch interactively.

## **available commands**

[agg](#1-agg) [build](#2-build) [check](#3-check) [conv](#4-conv) [copy](#6-copy) [init](#7-init) [inject](#8-inject) [libs](#9-libs) [merge](#10-merge) [mock](#11-mock) [migrate](#12-migrate) [pub](#13-pub) [rempts](#14-rempts) [rename](#15-rename) [spell](#16-spell) [split](#17-split) [pack](#18-pack) [unpack](#19-unpack)

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
bun dler build ...
```

### 3. `check`

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

### 4. `conv`

not yet documented.

### 5. `deps`

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

**pro tip:**  
missing dependencies are shown only once, even if used in multiple files.  
deep imports like `dep/some/file` or `@org/dep/some/thing` are always resolved to their root package.

**warning types:**

- **Missing Dependencies**: Packages that are imported but not listed in `package.json`
- **Dev-only Dependencies**: Packages that are only in `devDependencies` but imported in production code
- **Duplicate Dependencies**: Packages listed in both `dependencies` and `devDependencies`

### 6. `copy`

```bash
# simple example:
bun dler copy --s "src/**/*.ts" --d "dist"

# advanced example:
bun dler copy --s ".temp/packages/*/lib/**/*" --d "src/libs/sdk/sdk-impl/rules/external"
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
- creates and updates templates for mock project structures
- handles file deduplication
- supports custom separators and comment styles
- provides interactive mode with prompts
- includes backup functionality
- validates file permissions and sizes
- enforces output path conflict detection
- supports template generation with TypeScript type definitions
- handles both single file and directory output modes
- implements interactive prompts via `@reliverse/rempts`
- provides reporting with logging via `@reliverse/relinka`

**usage examples:**

```bash
# simple example:
bun dler merge --s "src/**/*.ts" --d "dist/merged.ts"

# advanced example:
bun dler merge --s ".temp1/packages/*/lib/**/*" --d ".temp2/merged.ts" --sort "mtime" --header "// Header" --footer "// Footer" --dedupe

# generate mock template:
bun dler merge --s "src/templates" --d "templates/my-template.ts" --as-templates

# update mock template:
bun dler merge --s "src/templates" --d "templates/my-template.ts" --as-templates --templates-update REACT_DLER_TEMPLATE

# generate multiple templates based on directory structure:
bun dler merge --s "src/templates" --d "templates" --as-templates --template-multi --depth 2

# create separate files for each template with an aggregator:
bun dler merge --s "src/templates" --d "templates/index.ts" --as-templates --templates-per-file
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
- `--as-templates`: Generate a TypeScript file with template structure
- `--custom-template-name`: Custom template name when using --as-templates
- `--template-multi`: Create multiple templates based on directory structure (default: true)
- `--depth`: Depth level to start processing from (default: 0)
- `--templates-per-file`: Create separate files for each template with an aggregator (default: false)
- `--whitelabel`: Custom prefix to use instead of 'DLER' in template generation (default: "DLER")
- `--sourcemap`: Generate source map for the merged output
- `--templates-update`: Update specific template in existing mock template file
- `--dev`: Generate template for development

**implementation details:**

- uses `magic-string` for efficient string manipulation and source map generation
- leverages `@reliverse/reglob` for glob pattern matching
- implements concurrent file operations with `p-map`
- provides file type detection and appropriate comment styles
- includes safety checks for file sizes and permissions
- supports template generation with TypeScript type definitions
- handles both single file and directory output modes
- implements interactive prompts via `@reliverse/rempts`
- provides reporting with logging via `@reliverse/relinka`

### 11. `mock`

bootstraps file structure based on the specified mock template. The command is designed to create project structures from predefined or custom templates, with built-in safety checks and cleanup capabilities.

**key features:**

- creates project structures from predefined templates (basic, api, react)
- supports custom template files
- handles path conflicts with force option
- provides cleanup functionality
- includes dry run mode for previewing changes
- validates file types and content
- enforces rate limiting for file operations
- supports custom whitelabel prefixes
- preserves directory structure
- handles both text and binary files

**usage examples:**

```bash
# use default react template:
bun dler mock --template react

# use custom template file:
bun dler mock --template-file templates/my-template.ts

# preview changes without applying:
bun dler mock --template react --dry-run

# clean up existing mock structure:
bun dler mock --template react --cleanup
```

**integration with merge command:**
The mock command works seamlessly with the merge command to create and update templates:

1. **create template from existing files:**

   ```bash
   # create a template from your project structure
   bun dler merge --s "src/templates" --d "templates/my-template.ts" --as-templates
   ```

2. **use the template with mock:**

   ```bash
   # use the generated template
   bun dler mock --template-file templates/my-template.ts
   ```

3. **update existing template:**

   ```bash
   # update a specific template in the file
   bun dler merge --s "src/templates" --d "templates/my-template.ts" --templates-update REACT_DLER_TEMPLATE
   ```

**implementation details:**

- uses `jiti` for dynamic template file loading
- implements template validation and type checking
- provides detailed error handling and reporting
- supports multiple template constants in a single file
- handles file system operations safely with permissions checks
- includes cleanup of empty directories
- provides verbose logging option
- enforces output path conflict detection

**programmatic usage:**
Both merge and mock commands can be used programmatically through the `@reliverse/dler-sdk` package:

```typescript
import { merge, mock } from "@reliverse/dler-sdk";

// Merge files programmatically
await merge({
  source: ["src/**/*.ts"],
  destination: "dist/merged.ts",
  options: {
    sort: "mtime",
    header: "// Header",
    footer: "// Footer",
    dedupe: true,
    sourcemap: true
  }
});

// Create mock structure programmatically
await mock({
  template: "react",
  options: {
    templateFile: "templates/my-template.ts",
    cleanup: false,
    dryRun: false,
    verbose: true,
    whitelabel: "MYAPP",
    force: true
  }
});

// Create and use custom template
const template = await merge({
  source: ["src/templates"],
  destination: "templates/my-template.ts",
  options: {
    asTemplate: true,
    whitelabel: "MYAPP"
  }
});

await mock({
  template: "custom",
  options: {
    templateFile: "templates/my-template.ts"
  }
});
```

**sdk types:**

```typescript
// Merge command options
interface MergeOptions {
  source: string[];
  destination?: string;
  options?: {
    ignore?: string[];
    format?: string;
    stdout?: boolean;
    noPath?: boolean;
    pathAbove?: boolean;
    separator?: string;
    comment?: string;
    forceComment?: boolean;
    batch?: boolean;
    recursive?: boolean;
    preserveStructure?: boolean;
    increment?: boolean;
    concurrency?: number;
    sort?: "name" | "path" | "mtime" | "none";
    dryRun?: boolean;
    backup?: boolean;
    dedupe?: boolean;
    header?: string;
    footer?: string;
    selectFiles?: boolean;
    interactive?: boolean;
    asTemplate?: boolean;
    ctn?: string;
    whitelabel?: string;
    sourcemap?: boolean;
    updateTemplate?: string;
    dev?: boolean;
  };
}

// Mock command options
interface MockOptions {
  template: string;
  options?: {
    templateFile?: string;
    templateConsts?: string;
    cleanup?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    whitelabel?: string;
    force?: boolean;
  };
}
```

### 12. `migrate`

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

### 13. `pub`

pub command is separated for its own build-in plugin as well.

it already calls build command by itself, so you don't need to run `dler build` separately.

```bash
bun dler pub ...
```

### 14. `rempts`

@reliverse/rempts's best friend. learn more in its [docs](https://github.com/reliverse/rempts).

```bash
bun dler rempts
bun dler rempts --init cmd1 cmd2
```

### 15. `rename`

```bash
bun dler rename ...
```

### 16. `spell`

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

### 17. `split`

splits your code/text file into multiple files.

```bash
bun dler split ...
```

### 18. `pack`

packs a directory of templates into TypeScript modules. This command is useful for creating reusable template packages that can be distributed and used by other projects.

**key features:**

- Converts directory structure into TypeScript modules
- Handles binary files with automatic hashing
- Preserves JSON comments and formatting
- Supports custom whitelabeling
- Generates type-safe template definitions
- Creates an aggregator module for easy imports

**usage examples:**

```bash
# Basic usage
dler pack --dir ./templates --output ./dist-templates

# With custom whitelabel
dler pack --dir ./templates --output ./dist-templates --whitelabel MYAPP

# Preview changes without applying
dler pack --dir ./templates --output ./dist-templates --dry-run
```

**arguments:**

- `--dir`: Directory containing templates to process (required)
- `--output`: Output directory for generated modules (default: "my-templates")
- `--whitelabel`: Custom prefix to use instead of 'DLER' (default: "DLER")
- `--cdn`: Remote CDN for binary assets upload (not yet implemented)

**output structure:**

```bash
output/
├── impl/
│   ├── binaries/ # dler reads/writes this dir when --cdn is not used
│   │   └── [hashed-files]
│   ├── template1.ts
│   └── template2.ts
├── types.ts
└── mod.ts
```

### 19. `unpack`

creates file structure from packed templates. This command is the counterpart to `pack` and is used to extract and restore template files from a packed template package.

**key features:**

- Restores complete directory structure from packed templates
- Handles binary files with automatic lookup
- Preserves JSON comments and formatting
- Supports custom output locations
- Maintains file permissions and structure
- Validates template integrity

**usage examples:**

```bash
# Basic usage
dler unpack ./dist-templates --output ./my-project

# With custom output directory
dler unpack ./dist-templates --output ./custom-location

# Preview changes without applying
dler unpack ./dist-templates --output ./my-project --dry-run
```

**arguments:**

- `templatesDir`: Directory containing mod.ts (required)
- `--output`: Where to write files (default: "unpacked")
- `--cdn`: Remote CDN base for binary assets download (not yet implemented)

**implementation details:**

- Uses `jiti` for dynamic template file loading
- Implements template validation and type checking
- Provides detailed error handling and reporting
- Handles file system operations safely
- Preserves JSON comments and formatting
- Supports binary file restoration

## api (for advanced usage)

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
- [ ] use [@reliverse/remdn](https://github.com/reliverse/remdn) to generate npm/jsr readme

## related

special thanks to the project that inspired `@reliverse/dler`:

- [unjs/unbuild](https://github.com/unjs/unbuild#readme)

## contributors

### scripts

#### create, bootstrap, cleanup

- `create:*` - For generating template files using **merge** command
- `bootstrap:*` - For creating project structure using **mock** command
- `cleanup:*` - For cleaning up generated files using **mock** command

- `mock:create`: Updates the React template in the mock file with the latest changes from src/templates
- `mock:bootstrap`: Creates a new project structure using the React template from built-in templates
- `mock:cleanup`: Cleans up files generated by the built-in templates
- `libs:create`: Creates a single template from dist-libs directory
- `libs:bootstrap`: Creates a project structure using all templates from the resolveCrossLibs mock file
- `libs:cleanup`: Cleans up files generated by the resolveCrossLibs mock file

## support

- if dler saves you time and effort, please consider supporting its development: [github sponsors](https://github.com/sponsors/blefnk);
- even a simple star on [github](https://github.com/reliverse/dler) shows your love. thank you!

## license

🩷 [mit](./license) © 2025 [blefnk nazar kornienko](https://github.com/blefnk)
