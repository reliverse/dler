#!/usr/bin/env bun
import { $ } from 'bun'

// Clean dist directory
await $`rm -rf dist`
await $`mkdir -p dist`

// Build TypeScript files
await Bun.build({
  entrypoints: ['./src/mod.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  minify: false
})

console.log('✅ @{{name}}/utils built successfully')