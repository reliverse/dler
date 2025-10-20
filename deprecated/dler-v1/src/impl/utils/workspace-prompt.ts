import { re } from "@reliverse/relico";
import { cancel, isCancel, multiselectPrompt } from "@reliverse/rempts";
import type { WorkspacePackage } from "./workspace-utils";

/**
 * Prompts user to select workspace packages for build or publish operations
 */
export async function promptWorkspacePackages(
  packages: WorkspacePackage[],
  command: "build" | "publish",
  skipPrompt = false,
): Promise<WorkspacePackage[]> {
  if (packages.length === 0) {
    return [];
  }

  // Sort packages by dependencies to show them in logical order
  const sortedPackages = packages.sort((a, b) => {
    // If a depends on b, b should come first
    if (a.workspaceDependencies.includes(b.name)) return 1;
    if (b.workspaceDependencies.includes(a.name)) return -1;
    return a.name.localeCompare(b.name);
  });

  // If skipPrompt is true, return all packages in dependency order
  if (skipPrompt) {
    return sortedPackages;
  }

  const options = sortedPackages.map((pkg) => ({
    label: `${pkg.name} ${re.dim(`(${pkg.version})`)}`,
    value: pkg.name,
    hint:
      pkg.workspaceDependencies.length > 0
        ? `Depends on: ${pkg.workspaceDependencies.join(", ")}`
        : "No workspace dependencies",
  }));

  const title = command === "build" ? "Select packages to build" : "Select packages to publish";

  const content =
    command === "build"
      ? "Choose which workspace packages to build. Packages will be built in dependency order."
      : "Choose which workspace packages to publish. Packages will be built and published in dependency order.";

  const selectedPackageNames = await multiselectPrompt({
    title,
    content,
    options,
    defaultValue: packages.map((pkg) => pkg.name), // Select all by default
    displayInstructions: true,
  });

  if (isCancel(selectedPackageNames)) {
    cancel(re.red("Operation cancelled"));
    process.exit(0);
  }

  // Return packages in dependency order
  const selectedPackages = selectedPackageNames
    .map((name) => packages.find((pkg) => pkg.name === name))
    .filter((pkg): pkg is WorkspacePackage => pkg !== undefined);

  return selectedPackages;
}

/**
 * Shows a summary of selected packages and their dependency order
 */
export function showPackageSummary(
  packages: WorkspacePackage[],
  command: "build" | "publish",
): void {
  const action = command === "build" ? "Building" : "Publishing";

  console.log(`\n${re.cyan(`${action} ${packages.length} package(s) in dependency order:`)}`);

  packages.forEach((pkg, index) => {
    const deps =
      pkg.workspaceDependencies.length > 0
        ? ` ${re.dim(`(depends on: ${pkg.workspaceDependencies.join(", ")})`)}`
        : "";

    console.log(`  ${index + 1}. ${re.green(pkg.name)} ${re.dim(`v${pkg.version}`)}${deps}`);
  });

  console.log(); // Empty line for spacing
}
