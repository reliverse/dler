import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand, multiselectPrompt } from "@reliverse/rempts";
import { lookpath } from "lookpath";
import { readPackageJSON } from "pkg-types";

import { x } from "~/libs/sdk/sdk-impl/utils/exec/exec-mod";
import { detectPackageManager } from "~/libs/sdk/sdk-impl/utils/pm/pm-detect";

interface UpgradeResult {
  tool: string;
  status: "upgraded" | "up-to-date" | "not-found" | "error";
  message?: string;
}

export default defineCommand({
  meta: {
    name: "upgrade",
    version: "1.0.0",
    description: "Upgrade system development tools",
  },
  args: defineArgs({
    interactive: {
      type: "boolean",
      description: "Interactively select which tools to upgrade",
      default: true,
    },
  }),
  async run({ args }) {
    // relinka("info", "Checking and upgrading development tools...");

    // Define all tools and their upgrade functions
    const toolUpgradeFunctions = [
      { name: "dler (local)", fn: upgradeDlerLocal },
      { name: "dler (global)", fn: upgradeDlerGlobal },
      { name: "git", fn: upgradeGit },
      { name: "node.js", fn: upgradeNode },
      { name: "npm", fn: upgradeNpm },
      { name: "bun", fn: upgradeBun },
      { name: "yarn", fn: upgradeYarn },
      { name: "pnpm", fn: upgradePnpm },
    ];

    let results: UpgradeResult[] = [];

    if (args.interactive) {
      // Check all tools first to see what's available
      // relinka("info", "Scanning available tools...");
      const preliminaryResults = await Promise.all(
        toolUpgradeFunctions.map(async ({ fn }) => await fn()),
      );

      // Filter out tools that are not found
      const availableTools = toolUpgradeFunctions
        .map((tool, index) => ({
          ...tool,
          result: preliminaryResults[index],
        }))
        .filter(({ result }) => result && result.status !== "not-found");

      if (availableTools.length === 0) {
        relinka("warn", "No tools available for upgrade");
        return;
      }

      // Show interactive selection
      const selectedTools = await multiselectPrompt({
        title: "Select tools to upgrade",
        displayInstructions: true,
        options: [
          { label: "Exit", value: "exit" },
          ...availableTools.map(({ name, result }) => {
            const isUpToDate = result && result.status === "up-to-date";
            const hasErrors = result && result.status === "error";
            const canUpgrade = result && result.status === "upgraded";

            let label = name;
            if (isUpToDate) {
              label += " (up-to-date)";
            } else if (hasErrors) {
              label += " (has errors)";
            } else if (canUpgrade) {
              label += " (can be upgraded)";
            }

            return {
              label: isUpToDate || hasErrors ? re.gray(label) : label,
              value: name,
              disabled: isUpToDate || hasErrors,
              hint: hasErrors ? result.message : undefined,
            };
          }),
        ],
      });

      if (selectedTools.length === 0 || selectedTools.includes("exit")) {
        relinka("info", "Exiting upgrade process");
        return;
      }

      // Filter out "exit" from selected tools
      const actualSelectedTools = selectedTools.filter((tool) => tool !== "exit");

      // Execute upgrades for selected tools
      relinka("info", `Upgrading ${actualSelectedTools.length} selected tools...`);

      for (const toolName of actualSelectedTools) {
        const tool = availableTools.find((t) => t.name === toolName);
        if (tool) {
          const result = await tool.fn();
          results.push(result);
        }
      }
    } else {
      // Non-interactive mode - upgrade all tools
      results = await Promise.all(toolUpgradeFunctions.map(async ({ fn }) => await fn()));
    }

    // Report results
    const upgraded = results.filter((r) => r.status === "upgraded");
    const upToDate = results.filter((r) => r.status === "up-to-date");
    const notFound = results.filter((r) => r.status === "not-found");
    const errors = results.filter((r) => r.status === "error");

    if (upgraded.length > 0) {
      relinka("success", `Upgraded ${upgraded.length} tools:`);
      upgraded.forEach((r) =>
        relinka("verbose", `  ✓ ${r.tool}${r.message ? ` - ${r.message}` : ""}`),
      );
    }

    if (upToDate.length > 0) {
      relinka("info", `${upToDate.length} tools already up-to-date:`);
      upToDate.forEach((r) =>
        relinka("verbose", `  • ${r.tool}${r.message ? ` - ${r.message}` : ""}`),
      );
    }

    if (notFound.length > 0) {
      relinka("warn", `${notFound.length} tools not installed (skipped):`);
      notFound.forEach((r) => relinka("verbose", `  - ${r.tool}`));
    }

    if (errors.length > 0) {
      relinka("error", `${errors.length} tools had errors:`);
      errors.forEach((r) =>
        relinka("verbose", `  ✗ ${r.tool}${r.message ? ` - ${r.message}` : ""}`),
      );
    }

    relinka("success", "Upgrade check completed!");
  },
});

async function upgradeDlerLocal(): Promise<UpgradeResult> {
  try {
    const pkg = await readPackageJSON();
    const hasDler =
      (pkg.dependencies && "@reliverse/dler" in pkg.dependencies) ||
      (pkg.devDependencies && "@reliverse/dler" in pkg.devDependencies);

    if (!hasDler) {
      return { tool: "dler (local)", status: "not-found" };
    }

    const packageManager = await detectPackageManager(process.cwd());
    if (!packageManager) {
      return { tool: "dler (local)", status: "error", message: "No package manager detected" };
    }

    // Use detected package manager to upgrade
    const { exitCode } = await x(packageManager.command, ["update", "@reliverse/dler"], {
      nodeOptions: { stdio: "pipe" },
    });

    return exitCode === 0
      ? { tool: "dler (local)", status: "upgraded", message: `via ${packageManager.command}` }
      : { tool: "dler (local)", status: "error", message: "Upgrade failed" };
  } catch (error) {
    return {
      tool: "dler (local)",
      status: "not-found",
    };
  }
}

async function upgradeDlerGlobal(): Promise<UpgradeResult> {
  try {
    const dlerPath = await lookpath("dler");
    if (!dlerPath) {
      return { tool: "dler (global)", status: "not-found" };
    }

    // Try to upgrade with different package managers
    const packageManagers = ["bun", "npm", "yarn", "pnpm"];

    for (const pm of packageManagers) {
      const pmPath = await lookpath(pm);
      if (pmPath) {
        try {
          const args =
            pm === "npm"
              ? ["install", "-g", "@reliverse/dler@latest"]
              : pm === "yarn"
                ? ["global", "add", "@reliverse/dler@latest"]
                : ["install", "-g", "@reliverse/dler@latest"];

          const { exitCode } = await x(pm, args, {
            nodeOptions: { stdio: "pipe" },
          });

          if (exitCode === 0) {
            return { tool: "dler (global)", status: "upgraded", message: `via ${pm}` };
          }
        } catch {
          /* empty */
        }
      }
    }

    return { tool: "dler (global)", status: "error", message: "No suitable package manager found" };
  } catch (error) {
    return { tool: "dler (global)", status: "error", message: String(error) };
  }
}

async function upgradeGit(): Promise<UpgradeResult> {
  try {
    const gitPath = await lookpath("git");
    if (!gitPath) {
      return { tool: "git", status: "not-found" };
    }

    // Git doesn't have a built-in upgrade command, suggest manual upgrade
    const { stdout } = await x("git", ["--version"], {
      nodeOptions: { stdio: "pipe" },
    });

    return {
      tool: "git",
      status: "up-to-date",
      message: `${stdout.trim()} - manual upgrade required`,
    };
  } catch (error) {
    return { tool: "git", status: "error", message: String(error) };
  }
}

async function upgradeNode(): Promise<UpgradeResult> {
  try {
    const nodePath = await lookpath("node");
    if (!nodePath) {
      return { tool: "node.js", status: "not-found" };
    }

    const { stdout } = await x("node", ["--version"], {
      nodeOptions: { stdio: "pipe" },
    });

    // Node.js doesn't have self-upgrade, suggest manual upgrade
    return {
      tool: "node.js",
      status: "up-to-date",
      message: `${stdout.trim()} - manual upgrade required`,
    };
  } catch (error) {
    return { tool: "node.js", status: "error", message: String(error) };
  }
}

async function upgradeNpm(): Promise<UpgradeResult> {
  try {
    const npmPath = await lookpath("npm");
    if (!npmPath) {
      return { tool: "npm", status: "not-found" };
    }

    // Try without stdio pipe first, then with inherit as fallback
    try {
      const { exitCode, stdout, stderr } = await x("npm", ["install", "-g", "npm@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      if (exitCode === 0) {
        // Check if output indicates it was already up-to-date
        const output = (stdout + stderr).toLowerCase();
        if (
          output.includes("unchanged") ||
          output.includes("up-to-date") ||
          output.includes("already")
        ) {
          return { tool: "npm", status: "up-to-date" };
        }
        return { tool: "npm", status: "upgraded" };
      } else {
        return { tool: "npm", status: "error", message: "Upgrade failed" };
      }
    } catch (pipeError) {
      // Fallback to inherit stdio if pipe fails
      const { exitCode } = await x("npm", ["install", "-g", "npm@latest"], {
        nodeOptions: { stdio: "inherit" },
      });

      return exitCode === 0
        ? { tool: "npm", status: "upgraded" }
        : { tool: "npm", status: "error", message: "Upgrade failed" };
    }
  } catch (error) {
    return { tool: "npm", status: "error", message: String(error) };
  }
}

async function upgradeBun(): Promise<UpgradeResult> {
  try {
    const bunPath = await lookpath("bun");
    if (!bunPath) {
      return { tool: "bun", status: "not-found" };
    }

    const { exitCode, stdout, stderr } = await x("bun", ["upgrade"], {
      nodeOptions: { stdio: "pipe" },
    });

    if (exitCode !== 0) {
      return { tool: "bun", status: "error", message: "Upgrade failed" };
    }

    const output = (stdout + stderr).toLowerCase();

    // Check if bun was already up-to-date
    if (output.includes("already") || output.includes("up-to-date") || output.includes("latest")) {
      return { tool: "bun", status: "up-to-date" };
    }

    // If upgrade command succeeded and didn't say it was up-to-date, assume it upgraded
    return { tool: "bun", status: "upgraded" };
  } catch (error) {
    return { tool: "bun", status: "error", message: String(error) };
  }
}

async function upgradeYarn(): Promise<UpgradeResult> {
  try {
    const yarnPath = await lookpath("yarn");
    if (!yarnPath) {
      return { tool: "yarn", status: "not-found" };
    }

    // Try yarn self-upgrade first (works for Yarn 1.x)
    try {
      const { exitCode: upgradeResult } = await x("yarn", ["self-update"], {
        nodeOptions: { stdio: "pipe" },
      });

      if (upgradeResult === 0) {
        return { tool: "yarn", status: "upgraded", message: "self-update" };
      }
    } catch {
      // Fall back to npm upgrade for Yarn 2+
    }

    // Fallback: upgrade via npm
    const npmPath = await lookpath("npm");
    if (npmPath) {
      const { exitCode } = await x("npm", ["install", "-g", "yarn@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      return exitCode === 0
        ? { tool: "yarn", status: "upgraded", message: "via npm" }
        : { tool: "yarn", status: "error", message: "Upgrade failed" };
    }

    return { tool: "yarn", status: "error", message: "No upgrade method available" };
  } catch (error) {
    return { tool: "yarn", status: "error", message: String(error) };
  }
}

async function upgradePnpm(): Promise<UpgradeResult> {
  try {
    const pnpmPath = await lookpath("pnpm");
    if (!pnpmPath) {
      return { tool: "pnpm", status: "not-found" };
    }

    // Try pnpm self-upgrade
    try {
      const { exitCode } = await x("pnpm", ["add", "-g", "pnpm@latest"], {
        nodeOptions: { stdio: "pipe" },
      });

      return exitCode === 0
        ? { tool: "pnpm", status: "upgraded" }
        : { tool: "pnpm", status: "error", message: "Upgrade failed" };
    } catch {
      // Fallback to npm
      const npmPath = await lookpath("npm");
      if (npmPath) {
        const { exitCode } = await x("npm", ["install", "-g", "pnpm@latest"], {
          nodeOptions: { stdio: "pipe" },
        });

        return exitCode === 0
          ? { tool: "pnpm", status: "upgraded", message: "via npm" }
          : { tool: "pnpm", status: "error", message: "Upgrade failed" };
      }

      return { tool: "pnpm", status: "error", message: "No upgrade method available" };
    }
  } catch (error) {
    return { tool: "pnpm", status: "error", message: String(error) };
  }
}
