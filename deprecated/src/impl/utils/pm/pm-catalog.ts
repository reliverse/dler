import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import type { PackageManager } from "./pm-types";

/**
 * Interface for catalog structure
 */
export interface CatalogStructure {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

/**
 * Get catalog structure from package.json
 */
export async function getCatalogStructure(
  cwd: string = process.cwd(),
): Promise<CatalogStructure> {
  try {
    const packageJson = await readPackageJSON(cwd);
    const workspaces = (packageJson as any).workspaces || {};

    return {
      catalog:
        (workspaces as any).catalog || (packageJson as any).catalog || {},
      catalogs:
        (workspaces as any).catalogs || (packageJson as any).catalogs || {},
    };
  } catch (error) {
    relinka("warn", `Failed to read catalog structure: ${error}`);
    return { catalog: {}, catalogs: {} };
  }
}

/**
 * Add dependencies to catalog
 */
export async function addToCatalog(
  dependencies: string[],
  catalogType: "catalog" | "catalogs",
  catalogName?: string,
  cwd: string = process.cwd(),
): Promise<void> {
  try {
    const packageJsonPath = path.resolve(cwd, "package.json");
    const packageJson = await readPackageJSON(cwd);

    // Get latest versions for dependencies
    const latestVersions: Record<string, string> = {};

    for (const dep of dependencies) {
      try {
        // Extract package name (handle scoped packages)
        const packageName = dep.split("@")[0] || dep;

        // Fetch latest version from npm registry
        const response = await fetch(
          `https://registry.npmjs.org/${packageName}/latest`,
        );
        if (response.ok) {
          const data = (await response.json()) as { version: string };
          latestVersions[packageName] = `^${data.version}`;
        } else {
          latestVersions[packageName] = "latest";
        }
      } catch (error) {
        relinka("warn", `Failed to get latest version for ${dep}: ${error}`);
        latestVersions[dep] = "latest";
      }
    }

    // Update package.json
    const updatedPackageJson = { ...packageJson };

    if (catalogType === "catalog") {
      // Add to default catalog
      if (!updatedPackageJson.workspaces) {
        (updatedPackageJson as any).workspaces = {};
      }
      if (!(updatedPackageJson as any).workspaces.catalog) {
        (updatedPackageJson as any).workspaces.catalog = {};
      }

      Object.assign(
        (updatedPackageJson as any).workspaces.catalog,
        latestVersions,
      );

      // Also update top-level catalog if it exists
      if ((updatedPackageJson as any).catalog) {
        Object.assign((updatedPackageJson as any).catalog, latestVersions);
      }
    } else if (catalogType === "catalogs" && catalogName) {
      // Add to named catalog
      if (!updatedPackageJson.workspaces) {
        (updatedPackageJson as any).workspaces = {};
      }
      if (!(updatedPackageJson as any).workspaces.catalogs) {
        (updatedPackageJson as any).workspaces.catalogs = {};
      }
      if (!(updatedPackageJson as any).workspaces.catalogs[catalogName]) {
        (updatedPackageJson as any).workspaces.catalogs[catalogName] = {};
      }

      Object.assign(
        (updatedPackageJson as any).workspaces.catalogs[catalogName],
        latestVersions,
      );

      // Also update top-level catalogs if it exists
      if ((updatedPackageJson as any).catalogs) {
        if (!(updatedPackageJson as any).catalogs[catalogName]) {
          (updatedPackageJson as any).catalogs[catalogName] = {};
        }
        Object.assign(
          (updatedPackageJson as any).catalogs[catalogName],
          latestVersions,
        );
      }
    }

    // Write updated package.json
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(updatedPackageJson, null, 2) + "\n",
      "utf8",
    );

    relinka(
      "success",
      `Added ${dependencies.length} dependencies to ${catalogType}${catalogName ? ` (${catalogName})` : ""}`,
    );
  } catch (error) {
    relinka("error", `Failed to add dependencies to catalog: ${error}`);
    throw error;
  }
}

/**
 * Check if catalog is supported by package manager
 */
export function isCatalogSupported(packageManager: PackageManager): boolean {
  return packageManager.name === "bun";
}

/**
 * Get catalog reference format for a dependency
 */
export function getCatalogReference(
  dependency: string,
  catalogType: "catalog" | "catalogs",
  catalogName?: string,
): string {
  if (catalogType === "catalog") {
    return "catalog:";
  } else if (catalogType === "catalogs" && catalogName) {
    return `catalog:${catalogName}`;
  }
  return dependency;
}

/**
 * List all catalogs and their dependencies
 */
export async function listCatalogs(cwd: string = process.cwd()): Promise<void> {
  try {
    const { catalog, catalogs } = await getCatalogStructure(cwd);

    if (
      (!catalog || Object.keys(catalog).length === 0) &&
      (!catalogs || Object.keys(catalogs).length === 0)
    ) {
      relinka("info", "No catalogs found in package.json");
      return;
    }

    if (catalog && Object.keys(catalog).length > 0) {
      relinka("info", "Default catalog:");
      for (const [dep, version] of Object.entries(catalog)) {
        relinka("verbose", `  ${dep}: ${version}`);
      }
    }

    if (catalogs && Object.keys(catalogs).length > 0) {
      for (const [catalogName, dependencies] of Object.entries(catalogs)) {
        relinka("info", `\nCatalog '${catalogName}':`);
        for (const [dep, version] of Object.entries(dependencies)) {
          relinka("verbose", `  ${dep}: ${version}`);
        }
      }
    }
  } catch (error) {
    relinka("error", `Failed to list catalogs: ${error}`);
  }
}

/**
 * Update catalog dependencies to latest versions
 */
export async function updateCatalogs(
  cwd: string = process.cwd(),
): Promise<void> {
  try {
    const { catalog, catalogs } = await getCatalogStructure(cwd);
    const packageJsonPath = path.resolve(cwd, "package.json");
    const packageJson = await readPackageJSON(cwd);
    const updatedPackageJson = { ...packageJson };
    let updatedCount = 0;

    // Update default catalog
    if (catalog && Object.keys(catalog).length > 0) {
      const updatedCatalog: Record<string, string> = {};

      for (const [dep, currentVersion] of Object.entries(catalog)) {
        try {
          // Fetch latest version from npm registry
          const response = await fetch(
            `https://registry.npmjs.org/${dep}/latest`,
          );
          if (response.ok) {
            const data = (await response.json()) as { version: string };
            const latestVersion = `^${data.version}`;

            if (latestVersion !== currentVersion) {
              updatedCatalog[dep] = latestVersion;
              updatedCount++;
              relinka(
                "verbose",
                `  ${dep}: ${currentVersion} → ${latestVersion}`,
              );
            } else {
              updatedCatalog[dep] = currentVersion;
            }
          } else {
            updatedCatalog[dep] = currentVersion;
          }
        } catch (error) {
          relinka("warn", `Failed to update ${dep}: ${error}`);
          updatedCatalog[dep] = currentVersion;
        }
      }

      // Update in package.json
      if (!updatedPackageJson.workspaces) {
        (updatedPackageJson as any).workspaces = {};
      }
      (updatedPackageJson as any).workspaces.catalog = updatedCatalog;

      // Also update top-level catalog if it exists
      if ((updatedPackageJson as any).catalog) {
        (updatedPackageJson as any).catalog = updatedCatalog;
      }
    }

    // Update named catalogs
    if (catalogs && Object.keys(catalogs).length > 0) {
      if (!updatedPackageJson.workspaces) {
        (updatedPackageJson as any).workspaces = {};
      }
      if (!(updatedPackageJson as any).workspaces.catalogs) {
        (updatedPackageJson as any).workspaces.catalogs = {};
      }

      for (const [catalogName, dependencies] of Object.entries(catalogs)) {
        const updatedNamedCatalog: Record<string, string> = {};

        for (const [dep, currentVersion] of Object.entries(dependencies)) {
          try {
            // Fetch latest version from npm registry
            const response = await fetch(
              `https://registry.npmjs.org/${dep}/latest`,
            );
            if (response.ok) {
              const data = (await response.json()) as { version: string };
              const latestVersion = `^${data.version}`;

              if (latestVersion !== currentVersion) {
                updatedNamedCatalog[dep] = latestVersion;
                updatedCount++;
                relinka(
                  "verbose",
                  `  ${catalogName}:${dep}: ${currentVersion} → ${latestVersion}`,
                );
              } else {
                updatedNamedCatalog[dep] = currentVersion;
              }
            } else {
              updatedNamedCatalog[dep] = currentVersion;
            }
          } catch (error) {
            relinka("warn", `Failed to update ${catalogName}:${dep}: ${error}`);
            updatedNamedCatalog[dep] = currentVersion;
          }
        }

        (updatedPackageJson as any).workspaces.catalogs[catalogName] =
          updatedNamedCatalog;

        // Also update top-level catalogs if it exists
        if ((updatedPackageJson as any).catalogs) {
          (updatedPackageJson as any).catalogs[catalogName] =
            updatedNamedCatalog;
        }
      }
    }

    // Write updated package.json
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(updatedPackageJson, null, 2) + "\n",
      "utf8",
    );

    if (updatedCount > 0) {
      relinka("success", `Updated ${updatedCount} catalog dependencies`);
    } else {
      relinka("success", "All catalog dependencies are up to date");
    }
  } catch (error) {
    relinka("error", `Failed to update catalogs: ${error}`);
    throw error;
  }
}

/**
 * Remove dependencies from catalog
 */
export async function removeFromCatalog(
  dependencies: string[],
  catalogType: "catalog" | "catalogs",
  catalogName?: string,
  cwd: string = process.cwd(),
): Promise<void> {
  try {
    const packageJsonPath = path.resolve(cwd, "package.json");
    const packageJson = await readPackageJSON(cwd);
    const updatedPackageJson = { ...packageJson };

    if (catalogType === "catalog") {
      // Remove from default catalog
      if ((updatedPackageJson as any).workspaces?.catalog) {
        for (const dep of dependencies) {
          delete (updatedPackageJson as any).workspaces.catalog[dep];
        }
      }

      // Also remove from top-level catalog if it exists
      if ((updatedPackageJson as any).catalog) {
        for (const dep of dependencies) {
          delete (updatedPackageJson as any).catalog[dep];
        }
      }
    } else if (catalogType === "catalogs" && catalogName) {
      // Remove from named catalog
      if ((updatedPackageJson as any).workspaces?.catalogs?.[catalogName]) {
        for (const dep of dependencies) {
          delete (updatedPackageJson as any).workspaces.catalogs[catalogName][
            dep
          ];
        }
      }

      // Also remove from top-level catalogs if it exists
      if ((updatedPackageJson as any).catalogs?.[catalogName]) {
        for (const dep of dependencies) {
          delete (updatedPackageJson as any).catalogs[catalogName][dep];
        }
      }
    }

    // Write updated package.json
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(updatedPackageJson, null, 2) + "\n",
      "utf8",
    );

    relinka(
      "success",
      `Removed ${dependencies.length} dependencies from ${catalogType}${catalogName ? ` (${catalogName})` : ""}`,
    );
  } catch (error) {
    relinka("error", `Failed to remove dependencies from catalog: ${error}`);
    throw error;
  }
}
