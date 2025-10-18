import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { glob } from "glob";
import micromatch from "micromatch";
import { readPackageJson } from "../monorepo/monorepo-mod";

export interface WorkspacePackage {
  name: string;
  path: string;
  packageJsonPath: string;
  version: string;
  private: boolean;
  dependencies: string[];
  workspaceDependencies: string[]; // deps that are in the workspace
}

export interface WorkspaceConfig {
  enabled: boolean;
  autoDiscoverPackages: boolean;
  buildOrder: "dependency" | "parallel";
  includePatterns: string[];
  excludePatterns: string[];
}

/**
 * Detects if the current directory has workspace configuration and returns publishable packages
 */
export async function detectWorkspaces(cwd: string): Promise<WorkspacePackage[] | null> {
  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    return null;
  }

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    // Check for workspaces configuration
    let workspaceGlobs: string[] = [];

    if (packageJson.workspaces) {
      if (Array.isArray(packageJson.workspaces)) {
        // Array format: "workspaces": ["packages/*", "apps/*"]
        workspaceGlobs = packageJson.workspaces;
      } else if (typeof packageJson.workspaces === "object" && packageJson.workspaces.packages) {
        // Object format: "workspaces": { "packages": ["packages/*", "apps/*"] }
        workspaceGlobs = Array.isArray(packageJson.workspaces.packages)
          ? packageJson.workspaces.packages
          : [];
      }
    }

    if (workspaceGlobs.length === 0) {
      return null;
    }

    relinka("verbose", `Found workspace configuration with patterns: ${workspaceGlobs.join(", ")}`);

    // Expand workspace globs to find all package.json files
    const packageJsonPaths: string[] = [];

    for (const pattern of workspaceGlobs) {
      const searchPattern = path.join(cwd, pattern, "package.json");
      const matches = await glob(searchPattern, { cwd });
      packageJsonPaths.push(...matches.map((match: string) => path.resolve(cwd, match)));
    }

    // Remove duplicates
    const uniquePackageJsonPaths = [...new Set(packageJsonPaths)];

    relinka("verbose", `Found ${uniquePackageJsonPaths.length} package.json files in workspace`);

    // Read each package and filter publishable ones
    const packages: WorkspacePackage[] = [];

    for (const packageJsonPath of uniquePackageJsonPaths) {
      const pkg = await readPackageJson(packageJsonPath);

      if (!pkg) {
        relinka("verbose", `Skipping invalid package.json at ${packageJsonPath}`);
        continue;
      }

      // Read the raw package.json to get additional fields
      try {
        const rawContent = await fs.readFile(packageJsonPath, "utf-8");
        const rawPkg = JSON.parse(rawContent);

        // Skip if missing name or is private
        if (!rawPkg.name || rawPkg.private === true) {
          relinka(
            "verbose",
            `Skipping package ${rawPkg.name || "unnamed"} (${rawPkg.private ? "private" : "no name"})`,
          );
          continue;
        }

        // Extract workspace dependencies
        const workspaceDependencies: string[] = [];
        const allDeps = { ...rawPkg.dependencies, ...rawPkg.devDependencies };

        for (const [depName, version] of Object.entries(allDeps)) {
          if (typeof version === "string" && version.startsWith("workspace:")) {
            workspaceDependencies.push(depName);
          }
        }

        packages.push({
          name: rawPkg.name,
          path: path.dirname(packageJsonPath),
          packageJsonPath,
          version: rawPkg.version || "0.0.0",
          private: rawPkg.private === true,
          dependencies: Object.keys(allDeps),
          workspaceDependencies,
        });

        relinka("verbose", `Added package: ${rawPkg.name} (${rawPkg.version})`);
      } catch (error) {
        relinka("warn", `Failed to read package.json at ${packageJsonPath}: ${error}`);
      }
    }

    relinka("verbose", `Found ${packages.length} publishable packages in workspace`);
    return packages.length > 0 ? packages : null;
  } catch (error) {
    relinka("warn", `Failed to detect workspaces: ${error}`);
    return null;
  }
}

/**
 * Sorts packages by their dependencies to ensure correct build/publish order
 */
export function sortPackagesByDependencies(packages: WorkspacePackage[]): WorkspacePackage[] {
  const sorted: WorkspacePackage[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(pkg: WorkspacePackage) {
    if (visiting.has(pkg.name)) {
      relinka("warn", `Circular dependency detected involving package: ${pkg.name}`);
      return;
    }

    if (visited.has(pkg.name)) {
      return;
    }

    visiting.add(pkg.name);

    // Visit dependencies first
    for (const depName of pkg.workspaceDependencies) {
      const depPkg = packages.find((p) => p.name === depName);
      if (depPkg) {
        visit(depPkg);
      }
    }

    visiting.delete(pkg.name);
    visited.add(pkg.name);
    sorted.push(pkg);
  }

  // Visit all packages
  for (const pkg of packages) {
    visit(pkg);
  }

  relinka("verbose", `Sorted packages by dependencies: ${sorted.map((p) => p.name).join(" -> ")}`);
  return sorted;
}

/**
 * Filters packages based on include/exclude patterns
 */
export function filterPackagesByPatterns(
  packages: WorkspacePackage[],
  includePatterns: string[],
  excludePatterns: string[],
): WorkspacePackage[] {
  let filtered = packages;

  // Apply include patterns
  if (includePatterns.length > 0) {
    filtered = filtered.filter((pkg) =>
      includePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(pkg.name) || regex.test(pkg.path);
      }),
    );
  }

  // Apply exclude patterns
  if (excludePatterns.length > 0) {
    filtered = filtered.filter(
      (pkg) =>
        !excludePatterns.some((pattern) => {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return regex.test(pkg.name) || regex.test(pkg.path);
        }),
    );
  }

  return filtered;
}

/**
 * Filters workspace packages based on package name patterns
 * Supports glob patterns for package names
 */
export function filterPackagesByFilters(
  packages: WorkspacePackage[],
  filters: string[],
): WorkspacePackage[] {
  if (filters.length === 0) {
    return packages;
  }

  const matchedPackages = new Set<WorkspacePackage>();
  const unmatchedFilters: string[] = [];

  for (const filter of filters) {
    const trimmedFilter = filter.trim().replace(/^["']|["']$/g, ""); // Remove quotes
    let hasMatches = false;

    for (const pkg of packages) {
      let isMatch = false;

      // Match against package name using glob patterns
      try {
        isMatch = micromatch.isMatch(pkg.name, trimmedFilter);
      } catch {
        // Fallback to simple equality if micromatch fails
        isMatch = pkg.name === trimmedFilter;
      }

      if (isMatch) {
        matchedPackages.add(pkg);
        hasMatches = true;
      }
    }

    if (!hasMatches) {
      unmatchedFilters.push(trimmedFilter);
    }
  }

  // Warn about unmatched filters
  if (unmatchedFilters.length > 0) {
    relinka("warn", `No packages matched filter(s): ${unmatchedFilters.join(", ")}`);
  }

  const result = Array.from(matchedPackages);
  relinka(
    "verbose",
    `Filtered to ${result.length} packages: ${result.map((p) => p.name).join(", ")}`,
  );

  return result;
}

/**
 * Parses filter arguments from CLI input
 * Supports both comma-separated strings and arrays
 */
export function parseFilterArgs(filterArg: string | string[] | undefined): string[] {
  if (!filterArg) {
    return [];
  }

  if (Array.isArray(filterArg)) {
    return filterArg.flatMap((f) => f.split(",").map((s) => s.trim())).filter(Boolean);
  }

  return filterArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
