import {
	commonEndActions,
	commonStartActions,
	createPerfTimer,
	detectWorkspaces,
	dlerPub,
	getConfigDler,
	getCurrentWorkingDirectory,
	promptWorkspacePackages,
	showPackageSummary,
} from "@reliverse/dler";
import { defineArgs, defineCommand } from "@reliverse/rempts";

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

		// Check for workspace packages if enabled
		let workspacePackages = null;
		if (config.monorepoWorkspaces?.enabled && !isCI) {
			workspacePackages = await detectWorkspaces(cwdStr);

			if (workspacePackages && workspacePackages.length > 0) {
				// Filter packages based on config patterns
				const filteredPackages =
					config.monorepoWorkspaces?.includePatterns.length > 0 ||
					config.monorepoWorkspaces?.excludePatterns.length > 0
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

				if (filteredPackages.length > 0) {
					const skipPrompt = Boolean(all) || isCI;
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
		});

		await commonEndActions({ withEndPrompt: true });
	},
});
