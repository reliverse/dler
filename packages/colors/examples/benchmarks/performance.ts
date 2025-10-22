// Performance benchmarks for relico optimizations

import { dirname, resolve } from "path";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { config, getEnabledDirs, getImportPath } from "./config";

// Parse command line arguments
const args = process.argv.slice(2);
const isBunOnly = args.includes("--isBun");

// Constants
const MILLISECONDS_PER_SECOND = 1000;
const COLOR_LEVEL_BASIC = 1;
const COLOR_LEVEL_TRUECOLOR = 3;
const MULTILINE_TEST_SIZE = 50;

// Get the directory where this benchmark file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports for different source directories
async function importFromDir(dir: string) {
  try {
    const resolvedPath = resolve(__dirname, dir);
    const module = await import(resolvedPath);
    return module;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Could not import from ${dir}:`, errorMessage);
    return null;
  }
}

interface ModuleExports {
  re: any;
  chain: any;
  setColorLevel: (level: number) => void;
  color?: any; // Bun color function
}

// Run benchmarks for a specific module
function runBenchmarks(module: ModuleExports) {
  const { re, chain, setColorLevel, color } = module;
  const { iterations, warmupRuns } = config.performance;

  function benchmark(name: string, fn: () => void, iterCount = iterations) {
    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      fn();
    }

    const start = performance.now();
    for (let i = 0; i < iterCount; i++) {
      fn();
    }
    const end = performance.now();
    const time = end - start;
    const opsPerSec = Math.round((iterCount * MILLISECONDS_PER_SECOND) / time);
    console.log(
      `  ${name}: ${time.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`,
    );
  }

  // Test basic color operations
  benchmark("Basic color access", () => {
    re.red("test");
  });

  benchmark("Chained colors", () => {
    re.bold.red.underline("test");
  });

  benchmark("Extended named colors", () => {
    re.orange("test");
  });

  benchmark("Bright color variants", () => {
    re.redBright("test");
  });

  benchmark("Chain function", () => {
    chain(re.bold, re.red, re.underline)("test");
  });

  benchmark("Background colors", () => {
    re.bgRed.white("test");
  });

  benchmark("Bright background colors", () => {
    re.bgRedBright.white("test");
  });

  benchmark("Complex style combinations", () => {
    re.bold.italic.underline.red("test");
  });

  benchmark("Style methods", () => {
    re.dim.strikethrough("test");
  });

  benchmark("Color level changes", () => {
    setColorLevel(COLOR_LEVEL_BASIC);
    re.red("test");
    setColorLevel(COLOR_LEVEL_TRUECOLOR); // Reset to truecolor
  });

  benchmark("Multiline text (small)", () => {
    re.red("line1\nline2\nline3");
  });

  benchmark("Multiline text (large)", () => {
    const largeText = new Array(MULTILINE_TEST_SIZE).fill("text").join("\n");
    re.red(largeText);
  });

  benchmark("Mixed background and foreground", () => {
    re.bgBlue.yellow.bold("test");
  });

  benchmark("All basic colors iteration", () => {
    const colors = [
      "red",
      "green",
      "blue",
      "yellow",
      "magenta",
      "cyan",
      "white",
      "black",
    ];
    for (const color of colors) {
      re[color]("test");
    }
  });

  benchmark("Extended colors iteration", () => {
    const extendedColors = [
      "orange",
      "pink",
      "purple",
      "teal",
      "lime",
      "brown",
      "navy",
      "maroon",
      "olive",
      "silver",
    ];
    for (const color of extendedColors) {
      re[color]("test");
    }
  });

  // Bun-specific benchmarks (only run if color function is available)
  if (color && typeof color === "function") {
    console.log("\n  🚀 Bun Color API Benchmarks:");

    benchmark("HSL color parsing", () => {
      color("hsl(120, 50%, 50%)")("test");
    });

    benchmark("LAB color parsing", () => {
      color("lab(50% 50 50)")("test");
    });

    benchmark("RGB string parsing", () => {
      color("rgb(255, 107, 107)")("test");
    });

    benchmark("RGBA string parsing", () => {
      color("rgba(255, 107, 107, 0.8)")("test");
    });

    benchmark("Hex string parsing", () => {
      color("#ff6b6b")("test");
    });

    benchmark("Numeric color parsing", () => {
      color(0xff6b6b)("test");
    });

    benchmark("RGB array parsing", () => {
      color([255, 107, 107])("test");
    });

    benchmark("RGBA array parsing", () => {
      color([255, 107, 107, 0.8])("test");
    });

    benchmark("RGB object parsing", () => {
      color({ r: 255, g: 107, b: 107 })("test");
    });

    benchmark("RGBA object parsing", () => {
      color({ r: 255, g: 107, b: 107, a: 0.8 })("test");
    });

    benchmark("Background color parsing", () => {
      color("hsl(200, 50%, 50%)", true)("test");
    });

    benchmark("Bun color chaining", () => {
      chain(re.bold, color("hsl(60, 100%, 50%)"))("test");
    });

    benchmark("Mixed Bun color formats", () => {
      const formats = [
        "hsl(120, 50%, 50%)",
        "#ff6b6b",
        "rgb(255, 107, 107)",
        [255, 107, 107],
        { r: 255, g: 107, b: 107 },
      ];
      for (const format of formats) {
        color(format)("test");
      }
    });
  }

  console.log("\n  📊 Bundle Size Test:");
  console.log(
    `  Core exports imported: ${Object.keys({ re, chain, setColorLevel, color }).length}`,
  );
}

// Test all enabled directories
async function runBenchmarksForAllDirs() {
  const enabledDirs = getEnabledDirs();

  for (const dir of enabledDirs) {
    const importPath = getImportPath(dir);
    console.log(`\n🔍 Testing ${dir.toUpperCase()} directory: ${importPath}`);
    console.log("=".repeat(60));

    const module = await importFromDir(importPath);
    if (!module) {
      continue;
    }

    // Run benchmarks for this directory
    runBenchmarks(module);
  }
}

// Check if we should only run Bun tests
if (isBunOnly) {
  const isBun = typeof process !== "undefined" && process.versions.bun;
  if (!isBun) {
    console.log("❌ --isBun flag specified but not running in Bun environment");
    console.log(
      "   Please run with: bun examples/benchmarks/performance.ts --isBun",
    );
    process.exit(1);
  }
  console.log("🚀 Relico Performance Benchmarks (Bun Only)");
  console.log("=".repeat(50));
  console.log("🔍 Bun Runtime Detected - Testing Bun Color API Integration");
} else {
  console.log("🚀 Relico Performance Benchmarks");
  console.log("=".repeat(50));
}

runBenchmarksForAllDirs()
  .then(() => {
    console.log("\n✅ All benchmarks completed!");
    if (isBunOnly) {
      console.log("🎉 Bun Color API integration benchmarks completed!");
    }
  })
  .catch((error) => {
    console.error("❌ Benchmark error:", error);
  });
