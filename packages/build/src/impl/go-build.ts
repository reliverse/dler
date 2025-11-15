// packages/build/src/impl/go-build.ts

import { existsSync } from "node:fs";
import { mkdir, readdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GoBuildOptions } from "@reliverse/dler-config/impl/build";
import { logger } from "@reliverse/dler-logger";
import { lookpath } from "lookpath";

// Target platforms: [GOOS, GOARCH, outputSuffix, platformName]
// platformName is what Node.js process.platform returns
const DEFAULT_TARGETS = [
  ["windows", "amd64", "dll", "win32"],
  ["linux", "amd64", "so", "linux"],
  ["linux", "arm64", "so", "linux"],
  ["darwin", "amd64", "dylib", "darwin"],
  ["darwin", "arm64", "dylib", "darwin"],
] as const;

interface GoBuildResult {
  success: boolean;
  errors: string[];
}

interface DockerCheckResult {
  available: boolean;
  reason?: string;
}

/**
 * Check if Docker is installed and running
 */
async function checkDockerAvailable(): Promise<DockerCheckResult> {
  // Check if docker command exists
  const dockerPath = await lookpath("docker");
  if (!dockerPath) {
    return {
      available: false,
      reason: "Docker is not installed or not in PATH",
    };
  }

  // Check if Docker daemon is running by trying to run docker version
  try {
    const proc = Bun.spawnSync(["docker", "version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if (proc.exitCode !== 0) {
      const stderr = proc.stderr?.toString() || "";
      // Check for common Docker daemon not running errors
      if (
        stderr.includes("Cannot connect to the Docker daemon") ||
        stderr.includes("Is the docker daemon running") ||
        stderr.includes("dockerDesktopLinuxEngine") ||
        stderr.includes("The system cannot find the file specified")
      ) {
        return {
          available: false,
          reason: "Docker daemon is not running",
        };
      }
      return {
        available: false,
        reason: `Docker check failed: ${stderr.trim()}`,
      };
    }

    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: `Error checking Docker: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Find all Go files in a directory (recursively)
 */
async function findGoFiles(
  dir: string,
  goFiles: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, release, dist, and .git directories
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "release" ||
          entry.name === "dist" ||
          entry.name === ".git"
        ) {
          continue;
        }
        await findGoFiles(fullPath, goFiles);
      } else if (entry.isFile() && entry.name.endsWith(".go")) {
        goFiles.push(fullPath);
      }
    }
  } catch {
    // Ignore errors (e.g., permission denied)
  }
  return goFiles;
}

/**
 * Map xgo target format to expected binary filename
 */
function getExpectedBinaryName(target: string, outputName: string): string {
  const [goos, goarch] = target.split("/");
  let platformName = goos;
  let suffix = "";

  if (goos === "windows") {
    platformName = "win32";
    suffix = ".dll";
  } else if (goos === "linux") {
    platformName = "linux";
    suffix = ".so";
  } else if (goos === "darwin") {
    platformName = "darwin";
    suffix = ".dylib";
  }

  return `${outputName}-${platformName}-${goarch}${suffix}`;
}

/**
 * Check if Go binaries need to be rebuilt
 */
async function shouldRebuildGo(
  packagePath: string,
  targets: string[],
  outputDir: string,
  outputName: string,
): Promise<{ rebuild: boolean; reason: string }> {
  const releasePath = path.join(packagePath, outputDir);

  // Check if release directory exists
  if (!existsSync(releasePath)) {
    return { rebuild: true, reason: "Release directory does not exist" };
  }

  try {
    // Find all Go files to get their modification times
    const goFiles = await findGoFiles(packagePath);
    goFiles.push(path.join(packagePath, "go.mod"));
    const goSumPath = path.join(packagePath, "go.sum");
    if (existsSync(goSumPath)) {
      goFiles.push(goSumPath);
    }

    // Get the newest Go file modification time
    let newestGoFileTime = 0;
    for (const goFile of goFiles) {
      if (existsSync(goFile)) {
        const stats = await stat(goFile);
        if (stats.mtimeMs > newestGoFileTime) {
          newestGoFileTime = stats.mtimeMs;
        }
      }
    }

    // Check each target platform
    const missingBinaries: string[] = [];
    const outdatedBinaries: string[] = [];

    for (const target of targets) {
      const expectedBinary = getExpectedBinaryName(target, outputName);
      let binaryPath = path.join(releasePath, expectedBinary);

      // For Windows, also check for windows variant (before rename)
      // xgo outputs: {name}-windows-amd64.dll
      // We expect: {name}-win32-amd64.dll
      if (target.startsWith("windows/") && !existsSync(binaryPath)) {
        // Check for windows-amd64 (xgo output format)
        const windowsBinary = expectedBinary.replace("win32", "windows");
        const windowsPath = path.join(releasePath, windowsBinary);
        if (existsSync(windowsPath)) {
          binaryPath = windowsPath;
        } else {
          // Also check for windows-4.0 variant (older xgo versions)
          const windows4Binary = expectedBinary.replace("win32", "windows-4.0");
          const windows4Path = path.join(releasePath, windows4Binary);
          if (existsSync(windows4Path)) {
            binaryPath = windows4Path;
          }
        }
      }

      if (!existsSync(binaryPath)) {
        missingBinaries.push(target);
        continue;
      }

      // Check if Go binary is older than any Go file
      const binaryStats = await stat(binaryPath);
      if (binaryStats.mtimeMs < newestGoFileTime) {
        outdatedBinaries.push(target);
      }
    }

    // Rebuild if any Go binaries are missing or outdated
    if (missingBinaries.length > 0) {
      return {
        rebuild: true,
        reason: `Missing Go binaries for: ${missingBinaries.join(", ")}`,
      };
    }

    if (outdatedBinaries.length > 0) {
      return {
        rebuild: true,
        reason: `Outdated Go binaries for: ${outdatedBinaries.join(", ")}`,
      };
    }

    // All required binaries exist and are up-to-date
    return { rebuild: false, reason: "All Go binaries are up-to-date" };
  } catch (error) {
    // On error, rebuild to be safe
    return {
      rebuild: true,
      reason: `Error checking Go binaries: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Build Go target for a specific platform
 */
async function buildGoTarget(
  packagePath: string,
  goos: string,
  goarch: string,
  suffix: string,
  platformName: string,
  outputName: string,
  outputDir: string,
  buildMode: string,
  ldflags: string,
  mainFile: string,
): Promise<boolean> {
  const outputFileName = `${outputName}-${platformName}-${goarch}.${suffix}`;
  const outputPath = path.join(packagePath, outputDir, outputFileName);
  const releasePath = path.join(packagePath, outputDir);

  // Ensure release directory exists
  if (!existsSync(releasePath)) {
    await mkdir(releasePath, { recursive: true });
  }

  logger.info(`Building for ${goos}/${goarch}...`);

  const env = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: "1",
  };

  const proc = Bun.spawnSync(
    [
      "go",
      "build",
      `-buildmode=${buildMode}`,
      `-ldflags=${ldflags}`,
      "-o",
      outputPath,
      mainFile,
    ],
    {
      env,
      cwd: packagePath,
    },
  );

  if (proc.exitCode !== 0) {
    logger.error(`Failed to build for ${goos}/${goarch}`);
    if (proc.stderr) {
      logger.error(proc.stderr.toString());
    }
    return false;
  }

  logger.success(`✓ Built ${outputFileName}`);
  return true;
}

/**
 * Build Go binaries using xgo
 */
async function buildWithXgo(
  packagePath: string,
  config: GoBuildOptions,
  outputName: string,
): Promise<GoBuildResult> {
  const xgoBase = path.join(os.homedir(), "go/bin/xgo");
  const XGO = os.platform() === "win32" ? `${xgoBase}.exe` : xgoBase;

  // Determine targets
  let targets: string;
  if (config.targets) {
    targets = Array.isArray(config.targets)
      ? config.targets.join(",")
      : config.targets;
  } else {
    // Default: build for all platforms
    targets = "linux/arm64,linux/amd64,darwin/arm64,darwin/amd64,windows/amd64";
  }

  const outputDir = config.outputDir ?? "release";
  const releasePath = path.join(packagePath, outputDir);

  // Check if rebuild is needed
  const targetsArray = targets.split(",").map((t) => t.trim());
  const rebuildCheck = await shouldRebuildGo(
    packagePath,
    targetsArray,
    outputDir,
    outputName,
  );
  if (!rebuildCheck.rebuild) {
    logger.info(`✓ ${rebuildCheck.reason}, skipping rebuild`);
    return { success: true, errors: [] };
  }

  if (rebuildCheck.reason) {
    logger.info(`Rebuilding: ${rebuildCheck.reason}`);
  }

  if (!existsSync(XGO)) {
    const error = `xgo not found at ${XGO}. Please install: go install github.com/crazy-max/xgo@latest`;
    logger.error(`Error: ${error}`);
    return { success: false, errors: [error] };
  }

  // Check if Docker is available before attempting build
  const dockerCheck = await checkDockerAvailable();
  if (!dockerCheck.available) {
    logger.warn(
      `⚠️  Skipping Go build: Docker is not installed or not running. Install Docker Desktop and ensure it's running to build Go binaries.`,
    );
    return { success: true, errors: [] };
  }

  logger.info("Compiling native binaries with xgo...");
  const buildMode = config.buildMode ?? "c-shared";
  const ldflags = config.ldflags ?? "-s -w";
  const goVersion = config.goVersion ?? "1.20.3";

  // Ensure release directory exists before xgo runs
  if (!existsSync(releasePath)) {
    await mkdir(releasePath, { recursive: true });
  }

  // xgo supports directory paths in -out parameter
  // Use forward slashes since xgo runs in Docker (Linux environment)
  // This will create files directly in the release directory
  const outPath = `${outputDir}/${outputName}`;

  const proc = Bun.spawnSync(
    [
      XGO,
      "-go",
      goVersion,
      "-out",
      outPath,
      `--targets=${targets}`,
      `-ldflags=${ldflags}`,
      `-buildmode=${buildMode}`,
      ".",
    ],
    {
      cwd: packagePath,
    },
  );

  if (proc.stdout) {
    logger.info(proc.stdout.toString());
  }

  if (proc.exitCode !== 0) {
    const error = "xgo compilation failed";
    logger.error(error);
    if (proc.stderr) {
      const stderr = proc.stderr.toString();
      logger.error(stderr);
      return { success: false, errors: [error, stderr] };
    }
    return { success: false, errors: [error] };
  }

  // Rename Windows binaries if release directory exists
  // xgo outputs: {name}-windows-amd64.dll -> rename to {name}-win32-amd64.dll
  if (existsSync(releasePath)) {
    const binaries = await readdir(releasePath);
    const windowsBinaries = binaries.filter(
      (binary) => binary.includes("windows") && !binary.includes("win32"),
    );
    await Promise.all(
      windowsBinaries.map((binary) => {
        const binaryPath = path.join(releasePath, binary);
        // Replace windows-4.0 or windows with win32
        const newPath = binaryPath.replace(/windows(-4\.0)?/g, "win32");
        return rename(binaryPath, newPath);
      }),
    );
  }

  return { success: true, errors: [] };
}

/**
 * Build Go binaries using native Go compiler
 */
async function buildWithNative(
  packagePath: string,
  config: GoBuildOptions,
  outputName: string,
): Promise<GoBuildResult> {
  logger.info("Compiling native binaries with native Go build...");

  const outputDir = config.outputDir ?? "release";
  const buildMode = config.buildMode ?? "c-shared";
  const ldflags = config.ldflags ?? "-s -w";
  const mainFile = config.mainFile ?? "main.go";

  // On Windows, CGO cross-compilation is limited, so only build for Windows
  const currentPlatform = os.platform();
  let targetsToBuild = [...DEFAULT_TARGETS];

  if (currentPlatform === "win32") {
    // On Windows, only build for Windows (CGO cross-compilation requires special setup)
    targetsToBuild = targetsToBuild.filter(([goos]) => goos === "windows");
    logger.info(
      "Building only for Windows (CGO cross-compilation from Windows requires special setup)",
    );
  }

  // Filter targets if specified
  if (config.targets) {
    const targetSet = new Set(
      Array.isArray(config.targets) ? config.targets : [config.targets],
    );
    targetsToBuild = targetsToBuild.filter(([goos, goarch]) =>
      targetSet.has(`${goos}/${goarch}`),
    );
  }

  // Build for selected targets
  const results = await Promise.all(
    targetsToBuild.map(([goos, goarch, suffix, platformName]) =>
      buildGoTarget(
        packagePath,
        goos,
        goarch,
        suffix,
        platformName,
        outputName,
        outputDir,
        buildMode,
        ldflags,
        mainFile,
      ).catch((err) => {
        logger.error(
          `Error building ${goos}/${goarch}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return false;
      }),
    ),
  );

  const successCount = results.filter((r) => r === true).length;
  const failCount = results.filter((r) => r === false).length;

  logger.info(
    `\nBuild complete: ${successCount} succeeded, ${failCount} failed`,
  );

  if (successCount === 0) {
    const error = "No targets built successfully";
    logger.error(error);
    return { success: false, errors: [error] };
  }

  return { success: true, errors: [] };
}

/**
 * Build Go binaries for a package
 */
export async function buildGo(
  packagePath: string,
  packageName: string,
  config?: GoBuildOptions,
): Promise<GoBuildResult> {
  // If config is explicitly set to disable, skip
  if (config?.enable === false) {
    return { success: true, errors: [] };
  }

  // If no config provided, use defaults (enable by default)
  const effectiveConfig = config ?? { enable: true };

  // Derive output name from package name if not specified
  // Strip org name (e.g., "@reliverse/dler-prompt" -> "dler-prompt")
  const outputName =
    effectiveConfig.outputName ??
    packageName.replace(/^@[^/]+\//, "").replace(/[^a-zA-Z0-9-]/g, "-");

  const provider = effectiveConfig.provider ?? "xgo";

  if (provider !== "xgo" && provider !== "native") {
    const error = `Invalid provider "${provider}". Must be "xgo" or "native".`;
    logger.error(`Error: ${error}`);
    return { success: false, errors: [error] };
  }

  if (provider === "xgo") {
    return buildWithXgo(packagePath, effectiveConfig, outputName);
  }

  return buildWithNative(packagePath, effectiveConfig, outputName);
}
