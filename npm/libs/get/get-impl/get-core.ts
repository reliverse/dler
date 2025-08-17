import { createWriteStream } from "node:fs";
import { arch, homedir, platform } from "node:os";
import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { execa } from "execa";
import { lookpath } from "lookpath";

interface MetaInfo {
  version: string;
  downloadUrl: string;
  installedAt: string;
  binary: string;
  repository?: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

export async function installDlerStandalone(installDir: string, appsPath: string, args: any) {
  relinka("info", "Installing dler standalone binary...");

  // Check for conflicts with globally installed dler
  await checkGlobalDlerConflicts(args.force);

  const repository = "reliverse/dler";
  const currentMeta = await getCurrentMeta(appsPath, "dler");

  // Check if already installed and up-to-date
  if (!args.force && currentMeta) {
    const latestVersion = await getLatestVersion(repository);
    if (currentMeta.version === latestVersion) {
      relinka("success", `dler ${latestVersion} is already installed and up-to-date`);
      return;
    } else {
      relinka("info", `Upgrading dler from ${currentMeta.version} to ${latestVersion}`);
    }
  }

  const binaryInfo = getDlerBinaryInfo();
  const downloadUrl = `https://github.com/${repository}/releases/${args.version}/download/${binaryInfo.filename}`;
  const binaryPath = path.resolve(installDir, binaryInfo.localName);

  if (args["dry-run"]) {
    relinka("info", "Dry run mode - would download:");
    relinka("verbose", `  From: ${downloadUrl}`);
    relinka("verbose", `  To: ${binaryPath}`);
    return;
  }

  // Download and install
  await downloadBinary(downloadUrl, binaryPath);
  await makeExecutable(binaryPath);

  // Get actual version from GitHub
  const actualVersion = await getLatestVersion(repository);

  // Update meta.json with nested structure
  const meta: MetaInfo = {
    version: actualVersion,
    downloadUrl,
    installedAt: new Date().toISOString(),
    binary: binaryInfo.localName,
    repository,
  };

  await updateAppsJson(appsPath, "dler", meta);

  relinka("success", `dler ${actualVersion} installed successfully to ${binaryPath}`);

  // Add to PATH if not skipped
  if (!args["skip-path"]) {
    await ensureInPath(installDir);
  }
}

export async function installFromGitHub(
  repoUrl: string,
  installDir: string,
  appsPath: string,
  args: any,
) {
  relinka("info", `Installing binary from ${repoUrl}...`);

  const repository = normalizeRepoUrl(repoUrl);
  const release = await getGitHubRelease(repository, args.version);

  if (!release) {
    throw new Error(`Release ${args.version} not found for ${repository}`);
  }

  // Find appropriate binary
  const asset = findBinaryAsset(release.assets, args.binary);
  if (!asset) {
    relinka("error", "Available assets:");
    release.assets.forEach((a) => relinka("verbose", `  - ${a.name}`));
    throw new Error(`No suitable binary found for your platform`);
  }

  const binaryName = args.binary || asset.name;
  const binaryPath = path.resolve(installDir, binaryName);

  // Extract binary key (name without extension) for meta.json
  const binaryKey = path.basename(binaryName, path.extname(binaryName));

  if (args["dry-run"]) {
    relinka("info", "Dry run mode - would download:");
    relinka("verbose", `  Asset: ${asset.name}`);
    relinka("verbose", `  From: ${asset.browser_download_url}`);
    relinka("verbose", `  To: ${binaryPath}`);
    return;
  }

  // Download and install
  await downloadBinary(asset.browser_download_url, binaryPath);
  await makeExecutable(binaryPath);

  // Update meta.json with nested structure
  const meta: MetaInfo = {
    version: release.tag_name,
    downloadUrl: asset.browser_download_url,
    installedAt: new Date().toISOString(),
    binary: binaryName,
    repository,
  };

  await updateAppsJson(appsPath, binaryKey, meta);

  relinka("success", `${binaryName} ${release.tag_name} installed successfully to ${binaryPath}`);

  // Add to PATH if not skipped
  if (!args["skip-path"]) {
    await ensureInPath(installDir);
  }
}

function getDlerBinaryInfo() {
  const os = platform();

  if (os === "darwin") {
    return {
      filename: "dler-darwin-arm64",
      localName: "dler",
    };
  } else if (os === "linux") {
    return {
      filename: "dler-linux",
      localName: "dler",
    };
  } else if (os === "win32") {
    return {
      filename: "dler-windows.exe",
      localName: "dler.exe",
    };
  } else {
    throw new Error(`Unsupported platform: ${os}`);
  }
}

function findBinaryAsset(assets: GitHubRelease["assets"], specificBinary?: string) {
  if (specificBinary) {
    return assets.find((asset) => asset.name === specificBinary);
  }

  const os = platform();
  const architecture = arch();

  // Platform-specific search patterns
  const patterns: string[] = [];

  if (os === "darwin") {
    patterns.push("darwin", "macos", "mac", "osx");
    if (architecture === "arm64") {
      patterns.push("arm64", "aarch64");
    } else {
      patterns.push("amd64", "x64", "x86_64");
    }
  } else if (os === "linux") {
    patterns.push("linux");
    if (architecture === "arm64") {
      patterns.push("arm64", "aarch64");
    } else {
      patterns.push("amd64", "x64", "x86_64");
    }
  } else if (os === "win32") {
    patterns.push("windows", "win", ".exe");
    patterns.push("amd64", "x64", "x86_64");
  }

  // Find asset that matches our platform
  return assets.find((asset) => {
    const name = asset.name.toLowerCase();
    return patterns.some((pattern) => name.includes(pattern.toLowerCase()));
  });
}

async function getCurrentMeta(appsPath: string, binaryKey: string): Promise<MetaInfo | null> {
  try {
    if (await fs.pathExists(appsPath)) {
      const content = await fs.readFile(appsPath, "utf8");
      const allMeta = JSON.parse(content) as Record<string, MetaInfo>;
      return allMeta[binaryKey] || null;
    }
  } catch {
    // Ignore errors, treat as not installed
  }
  return null;
}

async function updateAppsJson(appsPath: string, binaryKey: string, meta: MetaInfo): Promise<void> {
  let allMeta: Record<string, MetaInfo> = {};

  // Load existing apps file if it exists
  try {
    if (await fs.pathExists(appsPath)) {
      const content = await fs.readFile(appsPath, "utf8");
      allMeta = JSON.parse(content) as Record<string, MetaInfo>;
    }
  } catch {
    // Ignore errors, start with empty object
  }

  // Update the specific binary's meta
  allMeta[binaryKey] = meta;

  // Write back to file
  await fs.writeFile(appsPath, JSON.stringify(allMeta, null, 2), "utf8");
}

export async function checkPowerShellVersion(): Promise<void> {
  relinka("info", "Checking PowerShell version...");

  try {
    // First try pwsh (PowerShell Core)
    const pwshPath = await lookpath("pwsh");
    let powershellCmd = "powershell";
    let isPwsh = false;

    if (pwshPath) {
      powershellCmd = "pwsh";
      isPwsh = true;
    }

    // Get PowerShell version
    const { stdout } = await execa(powershellCmd, [
      "-Command",
      "$PSVersionTable.PSVersion.ToString()",
    ]);
    const versionString = stdout.trim();

    relinka(
      "info",
      `Found ${isPwsh ? "PowerShell Core" : "Windows PowerShell"} version: ${versionString}`,
    );

    // Parse version (e.g., "7.5.0" or "5.1.19041.4648")
    const versionMatch = versionString.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!versionMatch || !versionMatch[1] || !versionMatch[2]) {
      throw new Error(`Unable to parse PowerShell version: ${versionString}`);
    }

    const major = Number.parseInt(versionMatch[1], 10);
    const minor = Number.parseInt(versionMatch[2], 10);

    // Check if version is 7.5.0 or higher
    const isVersionValid = major > 7 || (major === 7 && minor >= 5);

    if (!isVersionValid) {
      relinka("error", "❌ PowerShell 7.5+ is required for dler installation on Windows");
      relinka("verbose", `   Current version: ${versionString}`);
      relinka("verbose", `   Required version: 7.5.0 or higher`);
      relinka("verbose", "");
      relinka("info", "🔧 To install PowerShell 7.5+:");
      relinka("verbose", "   • Visit: https://github.com/PowerShell/PowerShell/releases");
      relinka(
        "verbose",
        "   • Or use Windows Package Manager: winget install Microsoft.PowerShell",
      );
      relinka("verbose", "   • Or use Chocolatey: choco install powershell-core");
      relinka("verbose", "   • Or use Scoop: scoop install pwsh");
      relinka("verbose", "");
      relinka("info", "After installation, restart your terminal and try again.");

      process.exit(1);
    }

    relinka("verbose", `PowerShell ${versionString} meets the requirements`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Command failed")) {
      relinka("error", "❌ PowerShell not found or not working properly");
      relinka("info", "Please ensure PowerShell 7.5+ is installed and accessible");
    } else {
      throw error; // Re-throw other errors
    }
    process.exit(1);
  }
}

async function checkGlobalDlerConflicts(force: boolean): Promise<void> {
  // Check if dler is installed globally via package managers
  const packageManagers = ["npm", "yarn", "pnpm", "bun"];
  const conflicts: { manager: string; command: string }[] = [];

  for (const pm of packageManagers) {
    const pmPath = await lookpath(pm);
    if (!pmPath) continue;

    try {
      let isInstalled = false;

      if (pm === "npm") {
        // Check npm global packages
        const { stdout } = await execa("npm", ["list", "-g", "--depth=0", "@reliverse/dler"]);
        isInstalled = stdout.includes("@reliverse/dler");
      } else if (pm === "yarn") {
        // Check yarn global packages
        try {
          const { stdout } = await execa("yarn", ["global", "list"]);
          isInstalled = stdout.includes("@reliverse/dler");
        } catch {
          // Try yarn v2+ format
          try {
            const { stdout } = await execa("yarn", [
              "global",
              "list",
              "--pattern",
              "@reliverse/dler",
            ]);
            isInstalled = stdout.includes("@reliverse/dler");
          } catch {
            // Ignore errors
          }
        }
      } else if (pm === "pnpm") {
        // Check pnpm global packages
        const { stdout } = await execa("pnpm", ["list", "-g", "@reliverse/dler"]);
        isInstalled = stdout.includes("@reliverse/dler");
      } else if (pm === "bun") {
        // Check bun global packages
        const { stdout } = await execa("bun", ["pm", "ls", "-g"]);
        isInstalled = stdout.includes("@reliverse/dler");
      }

      if (isInstalled) {
        const removeCommand =
          pm === "npm"
            ? "uninstall"
            : pm === "yarn"
              ? "global remove"
              : pm === "pnpm"
                ? "remove"
                : "remove"; // bun

        conflicts.push({
          manager: pm,
          command:
            pm === "yarn"
              ? `${pm} ${removeCommand} @reliverse/dler`
              : `${pm} ${removeCommand} -g @reliverse/dler`,
        });
      }
    } catch {
      // Ignore errors when checking individual package managers
    }
  }

  if (conflicts.length > 0 && !force) {
    relinka("warn", "⚠️  Detected globally installed dler via package manager(s):");
    conflicts.forEach((conflict) => {
      relinka(
        "log",
        `  📦 ${conflict.manager.toUpperCase()}: Found @reliverse/dler installed globally`,
      );
    });

    relinka("warn", "\n🔧 To avoid conflicts, please remove the global installation(s) first:");
    conflicts.forEach((conflict) => {
      relinka("verbose", `  ${conflict.command}`);
    });

    relinka(
      "info",
      "\n💡 Then RESTART your terminal and run 'dler get' again to install the standalone binary.",
    );
    relinka("info", "Or use --force to proceed anyway (not recommended).");

    process.exit(1);
  } else if (conflicts.length > 0 && force) {
    relinka("warn", "⚠️  Proceeding with --force despite global dler installation conflicts");
  }
}

async function getLatestVersion(repository: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const release = (await response.json()) as GitHubRelease;
    return release.tag_name;
  } catch (error) {
    throw new Error(
      `Failed to get latest version: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getGitHubRelease(
  repository: string,
  version: string,
): Promise<GitHubRelease | null> {
  try {
    const url =
      version === "latest"
        ? `https://api.github.com/repos/${repository}/releases/latest`
        : `https://api.github.com/repos/${repository}/releases/tags/${version}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return (await response.json()) as GitHubRelease;
  } catch (error) {
    throw new Error(
      `Failed to get release info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeRepoUrl(url: string): string {
  // Handle different URL formats
  if (url.includes("github.com")) {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (match && match[1]) {
      return match[1].replace(/\.git$/, "");
    }
  }

  // Assume it's already in owner/repo format
  if (url.includes("/") && !url.includes("://")) {
    return url;
  }

  throw new Error(`Invalid repository URL format: ${url}`);
}

async function downloadBinary(url: string, targetPath: string): Promise<void> {
  relinka("info", `Downloading from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const fileStream = createWriteStream(targetPath);
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
    }
  } finally {
    fileStream.end();
    reader.releaseLock();
  }

  relinka("success", "Download completed");
}

async function makeExecutable(filePath: string): Promise<void> {
  if (platform() !== "win32") {
    await fs.chmod(filePath, 0o755);
  }
}

async function addToWindowsPath(installDir: string): Promise<void> {
  // PowerShell script inspired by Bun's approach
  // https://github.com/oven-sh/bun/blob/main/scripts/bootstrap.ps1
  const psScript = `
    function Refresh-Path {
      $paths = @(
        [System.Environment]::GetEnvironmentVariable("Path", "Machine"),
        [System.Environment]::GetEnvironmentVariable("Path", "User"),
        [System.Environment]::GetEnvironmentVariable("Path", "Process")
      )
      $uniquePaths = $paths |
        Where-Object { $_ } |
        ForEach-Object { $_.Split(';', [StringSplitOptions]::RemoveEmptyEntries) } |
        Where-Object { $_ -and (Test-Path $_) } |
        Select-Object -Unique
      $env:Path = ($uniquePaths -join ';').TrimEnd(';')
    }

    function Add-To-User-Path {
      param([string]$Directory)
      
      $absolutePath = Resolve-Path $Directory -ErrorAction SilentlyContinue
      if (-not $absolutePath) {
        $absolutePath = $Directory
      }
      
      $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
      if (-not $currentPath) { $currentPath = "" }
      
      # Check if already in PATH
      $pathArray = $currentPath.Split(';', [StringSplitOptions]::RemoveEmptyEntries)
      if ($pathArray -contains $absolutePath) {
        Write-Host "Directory already in PATH"
        return
      }
      
      # Add to PATH with length checking (User PATH limit is typically 2048)
      $newPath = $currentPath.TrimEnd(";") + ";" + $absolutePath
      if ($newPath.Length -ge 2048) {
        Write-Warning "PATH is getting long, removing duplicates..."
        
        # Remove duplicates and non-existent paths
        $cleanPaths = $pathArray | 
          Where-Object { $_ -and (Test-Path $_) } |
          Select-Object -Unique
        
        $cleanPaths += $absolutePath
        $newPath = $cleanPaths -join ';'
        
        # If still too long, remove older entries
        while ($newPath.Length -ge 2048 -and $cleanPaths.Count -gt 1) {
          $cleanPaths = $cleanPaths[1..$cleanPaths.Count]
          $newPath = $cleanPaths -join ';'
        }
      }
      
      Write-Host "Adding $absolutePath to User PATH..."
      [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
      Refresh-Path
      Write-Host "PATH updated successfully"
    }

    Add-To-User-Path '${installDir.replace(/\\/g, "\\\\").replace(/'/g, "''")}'
  `.trim();

  // Find PowerShell executable (prefer pwsh over powershell)
  const pwshPath = await lookpath("pwsh");
  const powershellCmd = pwshPath || "powershell";

  // Execute PowerShell command
  await execa(powershellCmd, ["-Command", psScript]);
}

async function ensureInPath(installDir: string): Promise<void> {
  // Check if directory is already in PATH by looking for any executable
  const testBinary = await lookpath("dler");
  if (testBinary && testBinary.includes(installDir)) {
    relinka("success", `${installDir} is already in PATH`);
    return;
  }

  relinka("info", "Adding to PATH...");

  const os = platform();
  const homeDir = homedir();

  if (os === "win32") {
    // Try to modify PATH automatically using PowerShell
    try {
      await addToWindowsPath(installDir);
      relinka("success", `Added ${installDir} to PATH`);
      relinka("info", "Please restart your terminal for PATH changes to take effect");
    } catch (error) {
      relinka("warn", `Failed to automatically modify PATH: ${error}`);
      relinka("warn", "Please add manually:");
      relinka("verbose", `Add ${installDir} to your PATH environment variable`);
      relinka(
        "log",
        "You can do this through Environment Variables > System Properties > Path > Edit",
      );
    }
  } else {
    // Unix-like systems
    const shellRc =
      os === "darwin" ? path.resolve(homeDir, ".zshrc") : path.resolve(homeDir, ".bashrc");

    try {
      let rcContent = "";
      if (await fs.pathExists(shellRc)) {
        rcContent = await fs.readFile(shellRc, "utf8");
      }

      const pathExport = `export PATH="${installDir}:$PATH"`;

      if (!rcContent.includes(pathExport)) {
        rcContent += `\n# Added by dler get command\n${pathExport}\n`;
        await fs.writeFile(shellRc, rcContent, "utf8");
        relinka("success", `Added to PATH in ${shellRc}`);
        relinka("info", "Please restart your terminal or run: source " + shellRc);
      } else {
        relinka("info", "PATH export already exists in " + shellRc);
      }
    } catch (error) {
      relinka("warn", `Could not modify shell RC file: ${error}`);
      relinka("info", `Please manually add ${installDir} to your PATH`);
    }
  }
}
