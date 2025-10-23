import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import {
  commonEndActions,
  commonStartActions,
  createPerfTimer,
  detectWorkspaces,
  dlerPub,
  filterPackagesByFilters,
  getConfigDler,
  getCurrentWorkingDirectory,
  parseFilterArgs,
  promptWorkspacePackages,
  showPackageSummary,
} from "../../../mod";

export default defineCommand({
  meta: {
    name: "publish",
    description: "Publish the project",
  },
  args: defineArgs({
    // Common args
    ci: {
      type: "boolean",
      description: "Run in CI mode",
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    cwd: {
      type: "string",
      description: "Current working directory",
      default: getCurrentWorkingDirectory(),
    },
    dev: {
      type: "boolean",
      description: "Run in dev mode",
    },
    // Command specific args
    "no-spinner": {
      type: "boolean",
      description: "Disable progress spinners and show detailed publish logs",
    },
    "force-spinner": {
      type: "boolean",
      description: "Force enable spinners even in CI/non-TTY environments",
    },
    all: {
      type: "boolean",
      description:
        "Publish all workspace packages without prompting for selection",
      default: true,
    },
    // Monorepo-specific flags
    cache: {
      type: "boolean",
      description:
        "Enable smart caching for monorepo packages (skip unchanged packages)",
    },
    graph: {
      type: "boolean",
      description: "Show dependency graph before publishing",
    },
    "clean-cache": {
      type: "boolean",
      description: "Clean the build cache before publishing",
    },
    // Filter args
    filter: {
      type: "array",
      description:
        "Filter packages by name (supports glob patterns, e.g., '@reliverse/*', 'my-package')",
    },
  }),
  run: async ({ args }) => {
    const {
      ci,
      cwd,
      dev,
      "no-spinner": noSpinner,
      "force-spinner": forceSpinner,
      all,
      cache,
      graph,
      "clean-cache": cleanCache,
      filter,
    } = args;
    const isCI = Boolean(ci);
    const isDev = Boolean(dev);
    const cwdStr = String(cwd);
    await commonStartActions({
      isCI,
      isDev,
      cwdStr,
      showRuntimeInfo: false,
      clearConsole: false,
      withStartPrompt: true,
    });
    const timer = createPerfTimer();
    const config = await getConfigDler();

    // Parse filter arguments
    const filterArgs = parseFilterArgs(filter);
    const hasFilters = filterArgs.length > 0;

    // Check for workspace packages if enabled or if filters are provided
    let workspacePackages = null;
    if ((config.monorepoWorkspaces?.enabled && !isCI) || hasFilters) {
      workspacePackages = await detectWorkspaces(cwdStr);

      if (workspacePackages && workspacePackages.length > 0) {
        let filteredPackages = workspacePackages;

        // Apply CLI filters if provided
        if (hasFilters) {
          filteredPackages = filterPackagesByFilters(
            workspacePackages,
            filterArgs,
          );
          if (filteredPackages.length === 0) {
            relinka(
              "info",
              "No packages matched the provided filters. Exiting.",
            );
            await commonEndActions({ withEndPrompt: true });
            return;
          }
        } else {
          // Apply config patterns if no CLI filters
          filteredPackages =
            (config.monorepoWorkspaces?.includePatterns?.length ?? 0) > 0 ||
            (config.monorepoWorkspaces?.excludePatterns?.length ?? 0) > 0
              ? workspacePackages.filter((pkg) => {
                  const includeMatch =
                    config.monorepoWorkspaces?.includePatterns.length === 0 ||
                    config.monorepoWorkspaces?.includePatterns.some(
                      (pattern: string) => {
                        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
                        return regex.test(pkg.name) || regex.test(pkg.path);
                      },
                    );

                  const excludeMatch =
                    config.monorepoWorkspaces?.excludePatterns.some(
                      (pattern: string) => {
                        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
                        return regex.test(pkg.name) || regex.test(pkg.path);
                      },
                    );

                  return includeMatch && !excludeMatch;
                })
              : workspacePackages;
        }

        if (filteredPackages.length > 0) {
          // Skip prompts when filters are provided or when all flag is set
          const skipPrompt = Boolean(all) || isCI || hasFilters;
          const selectedPackages = await promptWorkspacePackages(
            filteredPackages,
            "publish",
            skipPrompt,
          );
          if (selectedPackages.length > 0) {
            workspacePackages = selectedPackages;
            showPackageSummary(workspacePackages, "publish");
          } else {
            workspacePackages = null;
          }
        } else {
          workspacePackages = null;
        }
      }
    }

    // CLI-specific spinner overrides
    if (noSpinner) {
      config.commonDisableSpinner = true; // Force detailed logs
    }
    if (forceSpinner) {
      config.commonDisableSpinner = false; // Force spinners
    }

    await dlerPub(timer, isDev, config, workspacePackages, {
      enableCache: Boolean(cache),
      showGraph: Boolean(graph),
      cleanCacheFlag: Boolean(cleanCache),
      cwd: cwdStr,
    });

    await commonEndActions({ withEndPrompt: true });
  },
});
