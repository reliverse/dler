import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { multiselectPrompt } from "@reliverse/rempts";
import { $ } from "bun";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";

import { getConfigBunfig } from "~/app/config/load";
import { isCatalogSupported, updateCatalogs } from "~/app/utils/pm/pm-catalog";
import { detectPackageManager } from "~/app/utils/pm/pm-detect";
import {
  checkPackageUpdate,
  collectTargetDependencies,
  findAllPackageJsons,
  findWorkspacePackageJsons,
  isMonorepo,
  type PackageCheckOptions,
  prepareDependenciesForUpdate,
  runInstallCommand,
  runInstallCommandWithFilter,
  type UpdateResult,
  updatePackageJsonFile,
  updateWorkspacePackages,
} from "./utils";

interface UpdateArgs {
  name?: string[];
  ignore?: string[];
  "dev-only"?: boolean;
  "prod-only"?: boolean;
  "peer-only"?: boolean;
  "optional-only"?: boolean;
  "catalogs-only"?: boolean;
  "dry-run"?: boolean;
  concurrency?: number;
  "with-check-script"?: boolean;
  linker?: string;
  "with-install"?: boolean;
  global?: boolean;
  interactive?: boolean;
  filter?: string[];
  "all-workspaces"?: boolean;
  "root-only"?: boolean;
  recursive?: boolean;
  "save-prefix"?: string;
  "allow-major"?: boolean;
}

export async function validateUpdateArgs(args: UpdateArgs): Promise<void> {
  // Early argument validation for exclusive flags
  const exclusiveFlags = [
    args["dev-only"],
    args["prod-only"],
    args["peer-only"],
    args["optional-only"],
    args["catalogs-only"],
  ];

  if (exclusiveFlags.filter(Boolean).length > 1) {
    relinka(
      "error",
      "Cannot specify multiple exclusive flags (--dev-only, --prod-only, --peer-only, --optional-only, --catalogs-only)",
    );
    process.exit(1);
  }

  // Validate mutually exclusive workspace flags
  if (args["all-workspaces"] && args["root-only"]) {
    relinka("error", "Cannot specify both --all-workspaces and --root-only flags");
    process.exit(1);
  }

  if (args.recursive && (args["all-workspaces"] || args["root-only"])) {
    relinka(
      "error",
      "Cannot use --recursive with --all-workspaces or --root-only flags. Use --no-recursive to disable recursive mode.",
    );
    process.exit(1);
  }
}

export async function handleCatalogOnlyUpdate(args: UpdateArgs): Promise<boolean> {
  if (!args["catalogs-only"]) {
    return false;
  }

  const packageManager = await detectPackageManager(process.cwd());
  if (!packageManager) {
    relinka("error", "Could not detect package manager");
    process.exit(1);
  }

  if (!isCatalogSupported(packageManager)) {
    relinka(
      "error",
      `Catalogs are not supported by ${packageManager.name}. Only Bun supports catalogs.`,
    );
    process.exit(1);
  }

  await updateCatalogs(process.cwd());
  return true;
}

export async function validatePackageJson(): Promise<string> {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    relinka("error", "No package.json found in current directory");
    process.exit(1);
  }

  return packageJsonPath;
}

export async function getEffectiveLinker(args: UpdateArgs): Promise<{
  effectiveLinker: string;
  linkerSource: string;
}> {
  let effectiveLinker = args.linker || "hoisted";
  let linkerSource = "CLI default";

  if (typeof Bun !== "undefined") {
    const bunfigConfig = await getConfigBunfig();

    // Use bunfig linker setting if CLI uses default and bunfig has valid value
    const bunfigLinker = bunfigConfig?.install?.linker;
    if (
      bunfigLinker &&
      ["isolated", "hoisted"].includes(bunfigLinker) &&
      args.linker === "hoisted"
    ) {
      effectiveLinker = bunfigLinker;
      linkerSource = bunfigLinker === "hoisted" ? "bunfig.toml (same as default)" : "bunfig.toml";
    }
  }

  // Explicit CLI override always wins
  if (args.linker !== "hoisted") {
    effectiveLinker = args.linker!;
    linkerSource = "CLI override";
  }

  relinka("verbose", `Using linker strategy: ${effectiveLinker} (from ${linkerSource})`);

  return { effectiveLinker, linkerSource };
}

export async function prepareUpdateCandidates(args: UpdateArgs): Promise<{
  candidates: string[];
  allDepsMap: Record<string, any>;
}> {
  const packageJson = await readPackageJSON();
  const { map: allDepsMap } = collectTargetDependencies(packageJson, args);

  // Filter and prepare dependencies for updating
  const candidates = prepareDependenciesForUpdate(allDepsMap, args);

  if (candidates.length === 0) {
    relinka("warn", "No dependencies to update based on provided filters");
    return { candidates: [], allDepsMap };
  }

  return { candidates, allDepsMap };
}

export async function checkPackageUpdates(
  candidates: string[],
  allDepsMap: Record<string, any>,
  args: UpdateArgs,
): Promise<UpdateResult[]> {
  const options: PackageCheckOptions = {
    allowMajor: !!args["allow-major"],
    savePrefix: args["save-prefix"] as string,
    concurrency: args.concurrency || 5,
  };

  return await pMap(
    candidates,
    async (dep): Promise<UpdateResult> => {
      const depInfo = allDepsMap[dep];
      if (!depInfo?.versionSpec) {
        return {
          package: dep,
          currentVersion: "unknown",
          latestVersion: "unknown",
          updated: false,
          error: "Current version not found",
          semverCompatible: false,
          location: Array.from(depInfo?.locations || ["unknown"]).join(", "),
        };
      }

      return checkPackageUpdate(dep, depInfo.versionSpec, depInfo.locations, options);
    },
    { concurrency: args.concurrency || 5 },
  );
}

export async function handleInteractiveSelection(results: UpdateResult[]): Promise<UpdateResult[]> {
  const toUpdate = results.filter((r) => r.updated && !r.error);
  const errors = results.filter((r) => r.error);
  const upToDate = results.filter((r) => !r.updated && !r.error && r.semverCompatible);

  // Combine all packages for selection
  const allPackages = [
    ...toUpdate.map((pkg) => ({
      ...pkg,
      canUpdate: true,
      isUpToDate: false,
      hasError: false,
    })),
    ...upToDate.map((pkg) => ({
      ...pkg,
      canUpdate: false,
      isUpToDate: true,
      hasError: false,
    })),
    ...errors.map((pkg) => ({ ...pkg, canUpdate: false, isUpToDate: false, hasError: true })),
  ];

  const selectedPackages = await multiselectPrompt({
    title: "Select dependencies to update",
    options: [
      { label: "Exit", value: "exit" },
      ...allPackages.map((pkg) => {
        let label = `${pkg.package} (${pkg.location})`;

        if (pkg.canUpdate) {
          label += `: ${pkg.currentVersion} → ${pkg.latestVersion}`;
        } else if (pkg.isUpToDate) {
          label += `: ${pkg.currentVersion} (up-to-date)`;
        } else if (pkg.hasError) {
          label += `: ${pkg.currentVersion} (has errors)`;
        }

        return {
          label,
          value: pkg.package,
          disabled: !pkg.canUpdate,
          hint: pkg.hasError ? pkg.error : undefined,
        };
      }),
    ],
  });

  if (selectedPackages.length === 0 || selectedPackages.includes("exit")) {
    relinka("log", "Exiting update process");
    return [];
  }

  // Filter out "exit" and update toUpdate to only include selected packages
  const actualSelectedPackages = selectedPackages.filter((pkg) => pkg !== "exit");
  const filteredToUpdate = toUpdate.filter((update) =>
    actualSelectedPackages.includes(update.package),
  );
  relinka("log", `Updating ${actualSelectedPackages.length} selected dependencies...`);

  return filteredToUpdate;
}

export async function updateRootPackageJson(
  packageJsonPath: string,
  allDepsMap: Record<string, any>,
  toUpdate: UpdateResult[],
  savePrefix: string,
): Promise<number> {
  return await updatePackageJsonFile(packageJsonPath, allDepsMap, toUpdate, savePrefix);
}

export async function handleRecursiveUpdates(
  args: UpdateArgs,
  options: PackageCheckOptions,
): Promise<number> {
  const allPackageJsons = await findAllPackageJsons(process.cwd());
  // Exclude the root package.json since it's already updated
  const rootPackageJsonPath = path.resolve(process.cwd(), "package.json");
  const otherPackageJsons = allPackageJsons.filter((p) => p !== rootPackageJsonPath);

  if (otherPackageJsons.length > 0) {
    relinka(
      "verbose",
      `Found ${otherPackageJsons.length} additional package.json files to update recursively`,
    );
    return await updateWorkspacePackages(otherPackageJsons, args, options);
  }

  return 0;
}

export async function handleWorkspaceUpdates(
  args: UpdateArgs,
  options: PackageCheckOptions,
): Promise<number> {
  const isMonorepoProject = await isMonorepo(process.cwd());

  // Determine if we should update workspaces
  const shouldUpdateWorkspaces =
    args["all-workspaces"] || (!args["root-only"] && isMonorepoProject);

  if (shouldUpdateWorkspaces) {
    const workspacePkgJsons = await findWorkspacePackageJsons(process.cwd());
    if (workspacePkgJsons.length > 0) {
      return await updateWorkspacePackages(workspacePkgJsons, args, options);
    } else if (args["all-workspaces"]) {
      relinka("warn", "No workspace packages found but --all-workspaces flag was provided");
    }
  } else if (isMonorepoProject) {
    relinka("log", "Skipping workspace packages due to --root-only flag");
  }

  return 0;
}

export function displayUpdateSummary(
  totalUpdated: number,
  args: UpdateArgs,
  isMonorepoProject: boolean,
  shouldUpdateWorkspaces: boolean,
): void {
  if (args.recursive) {
    relinka("log", `Updated ${totalUpdated} dependencies across all package.json files`);
  } else {
    if (isMonorepoProject && shouldUpdateWorkspaces) {
      relinka("log", `Updated ${totalUpdated} dependencies across workspace (root + workspaces)`);
    } else if (isMonorepoProject) {
      relinka("log", `Updated ${totalUpdated} dependencies in root package.json only`);
    } else {
      relinka("log", `Updated ${totalUpdated} dependencies`);
    }
  }
}

export async function handleInstallation(
  args: UpdateArgs,
  effectiveLinker: string,
  packageJson: any,
): Promise<void> {
  if (!args["with-install"]) {
    const packageManager = await detectPackageManager(process.cwd());
    const installCommand = packageManager?.command || "your package manager";
    relinka(
      "log",
      `Install step is skipped by default. Run '${installCommand} install' manually to apply the changes.`,
    );
    relinka(
      "log",
      `(experimental) Next time you can try --with-install flag to run it automatically.`,
    );
    return;
  }

  const packageManager = await detectPackageManager(process.cwd());
  if (!packageManager) {
    relinka("warn", "Could not detect package manager. Please run install manually.");
    return;
  }

  try {
    // Handle workspace filtering
    if (args.filter && args.filter.length > 0) {
      // For filtered installs, we need to pass the filter arguments
      const filterArgs = args.filter.flatMap((filter) => ["--filter", filter]);
      await runInstallCommandWithFilter(packageManager, effectiveLinker, filterArgs);
    } else {
      await runInstallCommand(packageManager, effectiveLinker);
    }

    // Run check script if available and requested (only for bun)
    if (packageManager.name === "bun" && packageJson.scripts?.check && args["with-check-script"]) {
      await $`bun check`;
    }
  } catch (error) {
    relinka("warn", `Install failed: ${error instanceof Error ? error.message : String(error)}`);
    relinka("log", `Run '${packageManager.command} install' manually to apply the changes`);
  }
}
