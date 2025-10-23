# React App Example - Built with Dler

This is a comprehensive React application example that demonstrates the frontend build capabilities of Dler, a modern build tool for TypeScript/JavaScript projects.

## Features Demonstrated

- 🚀 **HTML Entry Points** - Uses `index.html` as the main entry point
- ⚛️ **React 19** - Latest React with TypeScript support
- 🎨 **CSS Processing** - Global styles and component-specific CSS
- 📦 **Asset Optimization** - Static assets served from `public/` directory
- 🔥 **Hot Module Replacement** - Dev server with live reload
- 📱 **PWA Ready** - Web app manifest and service worker ready
- 🎯 **Interactive Components** - Counter, Todo List, and Feature Showcase

## Project Structure

```
examples/react-app/
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── public/                 # Static assets
│   ├── favicon.svg         # SVG favicon
│   ├── manifest.json       # PWA manifest
│   └── robots.txt          # SEO robots file
└── src/                    # Source code
    ├── main.tsx            # React entry point
    ├── App.tsx             # Main app component
    ├── App.css             # App-specific styles
    ├── styles.css          # Global styles
    └── components/         # React components
        ├── Counter.tsx     # Interactive counter
        ├── TodoList.tsx    # Todo list with state
        └── FeatureShowcase.tsx # Feature demonstration
```

## Available Scripts

### Development
```bash
# Start dev server with HMR
bun run dev

# Alternative: Use dler directly
bun dler build --devServer --watch --open
```

### Production Build
```bash
# Build for production
bun run build

# Alternative: Use dler directly
bun dler build --production --html --cssChunking
```

### Development Build
```bash
# Build without minification
bun run build:dev

# Alternative: Use dler directly
bun dler build --html --cssChunking
```

## How Dler Builds This App

### 1. Auto-Detection
Dler automatically detects this as a frontend app because:
- ✅ Has `index.html` in the root
- ✅ Has React dependencies in `package.json`
- ✅ Has a `public/` directory
- ✅ Uses TypeScript with JSX

### 2. Build Configuration
Dler applies frontend-specific settings:
- **Target**: `browser` (auto-detected)
- **Format**: `esm` (auto-detected)
- **HTML Processing**: Enabled (auto-detected)
- **CSS Chunking**: Enabled (auto-detected)
- **Asset Loaders**: Images, fonts, JSON, etc.
- **Code Splitting**: Enabled for optimal bundles

### 3. Dev Server Features
When using `--devServer`:
- 🌐 Serves HTML from `index.html`
- 📁 Serves static assets from `public/`
- ⚡ Hot Module Replacement for instant updates
- 🔄 WebSocket connection for live reload
- 🎯 Auto-opens browser (with `--open`)

### 4. Production Optimizations
When using `--production`:
- 🗜️ Minification of JS, CSS, and HTML
- 🌳 Tree-shaking to remove unused code
- 📦 Code splitting for optimal loading
- 🖼️ Asset optimization and copying
- 📊 Source maps for debugging

## Key Dler Features Demonstrated

### HTML Entry Points
```html
<!-- index.html serves as the main entry point -->
<script type="module" src="./src/main.tsx"></script>
```

### CSS Processing
- Global styles in `src/styles.css`
- Component styles in `src/App.css`
- Automatic CSS chunking for optimal loading

### Asset Handling
- Static files in `public/` are automatically copied
- SVG favicon and PWA manifest
- Proper MIME types and caching headers

### TypeScript Support
- Full TypeScript compilation
- JSX transformation
- Type checking and error reporting

## Development Workflow

1. **Start Development**:
   ```bash
   cd examples/react-app
   bun run dev
   ```

2. **Make Changes**:
   - Edit React components in `src/`
   - Modify styles in CSS files
   - Add assets to `public/`
   - Changes are automatically reflected

3. **Build for Production**:
   ```bash
   bun run build
   ```

4. **Preview Production Build**:
   ```bash
   bun run preview
   ```

## Customization

### Adding New Components
1. Create component in `src/components/`
2. Import and use in `App.tsx`
3. Add any component-specific styles

### Adding Static Assets
1. Place files in `public/` directory
2. Reference them with absolute paths (e.g., `/favicon.svg`)
3. Dler will automatically copy and optimize them

### Modifying Build Configuration
Create a `reliverse.ts` file in the monorepo root:
```typescript
export default {
  build: {
    packages: {
      '@reliverse/react-app-example': {
        target: 'browser',
        html: true,
        cssChunking: true,
        minify: true
      }
    }
  }
}
```

## Browser Support

- ✅ Modern browsers with ES2020 support
- ✅ Chrome 80+, Firefox 72+, Safari 13+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ PWA installation support

## Learn More

- [Dler Documentation](../../README.md)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Bun Documentation](https://bun.sh/docs)
