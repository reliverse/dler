import { defineConfig } from '@reliverse/rempts-core'

export default defineConfig({
  name: '{{name}}',
  version: '{{version}}',
  description: '{{description}}',
  
  commands: {
    directory: './src/commands'
  },
  
  build: {
    entry: './src/mod.ts',
    outdir: './dist',
    targets: ['native'],
    minify: true,
    sourcemap: true,
    compress: false
  },
  
  dev: {
    watch: true,
    inspect: true
  },
  
  test: {
    pattern: ['**/*.test.ts', '**/*.spec.ts'],
    coverage: true,
    watch: false
  },

  plugins: [],
})
