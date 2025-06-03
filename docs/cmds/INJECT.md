# dler inject

[💖 GitHub Sponsors](https://github.com/sponsors/blefnk) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [📦 NPM](https://npmjs.com/@reliverse/inject) • [📚 Docs](https://blefnk.reliverse.org/blog/my-products/inject)

**@reliverse/inject** handles the boring parts for you. For example:

- ✅ Need to insert `// @ts-expect-error` above a TypeScript error? Inject’s got you.
- 🔜 Fixing repetitive warns, lint suppressions, or compiler nags? One-liner.
- 🔜 Even more features to come!

## 🛠️ What it can do

- 🧠 Inject comments like `@ts-expect-error` or `eslint-disable` above problematic lines
- 📄 Works with linter logs (tsc, eslint, biome, etc.)
- 🚀 Processes entire projects or specific paths
- ✂️ Supports selective injection via filters or patterns
- 🤖 Ideal for AI-assisted workflows and auto-"fixing" legacy code

## ⚡ Getting Started

Make sure you have Git, Node.js, and bun•pnpm•yarn•npm installed.

### Installation

```bash
bun i -g @reliverse/inject
```

Or use with `bun x` (or `npx`):

```bash
bun x @reliverse/inject
```

### Basic Usage

**Running**:

```bash
# 1) Automatic mode:
bun dler inject expect auto
# => runs `tsc`, finds errors, injects comment above them.

# 2) Lines-file mode:
bun dler inject expect linesA.txt linesB.txt
# => no TSC, just parses references from lines files

# 3) Mixed:
bun dler inject expect auto lines.txt
# => merges TSC errors with references in lines.txt
```

**And**:

```bash
# When you need a custom comment:
inject ts-expect-error auto --comment="// @ts-expect-error FIXME"
```

Run on a TypeScript file with tsc output:

```bash
inject ts-expect-error src
```

You can also run on a specific TypeScript file with manually generated tsc output:

```bash
tsc --noEmit > tsc.log
inject tsc.log
rm tsc.log
```

You can also run it directly on output from stdin:

```bash
tsc --noEmit | inject
```

Or use with other tools:

```bash
eslint . | inject
biome check . | inject
```

### Filter by error code or rule ID

```bash
inject tsc.log --code TS2322
inject eslint.log --rule no-unused-vars
```

## ✨ Examples

```ts
const x: string = 123;
```

➡️ becomes:

```ts
// @ts-expect-error: TS2322
const x: string = 123;
```

## 🧪 CLI Flags

| Flag             | Description                                      |
|------------------|--------------------------------------------------|
| `--code`         | Filter by TS error code or ESLint rule name      |
| `--paths`        | Restrict injection to matching file paths        |
| `--comment`      | Custom comment instead of default                |
| `--dry-run`      | Preview changes without writing to disk          |
| `--dev`          | Run in dev mode                                  |

## ✅ TODO

- [x] Inject `@ts-expect-error`, `eslint-disable`, etc.
- [x] Parse output from multiple linters
- [ ] Add custom comment templates
- [ ] Improve support for multi-line diagnostics

## 🔋 Powered by

- ⚡ [`@reliverse/rempts`](https://npmjs.com/@reliverse/rempts) — interactive prompts
- 🧠 Smart AST & text transformations

## 🫶 Show some love

If `@reliverse/inject` saved you time or sanity:

- ⭐ [Star the repo](https://github.com/reliverse/inject)
- 💖 [Sponsor on GitHub](https://github.com/sponsors/blefnk)
- 🫶 Share it with a dev friend!

## 📄 License

MIT © 2025 [blefnk (Nazar Kornienko)](https://github.com/blefnk)
