# @reliverse/dler-matcher

> @reliverse/dler-matcher is a high-performance minimal glob matcher, with micromatch-level power, zepto-level size, and reliverse-grade dx.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/reliverse) — [npm](https://npmjs.com/package/@reliverse/dler-matcher) — [github](https://github.com/reliverse/rematch)

## Installation

```bash
bun add @reliverse/dler-matcher
# bun • pnpm • yarn • npm
```

## Features

You want **micromatch/picomatch features** in a **zeptomatch-sized**(🔜) package.

- 🧩 Drop-in replacement for `micromatch`, `zeptomatch`, `picomatch`
- 🧠 Full bash-style globbing support with advanced pattern matching
- 🪶 Tiny ([7.5 kB](https://bundlephobia.com/package/@reliverse/dler-matcher@latest)), tree-shakeable, dependency-free implementation
- ⚡ Fast runtime with optimized regex compilation and caching
- 🔧 Complete toolset: escape, parse, compile, and match
- 🔜 1700+ picomatch and zeptomatch tests passed
- 🪄 Rich feature set with intuitive API

## Heads Up

- **Most of the things** mentioned in this doc **aren’t implemented yet** — they’re part of the vision for ~`v1.3.0`.
- Got thoughts? Ideas? Send your feedback in [Discord](https://discord.gg/Pb8uKbwpsJ) or use [GitHub Issues](https://github.com/reliverse/relifso/issues).
- Your feedback means the world and helps shape where this project goes next. Thank you!

## Features in Detail

### Core Pattern Matching

- **Wildcards**
  - `*` - Matches any characters except path separators
  - `**` - Matches any characters including path separators (globstar)
  - `?` - Matches exactly one character except path separators

### Advanced Pattern Matching

- **Character Classes**
  - `[abc]` - Matches any single character from the set
  - `[a-z]` - Matches any single character in the range
  - `[!abc]` or `[^abc]` - Matches any single character not in the set
  
- **Brace Expansion**
  - `{a,b,c}` - Matches any of the comma-separated patterns
  - Nested braces supported: `{a,{b,c}}` expands correctly
  - Numeric ranges: `{1..5}` matches 1,2,3,4,5
  - Padded numeric ranges: `{01..05}` matches 01,02,03,04,05
  - Alphabetic ranges: `{a..e}` matches a,b,c,d,e
  - Case-sensitive alphabetic ranges: `{A..E}` vs `{a..e}`

- **Pattern Negation**
  - `!pattern` - Matches anything that doesn't match the pattern
  - Multiple negations: `!!pattern` (negates the negation)
  - Combining with other patterns: `['*.js', '!test.js']`

### Special Features

- **Dot File Handling**
  - By default, `*` won't match files starting with a dot
  - Explicit dot matching with `.*.js` or setting `dot: true` option
  
- **Path Handling**
  - Automatic path normalization (converts backslashes to forward slashes)
  - Proper handling of path separators in globstar patterns

### Performance Optimizations

- **Pattern Compilation**
  - Automatic caching of compiled patterns
  - Efficient regex generation with optimized character classes
  - Smart handling of static vs dynamic patterns

- **Memory Efficiency**
  - Minimal memory footprint
  - Efficient pattern parsing and compilation
  - Smart caching strategies

## API Reference

### Main Function

```typescript
// Returns true if input matches pattern(s)
rematch(pattern: string, input: string, options?: RematchOptions): boolean
rematch(patterns: string[], input: string, options?: RematchOptions): boolean

// Returns a compiled matcher function
rematch(pattern: string, options?: RematchOptions): Matcher
rematch(patterns: string[], options?: RematchOptions): Matcher
```

#### Options

```typescript
interface RematchOptions {
  dot?: boolean;      // Match dotfiles (default: false)
  nocase?: boolean;   // Case-insensitive matching (default: false)
  ignore?: string | string[]; // Patterns to ignore (applies to input)
}
```

#### Types

```typescript
type Matcher = (input: string) => boolean;

type ScanResult = {
  isGlob: boolean;
  negated: boolean;
  glob: string;
  parts?: string[];
};
```

### Utility Functions

All utility functions are available as named exports and as properties on the default export:

```typescript
compile(pattern: string, options?: RematchOptions): Matcher
makeRegex(pattern: string, options?: RematchOptions): RegExp
makeRe(pattern: string, options?: RematchOptions): RegExp // Alias for makeRegex
normalizePath(pathStr: string): string
escapeGlob(str: string): string
unescapeGlob(str: string): string
isStatic(pattern: string, options?: { dot?: boolean }): boolean
scan(pattern: string, options?: { parts?: boolean }): ScanResult
explode(pattern: string): { static: string[]; dynamic: string[] }
```

## Examples

```typescript
import rematch, { compile, normalizePath } from "@reliverse/dler-matcher";

// Basic matching
rematch("*.js", "file.js");                  // → true
rematch("**/*.js", "src/utils/file.js");     // → true
rematch("*.js", "file.ts");                  // → false

// Dot files
rematch("*.js", ".hidden.js");               // → false
rematch("*.js", ".hidden.js", { dot: true }); // → true

// Case-insensitive matching
rematch("*.JS", "file.js", { nocase: true }); // → true

// Character classes
rematch("[abc].js", "a.js");                 // → true
rematch("[!a-z].js", "9.js");                // → true

// Brace expansion
rematch("file.{js,ts}", "file.js");          // → true
rematch("file{1..3}.js", "file2.js");        // → true
rematch("file{01..03}.js", "file01.js");     // → true

// Multiple patterns and negation
rematch(["*.js", "!test.js"], "file.js");    // → true
rematch(["*.js", "!file.js"], "file.js");    // → false

// Ignore option
rematch("*.js", "file.js", { ignore: "file.js" }); // → false
rematch(["*.js", "!test.js"], "test.js", { ignore: "test.js" }); // → false

// Compiled matcher
const matcher = compile("**/*.{js,ts}");
matcher("src/file.js");                      // → true
matcher("deep/nested/file.ts");              // → true

// Path normalization (for Windows paths)
rematch("src/*.js", "src\\file.js");         // → true
normalizePath("src\\file.js");               // → "src/file.js"

// Utility: escape/unescape
rematch(escapeGlob("file[1].js"), "file[1].js"); // → true
unescapeGlob("file\\[1\\].js");                // → "file[1].js"

// Utility: isStatic, scan, explode
isStatic("file.js");                         // → true
isStatic("*.js");                            // → false
scan("!src/*.js");                           // → { isGlob: true, negated: true, glob: "src/*.js" }
explode("src/file[1-3].js");                 // → { static: ["src/file"], dynamic: ["[1-3].js"] }
```

## Playground

To test [example/e-mod.ts](./example/e-mod.ts), run:

```bash
git clone https://github.com/reliverse/rematch
cd rematch
bun i
bun dev # beginner-friendly example
bun tests # advanced test suite
```

## Contributing

- 🧙 Star it on [GitHub](https://github.com/reliverse/rematch)
- 💬 Join our [Discord](https://discord.gg/reliverse)
- 💖 [Sponsor @blefnk](https://github.com/sponsors/blefnk)

## Related Reliverse Projects

- [`@reliverse/reglob`](https://npmjs.com/package/@reliverse/reglob) — Tiny, fast globber
- [`@reliverse/relifso`](https://npmjs.com/package/@reliverse/relifso) — Filesystem made fun again
- [`@reliverse/repackr`](https://npmjs.com/package/@reliverse/repackr) — Alternative to tar/7zip

## License

💖 [MIT](./LICENSE) © [blefnk (Nazar Kornienko)](https://github.com/blefnk)
