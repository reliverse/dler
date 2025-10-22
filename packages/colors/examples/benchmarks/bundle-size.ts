// Bundle size analysis for relico
import { readFileSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { config, getEnabledDirs, getFilePaths, getImportPath } from "./config";

// Get the directory where this benchmark file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants for size formatting
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const NEWLINE_LENGTH = 1;
const PERCENT_MULTIPLIER = 100;
const DECIMAL_PLACES = 1;
const SEPARATOR_LENGTH = 60;

function getFileSize(path: string): number {
  try {
    const stats = statSync(path);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) {
    return `${bytes}B`;
  }
  if (bytes < BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_KB).toFixed(DECIMAL_PLACES)}KB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(DECIMAL_PLACES)}MB`;
}

function analyzeFile(filePath: string): {
  types: number;
  constants: number;
  logic: number;
} {
  try {
    const sourceCode = readFileSync(filePath, "utf8");
    const lines = sourceCode.split("\n");

    let typeDefinitions = 0;
    let constants = 0;
    let logic = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Type definitions
      if (trimmed.includes("type ") || trimmed.includes("interface ")) {
        typeDefinitions += line.length + NEWLINE_LENGTH;
        continue;
      }

      // Constants and color data
      if (
        trimmed.includes("const ") ||
        trimmed.includes("COLOR_LEVEL") ||
        trimmed.includes("SGR_")
      ) {
        constants += line.length + NEWLINE_LENGTH;
        continue;
      }

      // Everything else is logic
      if (trimmed.length > 0) {
        logic += line.length + NEWLINE_LENGTH;
      }
    }

    return { types: typeDefinitions, constants, logic };
  } catch (error) {
    console.warn(`⚠️  Could not analyze ${filePath}:`, error);
    return { types: 0, constants: 0, logic: 0 };
  }
}

function analyzeSingleDirectory(dir: "src" | "distNpmBin"): void {
  const importPath = getImportPath(dir);
  const filePaths = getFilePaths(dir);

  console.log(`\n🔍 Analyzing ${dir.toUpperCase()} directory: ${importPath}`);
  console.log("=".repeat(SEPARATOR_LENGTH));

  // Analyze JavaScript/TypeScript file
  if (filePaths.js) {
    const jsFilePath = resolve(__dirname, filePaths.js);
    console.log(`📄 JavaScript/TypeScript file: ${filePaths.js}`);
    console.log(`Resolved path: ${jsFilePath}`);

    const jsFileSize = getFileSize(jsFilePath);
    if (jsFileSize === 0) {
      console.log(`❌ File not found or empty: ${jsFilePath}`);
    } else {
      console.log(`File size: ${formatSize(jsFileSize)}`);

      const jsAnalysis = analyzeFile(jsFilePath);

      console.log("\nBreakdown:");
      console.log(
        `- Types: ${formatSize(jsAnalysis.types)} (${((jsAnalysis.types / jsFileSize) * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES)}%)`,
      );
      console.log(
        `- Constants: ${formatSize(jsAnalysis.constants)} (${((jsAnalysis.constants / jsFileSize) * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES)}%)`,
      );
      console.log(
        `- Logic: ${formatSize(jsAnalysis.logic)} (${((jsAnalysis.logic / jsFileSize) * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES)}%)`,
      );

      if (config.bundleAnalysis.analyzeDependencies) {
        console.log("\n📊 Additional Info:");
        try {
          const sourceCode = readFileSync(jsFilePath, "utf8");
          const lines = sourceCode.split("\n");
          console.log(`- Total lines: ${lines.length}`);
          console.log("- File type: TypeScript");
        } catch (error) {
          console.log(`- Could not read file for line count: ${error}`);
        }
      }
    }
  }
}

function analyzeAllDirectories(): void {
  const enabledDirs = getEnabledDirs();

  for (const dir of enabledDirs) {
    analyzeSingleDirectory(dir);
  }
}

// Main execution
console.log("📦 Relico Bundle Size Analysis");
console.log("=".repeat(50));

console.log("Starting analysis...");
analyzeAllDirectories();
console.log("\n✅ All analyses completed!");
