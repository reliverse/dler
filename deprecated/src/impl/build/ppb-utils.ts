import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { selectPrompt } from "@reliverse/rempts";
import { $ } from "bun";
import { execa } from "execa";
import { lookpath } from "lookpath";
import { readPackageJSON } from "pkg-types";

export type PackageManager = "bun" | "npm" | "yarn" | "pnpm";

// Map CLI commands to their package names
const COMMAND_TO_PACKAGE: Record<string, string> = {
  tsc: "typescript",
  eslint: "eslint",
  biome: "@biomejs/biome",
  knip: "knip",
};

let selectedPackageManager: PackageManager | null = null;

export async function getPackageManager(): Promise<PackageManager> {
  if (selectedPackageManager) return selectedPackageManager;
  if (process.versions.bun) {
    selectedPackageManager = "bun";
    return selectedPackageManager;
  }

  const result = await selectPrompt({
    title: "Select package manager to use for running tools:",
    options: [
      { label: "npm", value: "npm" },
      { label: "yarn", value: "yarn" },
      { label: "pnpm", value: "pnpm" },
    ],
  });

  selectedPackageManager = result as PackageManager;
  return selectedPackageManager;
}

/**
 * Checks if a package exists in package.json scripts or dependencies
 */
async function isCommandInPackageJson(command: string): Promise<boolean> {
  try {
    const packageJson = await readPackageJSON();
    const packageName = COMMAND_TO_PACKAGE[command];
    if (!packageName) return false;

    // Check if the package is installed
    return (
      packageName in (packageJson.dependencies || {}) ||
      packageName in (packageJson.devDependencies || {})
    );
  } catch (_error) {
    return false;
  }
}

/**
 * Checks if a command is available in the system or package.json
 * First checks package.json dependencies, then falls back to global command detection
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const packageName = COMMAND_TO_PACKAGE[command];
  if (!packageName) return false;

  // First check if package exists in package.json dependencies
  if (await isCommandInPackageJson(command)) {
    relinka("verbose", `[dlerPreBuild] Package "${packageName}" found in package.json`);
    return true;
  }

  // Display warning if package is not found in package.json
  relinka(
    "warn",
    `[dlerPreBuild] Package "${packageName}" not found in package.json. Consider installing it as a dependency.`,
  );

  // Then check if command is available globally
  return (await lookpath(command)) !== undefined;
}

/**
 * Executes a shell command using the appropriate method based on the environment
 */
export async function executeCommand(command: string): Promise<void> {
  // Check if this is a known CLI command that should be run through package manager
  const [firstWord, ...rest] = command.split(" ").filter(Boolean);
  if (!firstWord) return;

  // Handle case when package manager is accidentally included
  const pkgManagers = ["bun", "yarn", "pnpm", "npm"] as const;
  const isPkgManager = pkgManagers.includes(firstWord as (typeof pkgManagers)[number]);
  const cmd = isPkgManager ? rest[0] : firstWord;
  const args = isPkgManager ? rest.slice(1) : rest;
  if (!cmd) return;

  const packageName = COMMAND_TO_PACKAGE[cmd];
  if (packageName && (await isCommandInPackageJson(cmd))) {
    const pkgManager = isPkgManager ? firstWord : await getPackageManager();
    if (process.versions.bun) {
      await $`${pkgManager} ${cmd} ${args.join(" ")}`;
    } else {
      await execa(pkgManager, [cmd, ...args], { stdio: "inherit" });
    }
    return;
  }

  // Fallback to direct command execution
  if (process.versions.bun) {
    await $`${cmd} ${args.join(" ")}`;
  } else {
    await execa(cmd, args, { stdio: "inherit" });
  }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Executes hooks with consistent error handling and logging
 */
export async function executeDlerHooks(
  hooks: (() => Promise<void>)[],
  phase: "pre-build" | "post-build",
): Promise<void> {
  if (!hooks.length) return;

  relinka("verbose", `[dlerPreBuild] Running ${phase} hooks...`);

  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      relinka("error", `[dlerPreBuild] Error in ${phase} hook: ${message}`);
      throw error;
    }
  }
}
