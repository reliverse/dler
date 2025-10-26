// apps/dler/src/cmds/integrate/impl.ts

import { logger } from "@reliverse/dler-logger";
import {
  getIntegration,
  validateIntegrationNames,
} from "./integrations/registry";
import type { IntegrationContext } from "./types";
import { detectProjectContext, selectTargetPackage } from "./utils/context";
import { createTempDirectory } from "./utils/temp";

export interface IntegrateOptions {
  x: string;
  target?: string;
  verbose: boolean;
  cwd?: string;
}

export const runIntegrate = async (
  options: IntegrateOptions,
): Promise<void> => {
  try {
    // Check if running in Bun
    if (typeof process.versions.bun === "undefined") {
      logger.error("❌ This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    // Parse integration names
    const integrationNames = options.x
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (integrationNames.length === 0) {
      logger.error(
        "❌ No integrations specified. Use --x to specify integrations (e.g., --x nextjs,ultracite)",
      );
      process.exit(1);
    }

    // Validate integration names
    const { valid, invalid } = validateIntegrationNames(integrationNames);

    if (invalid.length > 0) {
      logger.error(`❌ Invalid integrations: ${invalid.join(", ")}`);
      logger.info(`Available integrations: ${valid.join(", ")}`);
      process.exit(1);
    }

    // Detect project context
    logger.info("🔍 Detecting project context...");
    const projectContext = await detectProjectContext(options.cwd);

    // Resolve target directory
    let targetPath = projectContext.targetPath;
    let selectedPackage = projectContext.selectedPackage;

    if (projectContext.type === "monorepo") {
      if (options.target) {
        // Find specified target package
        const targetPkg = projectContext.packages?.find(
          (pkg) =>
            pkg.name === options.target || pkg.name.endsWith(options.target!),
        );

        if (!targetPkg) {
          logger.error(`❌ Target package '${options.target}' not found`);
          logger.info(
            `Available packages: ${projectContext.packages?.map((p) => p.name).join(", ")}`,
          );
          process.exit(1);
        }

        selectedPackage = targetPkg;
        targetPath = targetPkg.path;
      } else {
        // Prompt user to select target package
        if (projectContext.packages && projectContext.packages.length > 1) {
          selectedPackage = await selectTargetPackage(projectContext.packages);
          targetPath = selectedPackage.path;
        } else if (
          projectContext.packages &&
          projectContext.packages.length === 1
        ) {
          selectedPackage = projectContext.packages[0];
          targetPath = selectedPackage!.path;
        }
      }

      logger.info(`📦 Target package: ${selectedPackage?.name ?? "root"}`);
    }

    // Create temp directory for integrations that need it
    const tempDir = await createTempDirectory();

    // Create integration context
    const integrationContext: IntegrationContext = {
      targetPath,
      isMonorepo: projectContext.type === "monorepo",
      monorepoRoot:
        projectContext.type === "monorepo"
          ? projectContext.rootPath
          : undefined,
      packageName: selectedPackage?.name,
      verbose: options.verbose,
      tempDir,
    };

    // Run integrations
    const results = await runIntegrations(integrationNames, integrationContext);

    // Install dependencies
    logger.info("📦 Installing dependencies...");
    await Bun.$`bun install`.cwd(targetPath).quiet();

    // Clean up temp directory
    await tempDir.cleanup();

    // Report results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      logger.success(
        `\n✅ Successfully integrated: ${successful.map((r) => r.name).join(", ")}`,
      );
    }

    if (failed.length > 0) {
      logger.error(
        `\n❌ Failed integrations: ${failed.map((r) => r.name).join(", ")}`,
      );
      process.exit(1);
    }

    logger.success("\n🎉 All integrations completed successfully!");
  } catch (error) {
    logger.error("\n❌ Integration failed:");

    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }

    process.exit(1);
  }
};

interface IntegrationResult {
  name: string;
  success: boolean;
  error?: string;
}

const runIntegrations = async (
  integrationNames: string[],
  context: IntegrationContext,
): Promise<IntegrationResult[]> => {
  const results: IntegrationResult[] = [];

  for (const name of integrationNames) {
    logger.info(`\n🔧 Processing ${name} integration...`);

    try {
      const integration = getIntegration(name);
      if (!integration) {
        results.push({ name, success: false, error: "Integration not found" });
        continue;
      }

      // Validate integration
      const isValid = await integration.validate(context);
      if (!isValid) {
        results.push({
          name,
          success: true,
          error: "Already installed, skipped",
        });
        continue;
      }

      // Install integration
      await integration.install(context);

      // Configure integration
      await integration.configure(context);

      // Run post-install hooks
      await integration.postInstall(context);

      results.push({ name, success: true });
      logger.success(`✅ ${name} integration completed`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`❌ ${name} integration failed: ${errorMessage}`);
      results.push({ name, success: false, error: errorMessage });
    }
  }

  return results;
};
