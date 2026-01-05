# Reliverse Relico

> @reliverse/relico is a simple, lightweight terminal styling toolkit with basic ANSI color support — built for simplicity and reliability.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/Pb8uKbwpsJ) — [repo](https://github.com/reliverse/relico) — [npm](https://npmjs.com/@reliverse/relico)

## Why Relico?

**Relico** provides essential terminal styling with a focus on simplicity and zero configuration. It gives you basic ANSI colors and text styles for CLI output without the complexity.

- ⚡ **Lightweight & simple** — type-safe, zero dependencies, zero configuration
- 🎨 **Basic ANSI colors** — foreground, background, and bright color variants
- 🧠 **Typed API** — with autocompletion and inline docs
- 🌿 **Respects your environment** — honors `NO_COLOR` and TTY detection
- 🛡️ **Cross-platform** — works in Node.js, Bun, and other JavaScript runtimes

<img src="./example/example.png" width="50%" alt="Available Relico colors" />

## Installation

```bash
bun add @reliverse/relico
# bun • pnpm • yarn • npm
```

## Usage

```ts
import { relico } from "@reliverse/relico";

console.log(relico.red("Red text"));
console.log(relico.bold(relico.green("Bold green text")));
console.log(relico.bgBlue(relico.white("White text on blue background")));
```

## Available Colors & Styles

### Text Colors

- `rc.red("...")`, `rc.blue("...")`, `rc.green("...")`
- `rc.brightRed("...")`, `rc.brightBlue("...")`, `rc.brightGreen("...")`
- `rc.black("...")`, `rc.white("...")`, `rc.gray("...")`

### Background Colors

- `rc.bgRed("...")`, `rc.bgBlue("...")`, `rc.bgGreen("...")`
- `rc.bgYellow("...")`, `rc.bgMagenta("...")`, `rc.bgCyan("...")`
- `rc.bgWhite("...")`

### Text Styles

- `rc.bold("...")`, `rc.dim("...")`, `rc.italic("...")`
- `rc.underline("...")`, `rc.strikethrough("...")`

### Utilities

- `rc.reset("...")` - reset all styling
- `rc.strip(text)` - remove ANSI codes from text

Styles can be combined:

```ts
// Combine styles by nesting function calls:
console.log(relico.bold(relico.bgRed(relico.white("Warning!"))));
```

### Available Colors & Backgrounds

| **Text Colors** | **Bright Colors** | **Backgrounds** |
| --------------- | ----------------- | --------------- |
| `black`         | `brightRed`       | `bgRed`         |
| `red`           | `brightGreen`     | `bgGreen`       |
| `green`         | `brightYellow`    | `bgYellow`      |
| `yellow`        | `brightBlue`      | `bgBlue`        |
| `blue`          | `brightMagenta`   | `bgMagenta`     |
| `magenta`       | `brightCyan`      | `bgCyan`        |
| `cyan`          | `brightWhite`     | `bgWhite`       |
| `white`         |                   |                 |
| `gray`          |                   |                 |

## Environment Support

Relico respects standard environment variables:

- `NO_COLOR` - disables all colors when set
- Automatic TTY detection - colors are disabled when not in a terminal

## Development

This package is part of the Dler monorepo. To work with it locally:

```bash
# Clone the monorepo
git clone https://github.com/reliverse/dler
cd dler

# Install dependencies
bun install

# Build the package
cd packages/relico
bun run build
```

## Use Cases

- Beautiful CLI banners & success/error messages
- Colored logger outputs
- DX-enhanced terminal tools
- Custom internal design systems for CLIs

## Related

- [`chalk`](https://github.com/chalk/chalk) — the classic
- [`kleur`](https://github.com/lukeed/kleur) — performance-driven
- [`colorette`](https://github.com/jorgebucaran/colorette) — super tiny

Relico draws inspiration from all — and goes beyond them with modern configs, types, theming, and composability.

## 🛠 Contributing

We'd love your help! Bug? Feature? Example? PR it!  
Or hop into [Discord](https://discord.gg/Pb8uKbwpsJ) to discuss CLI theming and terminal art 💜

```bash
git clone https://github.com/reliverse/relico
cd relico
bun i
```

## License

MIT © [blefnk Nazar Kornienko](https://github.com/blefnk)  
Part of the [Reliverse](https://github.com/reliverse) ecosystem
