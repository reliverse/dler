import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { detectPackageManager } from "../utils/pm/pm-detect";

export interface PackageManager {
  name: "pnpm" | "bun" | "npm" | "yarn";
  runCmd: string[];
}

export interface Package {
  dir: string;
  name: string;
  buildScript?: string;
  dependencyNames: string[];
  config: PackageConfig;
}

export interface PackageConfig {
  cache: boolean;
  outDir: string;
  include: string[];
  exclude: string[];
}

export interface Monorepo {
  root: string;
  packageManager: PackageManager;
  packageGlobs: string[];
}

const DEFAULT_CACHED = true;
const DEFAULT_OUT_DIR = "dist";
const DEFAULT_INCLUDE = ["src/**/*"];
const DEFAULT_EXCLUDE = [
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/*.test.*",
  "**/e2e/**",
  "**/dist/**",
  "**/.output/**",
];

export function createPackageConfig(json: any): PackageConfig {
  const dler = json.dler || {};
  return {
    cache: dler.cache ?? DEFAULT_CACHED,
    outDir: dler.outDir ?? DEFAULT_OUT_DIR,
    include: dler.include ?? DEFAULT_INCLUDE,
    exclude: dler.exclude ?? DEFAULT_EXCLUDE,
  };
}

export async function findMonorepo(): Promise<Monorepo | null> {
  let currentDir = process.cwd();

  while (true) {
    const workspace = await readWorkspace(currentDir);
    if (workspace) {
      return {
        root: currentDir,
        packageManager: workspace.packageManager,
        packageGlobs: workspace.packageGlobs,
      };
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

async function readWorkspace(
  path: string,
): Promise<{ packageManager: PackageManager; packageGlobs: string[] } | null> {
  // Check for pnpm-workspace.yaml (highest priority)
  const pnpmWorkspacePath = path + "/pnpm-workspace.yaml";
  if (await fs.pathExists(pnpmWorkspacePath)) {
    try {
      const content = await fs.readFile(pnpmWorkspacePath, "utf-8");
      const yaml = JSON.parse(content); // Simple YAML parsing for this case
      const packages = yaml.packages || [];
      return {
        packageManager: {
          name: "pnpm",
          runCmd: ["pnpm", "--silent", "run"],
        },
        packageGlobs: packages,
      };
    } catch (error) {
      relinka("warn", `Failed to parse pnpm-workspace.yaml: ${error}`);
    }
  }

  // Check for package.json workspaces
  const packageJsonPath = path + "/package.json";
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const json = JSON.parse(content);

      if (json.workspaces) {
        // Use lockfile-based detection to determine the correct package manager
        const detectedPM = await detectPackageManager(path, {
          ignorePackageJSON: true, // We already have the package.json
        });

        let packageManager: PackageManager;
        if (detectedPM) {
          // Use detected package manager with appropriate run command
          switch (detectedPM.name) {
            case "bun":
              packageManager = {
                name: "bun",
                runCmd: ["bun", "--silent", "run"],
              };
              break;
            case "yarn":
              packageManager = {
                name: "yarn",
                runCmd: ["yarn", "run"],
              };
              break;
            case "npm":
              packageManager = {
                name: "npm",
                runCmd: ["npm", "run"],
              };
              break;
            case "pnpm":
              // This shouldn't happen since we check pnpm-workspace.yaml first
              packageManager = {
                name: "pnpm",
                runCmd: ["pnpm", "--silent", "run"],
              };
              break;
            default:
              // Fallback to bun for unknown package managers
              packageManager = {
                name: "bun",
                runCmd: ["bun", "--silent", "run"],
              };
          }
        } else {
          // No lockfile detected, default to bun
          packageManager = {
            name: "bun",
            runCmd: ["bun", "--silent", "run"],
          };
        }

        return {
          packageManager,
          packageGlobs: Array.isArray(json.workspaces) ? json.workspaces : [],
        };
      }
    } catch (error) {
      relinka("warn", `Failed to parse package.json: ${error}`);
    }
  }

  return null;
}

export async function readPackageJson(packageJsonPath: string): Promise<Package | null> {
  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const json = JSON.parse(content);

    const name = json.name;
    if (!name) {
      return null;
    }

    const buildScript = json.scripts?.build;
    const dependencyNames: string[] = [];

    // Collect workspace dependencies
    const deps = { ...json.dependencies, ...json.devDependencies };
    for (const [depName, version] of Object.entries(deps)) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        dependencyNames.push(depName);
      }
    }

    return {
      dir: path.dirname(packageJsonPath),
      name,
      buildScript,
      dependencyNames,
      config: createPackageConfig(json),
    };
  } catch (error) {
    relinka("warn", `Failed to read package.json at ${packageJsonPath}: ${error}`);
    return null;
  }
}

export function getCacheDir(monorepo: Monorepo): string {
  return path.join(monorepo.root, ".cache");
}
