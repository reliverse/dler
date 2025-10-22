type ColorLevel = 0 | 1 | 2 | 3;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

type SgrOp =
  | { kind: "style"; open: number[] }
  | { kind: "fg-basic"; idx: number; bright: boolean }
  | { kind: "bg-basic"; idx: number; bright: boolean }
  | { kind: "fg-256"; code: number }
  | { kind: "bg-256"; code: number }
  | { kind: "fg-true"; rgb: Rgb }
  | { kind: "bg-true"; rgb: Rgb };

type ApplyInput = string | number;

type FormatCallable = ((input: ApplyInput) => string) & {
  readonly [OP_SYMBOL]: SgrOp[];
};

export type BaseColorName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "orange"
  | "pink"
  | "purple"
  | "teal"
  | "lime"
  | "brown"
  | "navy"
  | "maroon"
  | "olive"
  | "silver";

export type ColorName = BaseColorName | BrightColorName | BgColorName;

export type BrightColorName =
  | "blackBright"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright"
  | "orangeBright"
  | "pinkBright"
  | "purpleBright"
  | "tealBright"
  | "limeBright"
  | "brownBright"
  | "navyBright"
  | "maroonBright"
  | "oliveBright"
  | "silverBright";

export type BgColorName =
  | `bg${Capitalize<BaseColorName>}`
  | `bg${Capitalize<BrightColorName>}`;

export type ReStyleKey =
  | "reset"
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "inverse"
  | "hidden"
  | "strikethrough";

export type Re = FormatCallable & {
  readonly [K in ReStyleKey]: Re;
} & {
  readonly [K in ColorName]: Re;
} & {
  readonly [K in BgColorName]: Re;
};

// Constants
const RESET = "\x1B[0m";
const OP_SYMBOL: unique symbol = Symbol("re.ops");

const COLOR_LEVEL_OFF = 0;
const COLOR_LEVEL_BASIC = 1;
const COLOR_LEVEL_256 = 2;
const COLOR_LEVEL_TRUECOLOR = 3;

const MIN_BYTE = 0;
const MAX_BYTE = 255;
const WHITE_RGB = 255;

const ANSI_256_GRAYSCALE_MIN = 8;
const ANSI_256_GRAYSCALE_MAX = 248;
const ANSI_256_BASE_OFFSET = 16;
const ANSI_256_GRAYSCALE_BASE = 232;
const ANSI_256_GRAYSCALE_RANGE = 247;
const ANSI_256_GRAYSCALE_STEPS = 24;
const ANSI_256_BRIGHT_THRESHOLD = 231;
const ANSI_256_RGB_LEVELS = 5;
const ANSI_256_RGB_RED_MULTIPLIER = 36;
const ANSI_256_RGB_GREEN_MULTIPLIER = 6;

const SGR_FG_BASE = 30;
const SGR_BG_BASE = 40;
const SGR_FG_BRIGHT_BASE = 90;
const SGR_BG_BRIGHT_BASE = 100;

const SGR_RESET = 0;
const SGR_BOLD = 1;
const SGR_DIM = 2;
const SGR_ITALIC = 3;
const SGR_UNDERLINE = 4;
const SGR_INVERSE = 7;
const SGR_HIDDEN = 8;
const SGR_STRIKETHROUGH = 9;

const HEX_RADIX = 16;
const BRIGHT_SUFFIX_LENGTH = 6;
const BG_PREFIX_LENGTH = 2;
const BRIGHT_MIX_FACTOR = 0.25;
const BRIGHT_SUFFIX = "Bright";

// Runtime detection (cached)
const IS_BUN =
  typeof process !== "undefined" &&
  process.versions?.bun !== undefined &&
  typeof Bun !== "undefined" &&
  typeof Bun.color === "function";

let CURRENT_LEVEL: ColorLevel = COLOR_LEVEL_TRUECOLOR;

export const setColorLevel = (level: ColorLevel): void => {
  if (
    level !== COLOR_LEVEL_OFF &&
    level !== COLOR_LEVEL_BASIC &&
    level !== COLOR_LEVEL_256 &&
    level !== COLOR_LEVEL_TRUECOLOR
  ) {
    throw new Error("Invalid color level");
  }
  CURRENT_LEVEL = level;
};

// byte clamping
const clampByte = (n: number): number => {
  if (n <= MIN_BYTE || !Number.isFinite(n)) return MIN_BYTE;
  if (n >= MAX_BYTE) return MAX_BYTE;
  return Math.round(n);
};

// Base 8-color RGB anchors (frozen for optimization)
const BASIC8: readonly Rgb[] = Object.freeze([
  Object.freeze({ r: 0, g: 0, b: 0 }),
  Object.freeze({ r: 205, g: 0, b: 0 }),
  Object.freeze({ r: 0, g: 205, b: 0 }),
  Object.freeze({ r: 205, g: 205, b: 0 }),
  Object.freeze({ r: 0, g: 0, b: 238 }),
  Object.freeze({ r: 205, g: 0, b: 205 }),
  Object.freeze({ r: 0, g: 205, b: 205 }),
  Object.freeze({ r: 229, g: 229, b: 229 }),
]) as readonly Rgb[];

// SGR sequence cache for common codes
const sgrCache = new Map<string, string>();

const sgr = (codes: number[]): string => {
  // Fast path for single codes
  if (codes.length === 1) {
    const code = codes[0];
    const cached = sgrCache.get(String(code));
    if (cached) return cached;
    const seq = `\x1B[${code}m`;
    sgrCache.set(String(code), seq);
    return seq;
  }

  // Multi-code path
  const key = codes.join(";");
  const cached = sgrCache.get(key);
  if (cached) return cached;
  const seq = `\x1B[${key}m`;
  sgrCache.set(key, seq);
  return seq;
};

// nearest basic color with early exit
const nearestBasicIndex = (rgb: Rgb): number => {
  if (IS_BUN) {
    const ansiStr = Bun.color(rgb, "ansi-16");
    if (ansiStr) {
      const match = ansiStr.match(/38;5;(\d+)/);
      if (match?.[1]) {
        return Number.parseInt(match[1], 10) & 7; // Faster modulo for power of 2
      }
    }
  }

  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  // Early exit on exact match
  for (let i = 0; i < 8; i++) {
    const c = BASIC8[i]!;
    const dr = c.r - rgb.r;
    const dg = c.g - rgb.g;
    const db = c.b - rgb.b;

    if (dr === 0 && dg === 0 && db === 0) return i; // Exact match

    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

// RGB to ANSI 256
const rgbToAnsi256 = (rgb: Rgb): number => {
  if (IS_BUN) {
    const ansiStr = Bun.color(rgb, "ansi-256");
    if (ansiStr) {
      const match = ansiStr.match(/38;5;(\d+)/);
      if (match?.[1]) {
        return Number.parseInt(match[1], 10);
      }
    }
  }

  // grayscale check
  if (rgb.r === rgb.g && rgb.g === rgb.b) {
    if (rgb.r < ANSI_256_GRAYSCALE_MIN) return ANSI_256_BASE_OFFSET;
    if (rgb.r > ANSI_256_GRAYSCALE_MAX) return ANSI_256_BRIGHT_THRESHOLD;
    const step = Math.round(
      ((rgb.r - ANSI_256_GRAYSCALE_MIN) / ANSI_256_GRAYSCALE_RANGE) *
        ANSI_256_GRAYSCALE_STEPS,
    );
    return ANSI_256_GRAYSCALE_BASE + step;
  }

  // RGB calculation with reduced operations
  const r = ((rgb.r * ANSI_256_RGB_LEVELS + 127) / MAX_BYTE) | 0;
  const g = ((rgb.g * ANSI_256_RGB_LEVELS + 127) / MAX_BYTE) | 0;
  const b = ((rgb.b * ANSI_256_RGB_LEVELS + 127) / MAX_BYTE) | 0;
  return (
    ANSI_256_BASE_OFFSET +
    r * ANSI_256_RGB_RED_MULTIPLIER +
    g * ANSI_256_RGB_GREEN_MULTIPLIER +
    b
  );
};

// Named colors
const NAMED_COLORS: Record<BaseColorName, string> = {
  black: "#000000",
  red: "#ff0000",
  green: "#00ff00",
  yellow: "#ffff00",
  blue: "#0000ff",
  magenta: "#ff00ff",
  cyan: "#00ffff",
  white: "#ffffff",
  gray: "#808080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  purple: "#800080",
  teal: "#008080",
  lime: "#00ff00",
  brown: "#a52a2a",
  navy: "#000080",
  maroon: "#800000",
  olive: "#808000",
  silver: "#c0c0c0",
};

// RGB cache with common colors pre-populated
const rgbCache = new Map<BaseColorName, Rgb>();

// Pre-populate cache with common colors
for (const name of ["black", "white", "red", "green", "blue"] as const) {
  const hex = NAMED_COLORS[name];
  if (hex) {
    const clean = hex.slice(1);
    const r = Number.parseInt(clean.slice(0, 2), HEX_RADIX);
    const g = Number.parseInt(clean.slice(2, 4), HEX_RADIX);
    const b = Number.parseInt(clean.slice(4, 6), HEX_RADIX);
    rgbCache.set(name, Object.freeze({ r, g, b }));
  }
}

// white mixing
const mixWithWhite = (rgb: Rgb, factor: number): Rgb => {
  const invFactor = 1 - factor;
  return {
    r: clampByte(rgb.r * invFactor + WHITE_RGB * factor),
    g: clampByte(rgb.g * invFactor + WHITE_RGB * factor),
    b: clampByte(rgb.b * invFactor + WHITE_RGB * factor),
  };
};

// hex parsing with fewer string operations
const fromNamed = (name: BaseColorName): Rgb => {
  const cached = rgbCache.get(name);
  if (cached) return cached;

  const hex = NAMED_COLORS[name];
  if (!hex) return { r: 0, g: 0, b: 0 };

  if (IS_BUN) {
    const rgb = Bun.color(hex, "{rgb}");
    if (rgb) {
      rgbCache.set(name, rgb);
      return rgb;
    }
  }

  const clean = hex[0] === "#" ? hex.slice(1) : hex;
  const len = clean.length;

  let r: number, g: number, b: number;

  if (len === 3) {
    // short hex: use bit operations
    const rv = Number.parseInt(clean[0]!, HEX_RADIX);
    const gv = Number.parseInt(clean[1]!, HEX_RADIX);
    const bv = Number.parseInt(clean[2]!, HEX_RADIX);
    r = (rv << 4) | rv;
    g = (gv << 4) | gv;
    b = (bv << 4) | bv;
  } else if (len === 6) {
    r = Number.parseInt(clean.slice(0, 2), HEX_RADIX);
    g = Number.parseInt(clean.slice(2, 4), HEX_RADIX);
    b = Number.parseInt(clean.slice(4, 6), HEX_RADIX);
  } else {
    return { r: 0, g: 0, b: 0 };
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { r: 0, g: 0, b: 0 };
  }

  const result = Object.freeze({ r, g, b });
  rgbCache.set(name, result);
  return result;
};

// base name extraction
const toBaseName = (compound: BrightColorName): BaseColorName => {
  if (!compound) return "black";
  const base = compound.slice(0, -BRIGHT_SUFFIX_LENGTH);
  if (!base) return "black";
  return (base[0]!.toLowerCase() + base.slice(1)) as BaseColorName;
};

const parseColorName = (name: ColorName): { rgb: Rgb; wantBright: boolean } => {
  if (!name) return { rgb: { r: 0, g: 0, b: 0 }, wantBright: false };

  if (name.endsWith(BRIGHT_SUFFIX)) {
    const base = toBaseName(name as BrightColorName);
    const rgb = fromNamed(base);
    const rgbAdj = mixWithWhite(rgb, BRIGHT_MIX_FACTOR);
    return { rgb: rgbAdj, wantBright: true };
  }
  return { rgb: fromNamed(name as BaseColorName), wantBright: false };
};

// ANSI sequence generation with reduced string operations
const openForOp = (op: SgrOp): string => {
  if (CURRENT_LEVEL === COLOR_LEVEL_OFF) return "";

  switch (op.kind) {
    case "style":
      return sgr(op.open);

    case "fg-basic": {
      const code = (op.bright ? SGR_FG_BRIGHT_BASE : SGR_FG_BASE) + op.idx;
      return sgr([code]);
    }

    case "bg-basic": {
      const code = (op.bright ? SGR_BG_BRIGHT_BASE : SGR_BG_BASE) + op.idx;
      return sgr([code]);
    }

    case "fg-256": {
      if (IS_BUN) {
        const ansi = Bun.color(op.code, "ansi-256");
        if (ansi) return ansi;
      }
      return `\x1B[38;5;${op.code}m`;
    }

    case "bg-256": {
      if (IS_BUN) {
        const fgAnsi = Bun.color(op.code, "ansi-256");
        if (fgAnsi) return fgAnsi.replace("38;5;", "48;5;");
      }
      return `\x1B[48;5;${op.code}m`;
    }

    case "fg-true": {
      if (IS_BUN) {
        const ansi = Bun.color(op.rgb, "ansi-16m");
        if (ansi) return ansi;
      }
      const { r, g, b } = op.rgb;
      return `\x1B[38;2;${r};${g};${b}m`;
    }

    case "bg-true": {
      if (IS_BUN) {
        const fgAnsi = Bun.color(op.rgb, "ansi-16m");
        if (fgAnsi) return fgAnsi.replace("38;2;", "48;2;");
      }
      const { r, g, b } = op.rgb;
      return `\x1B[48;2;${r};${g};${b}m`;
    }

    default:
      return "";
  }
};

// ops-to-open with pre-allocated array
const opsToOpen = (ops: SgrOp[]): string => {
  if (CURRENT_LEVEL === COLOR_LEVEL_OFF) return "";

  const len = ops.length;
  if (len === 0) return "";
  if (len === 1) return openForOp(ops[0]!);

  // Direct string building for better performance
  let result = "";
  for (let i = 0; i < len; i++) {
    result += openForOp(ops[i]!);
  }
  return result;
};

// multiline text processing
const applyOpsToText = (ops: SgrOp[], input: ApplyInput): string => {
  const text = String(input);
  const textLen = text.length;

  if (CURRENT_LEVEL === COLOR_LEVEL_OFF || ops.length === 0 || textLen === 0) {
    return text;
  }

  const open = opsToOpen(ops);
  if (!open) return text;

  // Fast path for single-line text (most common)
  const nlIdx = text.indexOf("\n");
  if (nlIdx === -1) {
    return `${open}${text}${RESET}`;
  }

  // multiline with direct string building
  let result = "";
  let start = 0;

  while (start < textLen) {
    const end = text.indexOf("\n", start);

    if (end === -1) {
      // Last line
      const line = text.slice(start);
      if (line) {
        if (line.endsWith("\r")) {
          result += `${open}${line.slice(0, -1)}\r${RESET}`;
        } else {
          result += `${open}${line}${RESET}`;
        }
      }
      break;
    }

    // Line with newline
    if (start > 0) result += "\n";

    const line = text.slice(start, end);
    if (line) {
      if (line.endsWith("\r")) {
        result += `${open}${line.slice(0, -1)}\r${RESET}`;
      } else {
        result += `${open}${line}${RESET}`;
      }
    } else {
      result += `${open}${RESET}`;
    }

    start = end + 1;
  }

  return result;
};

// operation builders
const mkFgOpsFromRgb = (rgb: Rgb, wantBright = false): SgrOp[] => {
  if (CURRENT_LEVEL === COLOR_LEVEL_BASIC) {
    return [
      { kind: "fg-basic", idx: nearestBasicIndex(rgb), bright: wantBright },
    ];
  }
  if (CURRENT_LEVEL === COLOR_LEVEL_256) {
    return [{ kind: "fg-256", code: rgbToAnsi256(rgb) }];
  }
  return [{ kind: "fg-true", rgb }];
};

const mkBgOpsFromRgb = (rgb: Rgb, wantBright = false): SgrOp[] => {
  if (CURRENT_LEVEL === COLOR_LEVEL_BASIC) {
    return [
      { kind: "bg-basic", idx: nearestBasicIndex(rgb), bright: wantBright },
    ];
  }
  if (CURRENT_LEVEL === COLOR_LEVEL_256) {
    return [{ kind: "bg-256", code: rgbToAnsi256(rgb) }];
  }
  return [{ kind: "bg-true", rgb }];
};

// Style table with frozen objects
const STYLE_TABLE: Record<ReStyleKey, SgrOp> = {
  reset: Object.freeze({ kind: "style", open: [SGR_RESET] }),
  bold: Object.freeze({ kind: "style", open: [SGR_BOLD] }),
  dim: Object.freeze({ kind: "style", open: [SGR_DIM] }),
  italic: Object.freeze({ kind: "style", open: [SGR_ITALIC] }),
  underline: Object.freeze({ kind: "style", open: [SGR_UNDERLINE] }),
  inverse: Object.freeze({ kind: "style", open: [SGR_INVERSE] }),
  hidden: Object.freeze({ kind: "style", open: [SGR_HIDDEN] }),
  strikethrough: Object.freeze({ kind: "style", open: [SGR_STRIKETHROUGH] }),
} as const;

// Pre-computed lookup sets (frozen)
const STYLE_KEYS = Object.freeze(
  new Set([
    "reset",
    "bold",
    "dim",
    "italic",
    "underline",
    "inverse",
    "hidden",
    "strikethrough",
  ]),
);

const COLOR_KEYS = Object.freeze(new Set(Object.keys(NAMED_COLORS)));
const BRIGHT_COLOR_KEYS = Object.freeze(
  new Set(Object.keys(NAMED_COLORS).map((name) => `${name}Bright`)),
);
const BG_COLOR_KEYS = Object.freeze(
  new Set(
    Object.keys(NAMED_COLORS).map(
      (name) => `bg${name[0]!.toUpperCase()}${name.slice(1)}`,
    ),
  ),
);
const BG_BRIGHT_COLOR_KEYS = Object.freeze(
  new Set(
    Object.keys(NAMED_COLORS).map(
      (name) => `bg${name[0]!.toUpperCase()}${name.slice(1)}Bright`,
    ),
  ),
);

// key checks with early returns
const isColorKey = (key: string): boolean =>
  COLOR_KEYS.has(key) || BRIGHT_COLOR_KEYS.has(key);

const isBgKey = (key: string): boolean => {
  const len = key.length;
  if (len <= BG_PREFIX_LENGTH || key[0] !== "b" || key[1] !== "g") {
    return false;
  }
  return BG_COLOR_KEYS.has(key) || BG_BRIGHT_COLOR_KEYS.has(key);
};

// Proxy cache for reusing common chains
const proxyCache = new WeakMap<SgrOp[], Re>();

// proxy with reduced overhead
const callableProxy = (ops: SgrOp[]): Re => {
  const cached = proxyCache.get(ops);
  if (cached) return cached;

  const base = ((input: ApplyInput) =>
    applyOpsToText(ops, input)) as FormatCallable;

  Object.defineProperty(base, OP_SYMBOL, {
    value: ops,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  const proxy = new Proxy(base as unknown as Re, {
    apply(_target, _thisArg, argArray) {
      return applyOpsToText(ops, argArray[0] as ApplyInput);
    },

    get(_target, prop) {
      if (prop === OP_SYMBOL) return ops;

      const key = String(prop);

      // Style key fast path
      if (STYLE_KEYS.has(key)) {
        const op = STYLE_TABLE[key as ReStyleKey];
        const newOps = [...ops, op];
        return callableProxy(newOps);
      }

      // Background color fast path
      if (isBgKey(key)) {
        const colorName = (key[2]!.toLowerCase() + key.slice(3)) as ColorName;
        const { rgb, wantBright } = parseColorName(colorName);
        const bgOps = mkBgOpsFromRgb(rgb, wantBright);
        const newOps = [...ops, ...bgOps];
        return callableProxy(newOps);
      }

      // Foreground color fast path
      if (isColorKey(key)) {
        const { rgb, wantBright } = parseColorName(key as ColorName);
        const fgOps = mkFgOpsFromRgb(rgb, wantBright);
        const newOps = [...ops, ...fgOps];
        return callableProxy(newOps);
      }

      // Unknown key → return self (no-op)
      return proxy;
    },
  });

  proxyCache.set(ops, proxy);
  return proxy;
};

// Public root
export const re: Re = callableProxy([]);

// chain with reduced allocations
export const chain = (...parts: FormatCallable[]): Re => {
  if (parts.length === 0) return re;
  if (parts.length === 1) return parts[0] as Re;

  const collected: SgrOp[] = [];
  for (let i = 0; i < parts.length; i++) {
    const ops = (parts[i] as FormatCallable)[OP_SYMBOL] as SgrOp[] | undefined;
    if (ops?.length) {
      collected.push(...ops);
    }
  }

  return callableProxy(collected);
};

// Bun color input type
type BunColorInput =
  | { r: number; g: number; b: number; a?: number }
  | [number, number, number]
  | [number, number, number, number]
  | string
  | number
  | { toString(): string };

// color function with early returns
export const color = (input: BunColorInput, isBg = false): Re => {
  if (!IS_BUN) {
    if (
      typeof input === "object" &&
      "r" in input &&
      "g" in input &&
      "b" in input
    ) {
      const ops = isBg
        ? mkBgOpsFromRgb(input, false)
        : mkFgOpsFromRgb(input, false);
      return callableProxy(ops);
    }
    return re;
  }

  const rgb = Bun.color(input, "{rgb}");
  if (!rgb) return re;

  const ops = isBg ? mkBgOpsFromRgb(rgb, false) : mkFgOpsFromRgb(rgb, false);
  return callableProxy(ops);
};
