import fs from "@reliverse/relifso";
import path from "node:path";
import { glob } from "tinyglobby";

import type { PackageJson } from "./deps-types";

export const findSourceFiles = async (
  directory: string,
  ignorePatterns: string[],
): Promise<string[]> => {
  const pattern = `${directory}/**/*.{js,jsx,ts,tsx}`;

  // Default ignore patterns
  const defaultIgnores = [
    "**/node_modules/**",
    "**/.git/**",
    "**/build/**",
    "**/dist/**",
    "**/dist-npm/**",
    "**/dist-jsr/**",
    "**/dist-libs/**",
    "**/coverage/**",
  ];

  const allIgnores = [...defaultIgnores, ...ignorePatterns];

  return await glob(pattern, {
    ignore: allIgnores,
    absolute: true,
  });
};

export const readFile = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return "";
  }
};

export const readPackageJson = async (directory: string): Promise<PackageJson> => {
  const packageJsonPath = path.join(directory, "package.json");

  try {
    const content = await readFile(packageJsonPath);
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    console.error("Error reading package.json:", error);
    return {};
  }
};
