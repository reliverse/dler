// file extensions allowed on disk (actual files)
export const ALLOWED_FILE_EXTENSIONS = {
  src: ["", ".ts", ".css", ".json"] as string[], // ✅ .ts files allowed in src
  "dist-npm": ["", ".js", ".css", ".json"] as string[], // ❌ no .ts files in npm dist
  "dist-jsr": ["", ".ts", ".css", ".json"] as string[], // ✅ .ts files allowed in jsr dist
  "dist-libs/npm": ["", ".js", ".css", ".json"] as string[], // ❌ no .ts files in npm libs
  "dist-libs/jsr": ["", ".ts", ".css", ".json"] as string[], // ✅ .ts files allowed in jsr libs
} as const;

// strict file extensions (no empty extensions)
export const STRICT_FILE_EXTENSIONS = {
  src: [".ts", ".css", ".json"] as string[], // ✅ .ts files required in src
  "dist-npm": [".js", ".css", ".json"] as string[], // ❌ no .ts files in npm dist
  "dist-jsr": [".ts", ".css", ".json"] as string[], // ✅ .ts files required in jsr dist
  "dist-libs/npm": [".js", ".css", ".json"] as string[], // ❌ no .ts files in npm libs
  "dist-libs/jsr": [".ts", ".css", ".json"] as string[], // ✅ .ts files required in jsr libs
} as const;

// import path extensions (what's written in import statements)
export const ALLOWED_IMPORT_EXTENSIONS = {
  src: ["", ".js", ".css", ".json"] as string[], // ❌ no .ts imports (use .js)
  "dist-npm": ["", ".js", ".css", ".json"] as string[], // ❌ no .ts imports
  "dist-jsr": ["", ".ts", ".css", ".json"] as string[], // ✅ .ts imports allowed
  "dist-libs/npm": ["", ".js", ".css", ".json"] as string[], // ❌ no .ts imports
  "dist-libs/jsr": ["", ".ts", ".css", ".json"] as string[], // ✅ .ts imports allowed
} as const;

// strict import path extensions (no empty extensions)
export const STRICT_IMPORT_EXTENSIONS = {
  src: [".js", ".css", ".json"] as string[], // ❌ no .ts imports, no empty
  "dist-npm": [".js", ".css", ".json"] as string[], // ❌ no .ts imports
  "dist-jsr": [".ts", ".css", ".json"] as string[], // ✅ .ts imports required
  "dist-libs/npm": [".js", ".css", ".json"] as string[], // ❌ no .ts imports
  "dist-libs/jsr": [".ts", ".css", ".json"] as string[], // ✅ .ts imports required
} as const;

export type AllowedFileExtensionsType = keyof typeof ALLOWED_FILE_EXTENSIONS;
