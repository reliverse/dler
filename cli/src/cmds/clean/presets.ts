// apps/dler/src/cmds/clean/presets.ts

import type { PresetCategory } from "./types";

export const PRESET_CATEGORIES: Record<string, PresetCategory> = {
  // Build artifacts (default, always included)
  build: {
    name: "build",
    description: "Build artifacts and compiled output",
    patterns: ["dist/", "dev-dist/", "target/"],
    order: 1,
  },

  // Database
  db: {
    name: "db",
    description: "Database generated files",
    patterns: ["_generated/"],
    order: 2,
  },

  // CMS
  cms: {
    name: "cms",
    description: "CMS generated files",
    patterns: [".basehub/"],
    order: 3,
  },

  // Frontend
  frontend: {
    name: "frontend",
    description: "Frontend framework build artifacts",
    patterns: [".next/", ".expo/", "routeTree.gen.ts"],
    order: 4,
  },

  // Documentation
  docs: {
    name: "docs",
    description: "Documentation generated files",
    patterns: [".source/"],
    order: 5,
  },

  // Email
  email: {
    name: "email",
    description: "Email template generated files",
    patterns: [".react-email/"],
    order: 6,
  },

  // Build tools
  "build-tools": {
    name: "build-tools",
    description: "Build tool caches and artifacts",
    patterns: [".turbo/", ".vercel/", ".wrangler/"],
    order: 7,
  },

  // Dependencies (deleted last)
  deps: {
    name: "deps",
    description: "Dependencies and lock files",
    patterns: ["node_modules/"],
    order: 10,
  },
};

export const LOCK_FILE_PATTERNS = [
  "bun.lock",
  "yarn.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
];

export const parsePresets = (presetsString?: string): string[] => {
  if (!presetsString) {
    return [];
  }

  if (presetsString === "all") {
    return Object.keys(PRESET_CATEGORIES);
  }

  return presetsString
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

export const parseCustomPatterns = (customString?: string): string[] => {
  if (!customString) {
    return [];
  }

  return customString
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

export const getPresetPatterns = (presets: string[]): string[] => {
  const patterns: string[] = [];

  for (const preset of presets) {
    const category = PRESET_CATEGORIES[preset];
    if (category) {
      patterns.push(...category.patterns);
    }
  }

  return patterns;
};

export const getPresetOrder = (presets: string[]): number[] =>
  presets
    .map((preset) => PRESET_CATEGORIES[preset]?.order ?? 999)
    .sort((a, b) => a - b);

export const getPresetDescription = (presets: string[]): string => {
  const categories = presets
    .map((preset) => PRESET_CATEGORIES[preset])
    .filter(Boolean);

  if (categories.length === 0) {
    return "No valid presets selected";
  }

  if (categories.length === 1) {
    return categories[0]!.description;
  }

  return categories.map((cat) => cat!.name).join(", ");
};

export const mergePatterns = (
  presets: string[],
  customPatterns: string[],
): string[] => {
  const presetPatterns = getPresetPatterns(presets);
  const allPatterns = [...presetPatterns, ...customPatterns];

  // Remove duplicates while preserving order
  return [...new Set(allPatterns)];
};

export const validatePatterns = (
  presets: string[],
  customPatterns: string[],
): void => {
  if (presets.length === 0 && customPatterns.length === 0) {
    throw new Error(
      "❌ At least one of --presets or --custom must be provided",
    );
  }
};
