import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import {
  commonEndActions,
  commonStartActions,
  createPerfTimer,
  detectWorkspaces,
  dlerBuild,
  filterPackagesByFilters,
  finalizeBuild,
  getConfigDler,
  getCurrentWorkingDirectory,
  parseFilterArgs,
  promptWorkspacePackages,
  showPackageSummary,
} from "../../../cli";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build the project",
  },
  args: defineArgs({
    // Common args
    ci: {
      type: "boolean",
      description: "Run in CI mode",
      default: !process.stdout.isTTY || !!process.env["CI"],
    },
    dev: {
      type: "boolean",
      description: "Run in dev mode",
    },
    cwd: {
      type: "string",
      description: "Current working directory",
      default: getCurrentWorkingDirectory(),
    },
    // Command specific args
    debugOnlyCopyNonBuildFiles: {
      type: "boolean",
      description: "Only copy non-build files to dist directories",
    },
    debugDontCopyNonBuildFiles: {
      type: "boolean",
      description:
        "Don't copy non-build files to dist directories, only build buildPreExtensions files",
    },
    "binary-enabled": {
      type: "boolean",
      description:
        "Enable binary build functionality to create standalone executables",
    },
    "binary-input": {
      type: "string",
      description:
        "Input TypeScript file to bundle for binary builds (overrides config)",
    },
    "binary-targets": {
      type: "string",
      description:
        "Comma-separated list of targets to build for (use 'all' for all targets, 'list' to show available targets)",
    },
    "binary-outdir": {
      type: "string",
      description:
        "Output directory for built binary executables (overrides config)",
    },
    "binary-minify": {
      type: "boolean",
      description: "Minify the binary output (overrides config)",
    },
    "binary-sourcemap": {
      type: "boolean",
      description: "Generate source maps for binary builds (overrides config)",
    },
    "binary-bytecode": {
      type: "boolean",
      description:
        "Enable bytecode compilation for faster startup (Bun v1.1.30+) (overrides config)",
    },
    "binary-clean": {
      type: "boolean",
      description:
        "Clean output directory before building binaries (overrides config)",
    },
    "binary-windows-icon": {
      type: "string",
      description:
        "Path to Windows .ico file for executable icon (overrides config)",
    },
    "binary-windows-hide-console": {
      type: "boolean",
      description: "Hide console window on Windows (overrides config)",
    },
    "binary-asset-naming": {
      type: "string",
      description: "Asset naming pattern for binary builds (overrides config)",
    },
    "binary-parallel": {
      type: "boolean",
      description: "Build binary targets in parallel (overrides config)",
    },
    "binary-external": {
      type: "array",
      description:
        "External dependencies to exclude from binary bundle (overrides config)",
    },
    "binary-no-compile": {
      type: "boolean",
      description:
        "Create a bundled script instead of standalone executable (overrides config)",
    },
    // Command specific args
    "no-spinner": {
      type: "boolean",
      description: "Disable progress spinners and show detailed build logs",
    },
    "force-spinner": {
      type: "boolean",
      description: "Force enable spinners even in CI/non-TTY environments",
    },
    all: {
      type: "boolean",
      description:
        "Build all workspace packages without prompting for selection",
      default: true,
    },
    // Monorepo-specific flags
    cache: {
      type: "boolean",
      description:
        "Enable smart caching for monorepo packages (skip unchanged packages)",
    },
    "deps-only": {
      type: "boolean",
      description:
        "Build only dependencies of current package (not the package itself)",
    },
    graph: {
      type: "boolean",
      description: "Show dependency graph before building",
    },
    "clean-cache": {
      type: "boolean",
      description: "Clean the build cache before building",
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
      debugOnlyCopyNonBuildFiles,
      debugDontCopyNonBuildFiles,
      "binary-enabled": binaryEnabled,
      "binary-input": binaryInput,
      "binary-targets": binaryTargets,
      "binary-outdir": binaryOutdir,
      "binary-minify": binaryMinify,
      "binary-sourcemap": binarySourcemap,
      "binary-bytecode": binaryBytecode,
      "binary-clean": binaryClean,
      "binary-windows-icon": binaryWindowsIcon,
      "binary-windows-hide-console": binaryWindowsHideConsole,
      "binary-asset-naming": binaryAssetNaming,
      "binary-parallel": binaryParallel,
      "binary-external": binaryExternal,
      "binary-no-compile": binaryNoCompile,
      "no-spinner": noSpinner,
      "force-spinner": forceSpinner,
      all,
      cache,
      "deps-only": depsOnly,
      graph,
      "clean-cache": cleanCache,
      filter,
    } = args;

    const isCI = Boolean(ci);
    const isDev = Boolean(dev);
    const cwdStr = String(cwd);
    const isDebugOnlyCopyNonBuildFiles = Boolean(debugOnlyCopyNonBuildFiles);
    const isDebugDontCopyNonBuildFiles = Boolean(debugDontCopyNonBuildFiles);

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
      relinka(
        "verbose",
        `Detected ${workspacePackages?.length || 0} workspace packages`,
      );

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
            "build",
            skipPrompt,
          );
          if (selectedPackages.length > 0) {
            workspacePackages = selectedPackages;
            showPackageSummary(workspacePackages, "build");
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

    // Override binary build config with command line args if provided
    // @see https://bun.com/docs/bundler/executables
    if (binaryEnabled !== undefined) {
      config.binaryBuildEnabled = Boolean(binaryEnabled);
    }
    if (binaryInput !== undefined) {
      config.binaryBuildInputFile = String(binaryInput);
    }
    if (binaryTargets !== undefined) {
      config.binaryBuildTargets = String(binaryTargets);
    }
    if (binaryOutdir !== undefined) {
      config.binaryBuildOutDir = String(binaryOutdir);
    }
    if (binaryMinify !== undefined) {
      config.binaryBuildMinify = Boolean(binaryMinify);
    }
    if (binarySourcemap !== undefined) {
      config.binaryBuildSourcemap = Boolean(binarySourcemap);
    }
    if (binaryBytecode !== undefined) {
      config.binaryBuildBytecode = Boolean(binaryBytecode);
    }
    if (binaryClean !== undefined) {
      config.binaryBuildClean = Boolean(binaryClean);
    }
    if (binaryWindowsIcon !== undefined) {
      config.binaryBuildWindowsIcon = String(binaryWindowsIcon);
    }
    if (binaryWindowsHideConsole !== undefined) {
      config.binaryBuildWindowsHideConsole = Boolean(binaryWindowsHideConsole);
    }
    if (binaryAssetNaming !== undefined) {
      config.binaryBuildAssetNaming = String(binaryAssetNaming);
    }
    if (binaryParallel !== undefined) {
      config.binaryBuildParallel = Boolean(binaryParallel);
    }
    if (binaryExternal !== undefined) {
      config.binaryBuildExternal = binaryExternal as string[];
    }
    if (binaryNoCompile !== undefined) {
      config.binaryBuildNoCompile = Boolean(binaryNoCompile);
    }

    relinka(
      "verbose",
      `Passing ${workspacePackages?.length || 0} workspace packages to dlerBuild`,
    );
    await dlerBuild({
      flow: "build",
      timer,
      isDev,
      config,
      debugOnlyCopyNonBuildFiles: isDebugOnlyCopyNonBuildFiles,
      debugDontCopyNonBuildFiles: isDebugDontCopyNonBuildFiles,
      workspacePackages,
      enableCache: Boolean(cache),
      depsOnly: Boolean(depsOnly),
      showGraph: Boolean(graph),
      cleanCacheFlag: Boolean(cleanCache),
      cwd: cwdStr,
    });
    const shouldShowSpinner =
      config.commonDisableSpinner === false && !noSpinner;
    await finalizeBuild(shouldShowSpinner, timer, false, "build");

    await commonEndActions({ withEndPrompt: true });
  },
});
