import { $ } from "bun";

// Clean dist directory
await $`rm -rf dist`;
await $`mkdir -p dist`;

// Build with Bun instead of tsc for now
const entrypoints = ["./src/mod.ts"];

for (const entry of entrypoints) {
  await Bun.build({
    entrypoints: [entry],
    outdir: "./dist",
    target: "bun",
    format: "esm",
    external: ["bun"],
  });
}

console.log("✅ @reliverse/rempts-core built successfully");
