#!/usr/bin/env bun

import { join } from "node:path";
import { $ } from "bun";

const rootDir = join(import.meta.dir, "..");

// Clean dist directory
await $`rm -rf ${rootDir}/dist`;

// Run TypeScript compiler for type checking and declarations
console.log("🔨 Building types...");
try {
  await $`cd ${rootDir} && tsc`;
} catch (_error) {
  console.warn("⚠️  TypeScript compilation had errors, but continuing build...");
}

// Copy source files to dist for runtime (Bun runs TypeScript directly)
console.log("📦 Preparing distribution...");
await $`cp -r ${rootDir}/src/* ${rootDir}/dist/`;

console.log("✅ Build complete!");
