# Reliverse Relidler

[📦 NPM](https://npmjs.com/@reliverse/relidler) • [💬 Discord](https://discord.gg/Pb8uKbwpsJ) • [💖 Patreon](https://patreon.com/blefnk) • [📚 Docs](https://docs.reliverse.org)

@reliverse/relidler is a flexible unified bundler and NPM/JSR publish tool for TypeScript and JavaScript projects.

## Features

- Drop-in replacement for `unbuild` 😘
- `relidler` works via CLI or as a lib
- Automates publishing to NPM and JSR
- No more package.json headaches, yep
- Handles version bumps automatically
- Ensures reliable builds for JS/TS projects
- Optimized for speed and modern workflows
- Path conversion and symbol resolution
- Flexible configuration options

## Installation

Ensure [git](https://git-scm.com/downloads), [node.js](https://nodejs.org), and [bun](https://bun.sh)/[pnpm](https://pnpm.io)/[yarn](https://yarnpkg.com)/[npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed. Then:

### CLI Usage

1. Install globally:

    ```sh
    bun i -g @reliverse/relidler
    ```

2. Generate optional config (recommended):

    ```sh
    bun add -D @reliverse/relidler-cfg # (⚠️soon)
    relidler init
    ```

3. Run and enjoy:

    ```sh
    relidler cli
    ```

### API Usage (for advanced users) (⚠️soon)

Extend your own CLI functionality via:

```sh
bun add -D @reliverse/relidler-sdk
```

## Related

- [unjs/unbuild](https://github.com/unjs/unbuild)

## License

🩷 [MIT](./LICENSE.md) © [blefnk Nazar Kornienko](https://github.com/blefnk)
