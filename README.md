# @reliverse/relico

[**Docs**](.github/DOCS.md) | [**NPM**](https://npmjs.com/package/@reliverse/relico) | [**GitHub**](https://github.com/reliverse/relico)

<p align="left">
  <a href="https://npmjs.org/package/@reliverse/relico">
    <img src="https://img.shields.io/npm/v/@reliverse/relico.svg" alt="version" />
  </a>
  <a href="https://npmjs.org/package/@reliverse/relico">
    <img src="https://img.shields.io/npm/dm/@reliverse/relico.svg" alt="downloads" />
  </a>
</p>

**@reliverse/relico is a modern terminal color formatting library** that provides a type-safe and flexible way to add colors and styles to your command-line output. Built with TypeScript and TypeBox for enhanced reliability and developer experience.

## Installation

```sh
bun add @reliverse/relico # Replace "bun" with npm, pnpm, or yarn if desired
```

## Key Features

- **Smart Terminal Detection**: Automatically detects terminal type and color support level
- **Type Safety**: Built with TypeScript and TypeBox for reliable type checking
- **Multiple Color Levels**: Supports different color levels (none, basic, 256-color, truecolor)
- **Flexible API**: Multiple ways to apply colors (object syntax, functions, RGB)
- **Windows Support**: Special color handling for Windows Terminal
- **Environment Aware**: Respects NO_COLOR and FORCE_COLOR environment variables

## Usage Examples

```typescript
import { re, colorize, rgb } from "@reliverse/relico";

// Using the "re" object for basic colors
console.log(re.red("This is red text"));
console.log(re.blue("This is blue text"));

// Combining styles
console.log(re.bold(re.green("Bold green text")));

// Using the colorize function
console.log(colorize("magenta", "This is magenta text"));

// Using RGB colors (requires truecolor support)
const salmon = rgb(250, 128, 114);
console.log(salmon("This is salmon colored text"));
```

## Color Support

The library automatically detects the terminal's color support level:

- Level 0: No color support
- Level 1: Basic color support
- Level 2: 256 color support
- Level 3: Truecolor (16 million colors) support

You can check color support information:

```typescript
import { colorSupport } from "@reliverse/relico";

console.log("Terminal:", colorSupport.terminalName);
console.log("Colors Supported:", colorSupport.isColorSupported);
console.log("Colors Forced:", colorSupport.isForced);
console.log("Colors Disabled:", colorSupport.isDisabled);
```

## Available Styles

- **Basic Colors**: `red`, `green`, `blue`, `yellow`, `magenta`, `cyan`, `white`, `black`, `gray`
- **Bright Colors**: `redBright`, `greenBright`, `blueBright`, etc.
- **Background Colors**: `bgRed`, `bgGreen`, `bgBlue`, etc.
- **Text Styles**: `bold`, `dim`, `italic`, `underline`, `inverse`, `hidden`, `strikethrough`

## Configuration

You can customize the library's behavior:

```typescript
import { configure } from "@reliverse/relico";

configure({
  colorLevel: 3, // Force truecolor support
  customColors: {
    // Add custom color definitions
    success: ["\x1b[38;2;0;255;0m", "\x1b[0m"]
  }
});
```

## Example Project

Check out [examples/example.ts](./examples/example.ts) for a comprehensive demonstration of all features, including:

- Basic color usage
- Text styling
- Background colors
- RGB colors
- Color level switching
- Terminal detection

## Contributing

@reliverse/relico is open to contributions. To get started:

```sh
git clone https://github.com/reliverse/relico.git
cd relico
bun i
```

## Learn More

- [ANSI Color Codes](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)

## License

[MIT](./LICENSE.md) © [Nazarii Korniienko](https://github.com/blefnk)
