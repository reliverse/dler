# @reliverse/dler-fs-utils

Drop-in, Bun-first helpers that mirror the most used `fs-extra` APIs while
staying 100% type-safe and optimized for Bun's `Bun.file`/`Bun.write`.

## Highlights

- High-performance `readFile`, `writeFile`, and JSON helpers backed by Bun.
- Directory utilities such as `ensureDir`, `ensureFile`, `emptyDir`, and `remove`.
- Link creators: `ensureLink` and `ensureSymlink`, with Windows-aware junction
  handling.
- Output writers: `outputFile` and `outputJson`, which automatically create
  parent directories before writing.

## Usage

```ts
import {
  ensureLink,
  ensureSymlink,
  outputFile,
  outputJson,
} from "@reliverse/dler-fs-utils";

await ensureLink("src/cli.ts", "dist/cli.ts");
await ensureSymlink("assets", "build/assets");
await outputFile("build/cli.js", Bun.file("dist/cli.js"));
await outputJson("build/meta.json", { version: "1.0.0" });
```

> ℹ️ When Bun does not yet expose a native equivalent, the helpers fall back to
> the fast `node:fs` implementation shipped with Bun.
