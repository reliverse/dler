# @reliverse/reinit | Reinit CLI & Core

[💖 GitHub Sponsors](https://github.com/sponsors/blefnk) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [📦 NPM](https://npmjs.com/@reliverse/reinit-cli) • [📚 Docs](https://blefnk.reliverse.org/blog/my-products/reinit)

**@reliverse/reinit** is your buddy for bootstrapping the boring stuff — so you can jump straight into building the good stuff.

- Need a `README.md`? `.gitignore`? `eslint.config.js`? Boom — done.
- Configs, docs, boilerplate — Reinit helps you set them up in seconds, not hours.

## 🛠️ What it can do

- 📝 Instantly generate common project files (README, LICENSE, configs, etc).
- ⚙️ Supports a wide range of file types: `eslint`, `knip`, `tsconfig`, `gitignore`, and more.
- 🚀 Use presets or customize everything with interactive prompts.
- 🛠️ Choose between single-file or multi-file generation.
- 📦 Comes in two flavors: CLI (`@reliverse/reinit-cli`) and Core (`@reliverse/reinit`) — use whichever fits your flow.
- 🧠 Handles conflicts smartly: overwrite, skip, prompt, or attach an index.

## ⚡ Getting Started

Ensure Git, Node.js, and bun•pnpm•yarn•npm are installed. Then:

### Installation

```bash
bun i -g @reliverse/reinit-cli
```

Or use with `bun x` (or `npx`):

```bash
bun x @reliverse/reinit-cli
```

### Basic Usage

Run without arguments to launch interactive mode:

```bash
reinit-cli
```

### Generate a specific file

```bash
reinit-cli --fileType md:README
```

### Generate multiple files

```bash
reinit-cli --multiple
```

Add `--parallel` to go even faster:

```bash
reinit-cli --multiple --parallel --concurrency 3
```

### Custom destination

```bash
reinit-cli --fileType git:gitignore --destDir ./my-folder
```

## 🧩 Supported File Types

Some examples of supported `fileType` values:

- `md:README`
- `md:LICENSE`
- `cfg:eslint`
- `cfg:tsconfig.json`
- `cfg:package.json`
- `cfg:reliverse`
- `cfg:knip`
- `git:gitignore`
- `git:gitattributes`

Each file type has smart defaults and helpful variations. Choose one, or let the CLI guide you.

## 🧠 Advanced Features

- 🔄 **Fallback copy mode** — If generating fails, Reinit can copy templates from your local base.
- 🧩 **Attach index** — Already have a file? Reinit can create `file.1.json`, `file.2.json`, etc. Instead of overwriting, it builds alongside.
- 🧠 **Configurable behavior** — Add `reinit.config.ts` to control parallelism, conflict handling, and lifecycle hooks.

## 🧪 CLI Flags

| Flag            | Description                                |
|-----------------|--------------------------------------------|
| `--fileType`    | File type to generate (e.g. `md:README`)   |
| `--destDir`     | Destination directory (default: `.`)       |
| `--multiple`    | Select multiple files via interactive UI   |
| `--parallel`    | Run tasks in parallel                      |
| `--concurrency` | Set concurrency for parallel execution     |
| `--dev`         | Run in dev mode                            |

## ✅ TODO

- [x] Implement basic logic
- [ ] Parse templates for `gitignore` ([link](https://github.com/github/gitignore#readme)), `gitattributes` ([link](https://github.com/gitattributes/gitattributes#readme)), etc

## 🔋 Powered by

- 🧠 [`@reliverse/reinit`](https://npmjs.com/@reliverse/reinit) — the core engine
- ⚡ [`@reliverse/prompts`](https://npmjs.com/@reliverse/prompts) — interactive prompts
- 🧰 [`c12`](https://github.com/unjs/c12) — zero-config file loading

## 🫶 Show some love

If `@reliverse/reinit` made your setup easier:

- ⭐ [Star the repo](https://github.com/reliverse/reinit)
- 💖 [Sponsor on GitHub](https://github.com/sponsors/blefnk)
- 🫶 Share it with a dev friend!

## 📄 License

MIT © 2025 [blefnk (Nazar Kornienko)](https://github.com/blefnk)
