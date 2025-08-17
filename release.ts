import { $ } from "bun";
import fs from "fs";

// Note: Cross-compilation from Windows to non-Windows targets (Linux/macOS)
// requires Docker or WSL2. The script will automatically handle this limitation.
//
// BUILD CONFIGURATION:
// ===================
// Use the BUILD_TARGETS array below to enable/disable specific build targets.
// Each target has an 'enabled' boolean flag that you can toggle.
//
// Available targets:
// - Windows: x64, ARM64 (.exe files)
// - macOS: x64, ARM64 (no extension)
// - Linux: x64, ARM64 (no extension)
//
// Examples:
// - Windows-only: Set all non-Windows targets to enabled: false
// - Skip ARM64: Set all ARM64 targets to enabled: false
// - All platforms: Keep all targets enabled: true (default)

// Build mode configuration
// Change CURRENT_BUILD_MODE below to switch between build strategies:
// - "full_and_fallback": Try cross-compilation using 'cross' tool, fallback to copying (recommended for development)
// - "full_only": Only cross-compilation using 'cross' tool, fail if not possible (for CI/CD with proper toolchains)
// - "copy_only": Only copy current platform binary (fastest, for testing)
const BUILD_MODE = {
  FULL_FEATURED_AND_FALLBACK: "full_and_fallback", // Try cross-compilation using 'cross' tool, fallback to copying
  FULL_FEATURED_ONLY: "full_only", // Only cross-compilation using 'cross' tool, fail if not possible
  COPY_ONLY: "copy_only", // Only copy current platform binary
} as const;

// Build configuration with enable toggles for each target
interface BuildTarget {
  platform: string;
  arch: string;
  ext: string;
  enabled: boolean;
  description: string;
}

const BUILD_TARGETS: BuildTarget[] = [
  // Windows targets
  { platform: "windows", arch: "x64", ext: ".exe", enabled: true, description: "Windows x64" },
  { platform: "windows", arch: "arm64", ext: ".exe", enabled: true, description: "Windows ARM64" },

  // macOS targets
  { platform: "macos", arch: "x64", ext: "", enabled: true, description: "macOS x64" },
  { platform: "macos", arch: "arm64", ext: "", enabled: true, description: "macOS ARM64" },

  // Linux targets
  { platform: "linux", arch: "x64", ext: "", enabled: true, description: "Linux x64" },
  { platform: "linux", arch: "arm64", ext: "", enabled: true, description: "Linux ARM64" },
];

// Example configurations for different use cases:
//
// Windows-only development:
// const BUILD_TARGETS: BuildTarget[] = [
//   { platform: "windows", arch: "x64", ext: ".exe", enabled: true, description: "Windows x64" },
//   { platform: "windows", arch: "arm64", ext: ".exe", enabled: false, description: "Windows ARM64" },
//   { platform: "macos", arch: "x64", ext: "", enabled: false, description: "macOS x64" },
//   { platform: "macos", arch: "arm64", ext: "", enabled: false, description: "macOS ARM64" },
//   { platform: "linux", arch: "x64", ext: "", enabled: false, description: "Linux x64" },
//   { platform: "linux", arch: "arm64", ext: "", enabled: false, description: "Linux ARM64" },
// ];
//
// Linux/macOS only (for CI/CD):
// const BUILD_TARGETS: BuildTarget[] = [
//   { platform: "windows", arch: "x64", ext: ".exe", enabled: false, description: "Windows x64" },
//   { platform: "windows", arch: "arm64", ext: ".exe", enabled: false, description: "Windows ARM64" },
//   { platform: "macos", arch: "x64", ext: "", enabled: true, description: "macOS x64" },
//   { platform: "macos", arch: "arm64", ext: "", enabled: true, description: "macOS ARM64" },
//   { platform: "linux", arch: "x64", ext: "", enabled: true, description: "Linux x64" },
//   { platform: "linux", arch: "arm64", ext: "", enabled: true, description: "Linux ARM64" },
// ];

// Set your preferred build mode here
const CURRENT_BUILD_MODE: (typeof BUILD_MODE)[keyof typeof BUILD_MODE] =
  BUILD_MODE.FULL_FEATURED_ONLY;

// Build functions for different modes
async function buildFullFeaturedOnly(targets: BuildTarget[], distDir: string): Promise<void> {
  console.log("🔨 Building with full cross-compilation (no fallback)...");

  for (const target of targets) {
    if (!target.enabled) {
      console.log(`⏭️ Skipping disabled target: ${target.description}`);
      continue;
    }

    const targetTriple = getTargetTriple(target.platform, target.arch);
    console.log(`🔨 Building for ${target.description} (${targetTriple})...`);

    try {
      // Check if we're on Windows and trying to cross-compile to non-Windows targets
      if (process.platform === "win32" && target.platform !== "windows") {
        console.log(
          `⚠️ Cross-compilation from Windows to ${target.platform} may require Docker or WSL2`,
        );
        console.log(`💡 Consider using 'copy_only' mode or running from WSL2/Linux`);
        throw new Error(
          `Cross-compilation from Windows to ${target.platform} not supported in this environment`,
        );
      }

      await $`cross build --release --target ${targetTriple}`;
      const targetFile = `target/${targetTriple}/release/dlerust${target.ext}`;

      if (fs.existsSync(targetFile)) {
        const finalName = `dlerust-${target.platform}-${target.arch}${target.ext}`;
        const distPath = `${distDir}/${finalName}`;
        fs.copyFileSync(targetFile, distPath);
        console.log(`✅ Built for ${target.description}: ${distPath}`);
      } else {
        throw new Error(`Binary not found for ${target.description} at ${targetFile}`);
      }
    } catch (error) {
      console.error(`❌ Build failed for ${target.description}: ${error}`);
      throw error; // Re-throw to fail the entire build
    }
  }
}

async function buildCopyOnly(targets: BuildTarget[], distDir: string): Promise<void> {
  console.log("🔨 Building for current platform only and copying...");

  // Build for current platform
  await $`cargo build --release`;

  const currentExt = process.platform === "win32" ? ".exe" : "";
  const currentTargetFile = `target/release/dlerust${currentExt}`;

  if (fs.existsSync(currentTargetFile)) {
    for (const target of targets) {
      if (!target.enabled) {
        console.log(`⏭️ Skipping disabled target: ${target.description}`);
        continue;
      }

      const finalName = `dlerust-${target.platform}-${target.arch}${target.ext}`;
      const distPath = `${distDir}/${finalName}`;

      // Copy the current binary to all target names
      fs.copyFileSync(currentTargetFile, distPath);
      console.log(`✅ Copied current binary to: ${target.description}: ${distPath}`);
    }
  } else {
    throw new Error(`Current platform binary not found at: ${currentTargetFile}`);
  }
}

async function buildWithFallback(targets: BuildTarget[], distDir: string): Promise<void> {
  console.log("🔨 Building with cross-compilation and fallback...");

  let crossCompilationSuccess = false;

  for (const target of targets) {
    if (!target.enabled) {
      console.log(`⏭️ Skipping disabled target: ${target.description}`);
      continue;
    }

    const targetTriple = getTargetTriple(target.platform, target.arch);
    console.log(`🔨 Attempting to build for ${target.description} (${targetTriple})...`);

    try {
      // Check if we're on Windows and trying to cross-compile to non-Windows targets
      if (process.platform === "win32" && target.platform !== "windows") {
        console.log(
          `⚠️ Cross-compilation from Windows to ${target.platform} may require Docker or WSL2`,
        );
        console.log(`💡 Skipping ${target.platform} target on Windows, will fallback to copy mode`);
        continue;
      }

      await $`cross build --release --target ${targetTriple}`;
      const targetFile = `target/${targetTriple}/release/dlerust${target.ext}`;

      if (fs.existsSync(targetFile)) {
        const finalName = `dlerust-${target.platform}-${target.arch}${target.ext}`;
        const distPath = `${distDir}/${finalName}`;
        fs.copyFileSync(targetFile, distPath);
        console.log(`✅ Built for ${target.description}: ${distPath}`);
        crossCompilationSuccess = true;
      } else {
        console.warn(`⚠️ Binary not found for ${target.description} at ${targetFile}`);
      }
    } catch (error) {
      if (target.platform === "windows") {
        console.warn(`⚠️ Windows build failed for ${target.description}: ${error}`);
        console.warn(`💡 Make sure Visual Studio Build Tools are installed with C++ workload`);
        console.warn(`💡 Installation options:`);
        console.warn(`   1. Fastest: winget install Microsoft.VisualStudio.2022.BuildTools`);
        console.warn(
          `   2. Manual: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022`,
        );
        console.warn(`   3. Run 'build-with-vs.ps1' to set up the environment properly`);
      } else {
        console.warn(`⚠️ Cross-compilation failed for ${target.description}: ${error}`);
        console.warn(`💡 This requires cross-compilation toolchains (gcc, clang, etc.)`);
      }
    }
  }

  // If cross-compilation failed, fall back to building for current platform and copying
  if (!crossCompilationSuccess) {
    console.log("🔄 Cross-compilation failed, falling back to current platform build...");
    await buildCopyOnly(targets, distDir);
  }
}

// Helper function to convert platform/arch to Rust target triple
function getTargetTriple(platform: string, arch: string): string {
  const archMap: Record<string, string> = {
    x64: "x86_64",
    arm64: "aarch64",
  };

  const platformMap: Record<string, string> = {
    windows: "pc-windows-msvc",
    macos: "apple-darwin",
    linux: "unknown-linux-gnu",
  };

  return `${archMap[arch]}-${platformMap[platform]}`;
}

// Helper function to convert BUILD_TARGETS to bun target format
function getBunTargets(targets: BuildTarget[]): string[] {
  const platformMap: Record<string, string> = {
    windows: "windows",
    macos: "darwin", // macOS uses darwin in bun targets
    linux: "linux",
  };

  return targets.map((target) => {
    if (!platformMap[target.platform]) {
      throw new Error(`Unsupported platform for bun target: ${target.platform}`);
    }
    return `${platformMap[target.platform]}-${target.arch}`;
  });
}

/**
 * - dler: dler-windows-x64.exe, dler-windows-arm64.exe | dler-macos-x64, dler-macos-arm64 | dler-linux-x64, dler-linux-arm64
 * - dlerust: dlerust-windows-x64.exe, dlerust-windows-arm64.exe | dlerust-macos-x64, dlerust-macos-arm64 | dlerust-linux-x64, dlerust-linux-arm64
 */
async function main() {
  try {
    console.log("🚀 Starting release build...");

    // Build Rust binaries for all targets using cross-compilation with 'cross' tool
    console.log("🔨 Building Rust binaries for all targets using 'cross' tool...");

    // Get enabled targets from configuration
    const enabledTargets = BUILD_TARGETS.filter((target) => target.enabled);
    console.log(`🎯 Building for ${enabledTargets.length}/${BUILD_TARGETS.length} enabled targets`);

    // Log which targets are enabled/disabled
    BUILD_TARGETS.forEach((target) => {
      const status = target.enabled ? "✅" : "❌";
      console.log(`   ${status} ${target.description}`);
    });

    // Show target mapping
    if (enabledTargets.length > 0) {
      console.log("🔄 Target mapping:");
      const inputFile = "npm/dler.ts";
      const prefix =
        inputFile
          .split("/")
          .pop()
          ?.replace(/\.[^/.]+$/, "") || "dler";

      enabledTargets.forEach((target) => {
        const rustTarget = getTargetTriple(target.platform, target.arch);
        const bunTarget = getBunTargets([target])[0];
        const prefixedBunTarget = `${prefix}-${bunTarget}`;
        console.log(`   ${target.description} → Rust: ${rustTarget}, Bun: ${prefixedBunTarget}`);
      });
    }

    // Create dist directory if it doesn't exist
    const distDir = "./dist";
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Build based on selected mode
    switch (CURRENT_BUILD_MODE) {
      case "full_only":
        await buildFullFeaturedOnly(enabledTargets, distDir);
        break;

      case "copy_only":
        await buildCopyOnly(enabledTargets, distDir);
        break;

      case "full_and_fallback":
      default:
        await buildWithFallback(enabledTargets, distDir);
        break;
    }

    // Build TypeScript binary with Bun for enabled targets
    console.log("🔨 Building TypeScript binary with Bun for enabled targets...");

    // Convert BUILD_TARGETS to bun target format and add prefix
    const bunTargets = getBunTargets(enabledTargets);
    const inputFile = "npm/dler.ts";
    const prefix =
      inputFile
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "dler";
    const prefixedTargets = bunTargets.map((target) => `${prefix}-${target}`);
    const targetsArg = prefixedTargets.join(",");
    console.log(`🎯 Bun targets: ${targetsArg}`);

    await $`bun dler build binary --input ${inputFile} --targets=${targetsArg}`;

    console.log("🎉 Release build completed successfully!");
    console.log("📦 Rust binaries: dlerust-{platform}-{arch} for all supported targets");
  } catch (error) {
    console.error("❌ Release build failed:", error);
    process.exit(1);
  }
}

await main();
