import { join } from "@reliverse/pathkit";
import { existsSync, mkdir } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  buildForTarget,
  cleanOutputDir,
  getOutputFileName,
  listAvailableTargets,
  parseTargets,
  validateInputFile,
} from "~/impl/build/providers/bun/single-file";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { PerfTimer } from "~/impl/types/mod";

// Helper function to extract prefix from input filename
function getTargetPrefix(inputFile: string): string {
  // Extract filename without path and extension
  const filename = inputFile.split("/").pop()?.split("\\").pop() || "";
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt;
}

// Helper function to generate default targets based on input filename
function generateDefaultTargets(prefix: string): string {
  const platforms = ["linux", "windows", "darwin"];
  const architectures = ["x64", "arm64"];

  const targets = platforms.flatMap((platform) =>
    architectures.map((arch) => `${prefix}-${platform}-${arch}`),
  );

  return targets.join(",");
}

/**
 * Builds binary executables for the project based on configuration.
 */
export async function binary_buildFlow(
  _timer: PerfTimer,
  _isDev: boolean,
  config: ReliverseConfig,
): Promise<void> {
  relinka("verbose", "— — — binary_buildFlow — — —");

  if (!config.binaryBuildEnabled) {
    relinka("verbose", "Binary build is disabled, skipping...");
    return;
  }

  try {
    // Determine input file
    let inputFile = config.binaryBuildInputFile;
    if (!inputFile) {
      inputFile = join(config.coreEntrySrcDir, config.coreEntryFile);
    }

    // Handle special cases
    if (config.binaryBuildTargets === "list") {
      listAvailableTargets();
      return;
    }

    // Validate input
    validateInputFile(inputFile);

    // Parse targets
    let targetsArg = config.binaryBuildTargets;

    // If targets is "all" or not specified, generate default targets based on input filename
    if (targetsArg === "all" || !targetsArg) {
      const prefix = getTargetPrefix(inputFile);
      targetsArg = generateDefaultTargets(prefix);
      relinka("info", `Generated targets for '${prefix}': ${targetsArg}`);
    }

    const targets = parseTargets(targetsArg);

    if (targets.length === 0) {
      relinka("error", "No valid targets specified");
      return;
    }

    // Build options
    const options = {
      minify: config.binaryBuildMinify,
      sourcemap: config.binaryBuildSourcemap,
      bytecode: config.binaryBuildBytecode,
      outdir: config.binaryBuildOutDir,
      clean: config.binaryBuildClean,
      windowsIcon: config.binaryBuildWindowsIcon,
      windowsHideConsole: config.binaryBuildWindowsHideConsole,
      assetNaming: config.binaryBuildAssetNaming,
      external: config.binaryBuildExternal,
      compile: !config.binaryBuildNoCompile,
    };

    // Clean output directory
    if (options.clean) {
      await cleanOutputDir(options.outdir);
    } else if (!existsSync(options.outdir)) {
      await mkdir(options.outdir, { recursive: true });
    }

    const buildType = options.compile ? "executable(s)" : "bundled script(s)";
    relinka("info", `Building ${targets.length} ${buildType} from ${inputFile}`);

    if (!options.compile) {
      relinka("info", "Running in script bundle mode (binaryBuildNoCompile: true)");
    }

    if (options.external && options.external.length > 0) {
      relinka(
        "info",
        `External dependencies (excluded from bundle): ${options.external.join(", ")}`,
      );
    }

    if (options.bytecode && options.compile) {
      relinka("warn", "Bytecode compilation is experimental (Bun v1.1.30+)");
    } else if (options.bytecode && !options.compile) {
      relinka("warn", "Bytecode compilation is only available with compile enabled");
    }

    // Build targets
    if (config.binaryBuildParallel && targets.length > 1) {
      relinka("info", "Building targets in parallel...");
      const buildPromises = targets.map((target) => buildForTarget(target, inputFile, options));

      const results = await Promise.allSettled(buildPromises);

      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failureCount++;
          relinka("error", `Build failed: ${result.reason}`);
        }
      }

      relinka("info", `Build completed: ${successCount} succeeded, ${failureCount} failed`);

      if (failureCount > 0) {
        if (successCount === 0) {
          relinka("error", `❌ All builds failed! No executables were generated.`);
        } else {
          relinka(
            "warn",
            `⚠️  Build completed with ${failureCount} failure(s). ${successCount} executable(s) available in: ${options.outdir}`,
          );
        }
      } else {
        relinka("success", `🎉 Build completed! All executables available in: ${options.outdir}`);
      }
    } else {
      relinka("info", "Building targets sequentially...");
      let sequentialSuccessCount = 0;
      let sequentialFailureCount = 0;

      for (const target of targets) {
        try {
          await buildForTarget(target, inputFile, options);
          sequentialSuccessCount++;
        } catch (error) {
          sequentialFailureCount++;
        }
      }

      if (sequentialFailureCount > 0) {
        if (sequentialSuccessCount === 0) {
          relinka("error", `❌ All builds failed! No executables were generated.`);
        } else {
          relinka(
            "warn",
            `⚠️  Build completed with ${sequentialFailureCount} failure(s). ${sequentialSuccessCount} executable(s) available in: ${options.outdir}`,
          );
        }
      } else {
        relinka("success", `🎉 Build completed! All executables available in: ${options.outdir}`);
      }
    }

    // Show file sizes
    if (existsSync(options.outdir)) {
      const fileType = options.compile ? "executables" : "bundled scripts";
      relinka("info", `Generated ${fileType}:`);
      for (const target of targets) {
        const filePath = join(options.outdir, getOutputFileName(target, "dler", options.compile));
        if (existsSync(filePath)) {
          const stat = await Bun.file(filePath).size;
          const sizeMB = (stat / (1024 * 1024)).toFixed(2);
          relinka("info", `  ${getOutputFileName(target, "dler", options.compile)} (${sizeMB} MB)`);
        }
      }
    }
  } catch (error) {
    relinka("error", `Binary build failed: ${error}`);
    throw error;
  }
}
