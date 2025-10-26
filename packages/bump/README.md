# 🪸 reliverse dler-bump • powerful version bumping

> @reliverse/dler-bump is a powerful version bumping tool for javascript and typescript libraries.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/pb8ukbwpsj) — [repo](https://github.com/reliverse/dler-bump) — [npm](https://npmjs.com/@reliverse/dler-bump) — [docs](https://docs.reliverse.org/reliverse/dler-bump)

## Installation

```bash
# bun — pnpm — yarn — npm
bun add -D @reliverse/dler-bump
```

## Features

- 🤖 **Interactive Mode**: Just run and follow the prompts
- 🔄 **Non-Interactive Mode**: Works in CI environments without TTY
- 🎯 **Smart Detection**: Finds version patterns in your files using regex
- 🔄 **Multiple Files**: Update versions in many files at once
- 🛠️ **File Type Support**: Handles both package.json and TypeScript files
- 🎮 **Custom Versions**: Want a specific version or need to downgrade? No problem!
- 📝 **Custom Source**: Use a different file as version source
- 🔍 **Dry Run**: Preview changes before applying them
- 🔒 **Version Validation**: Ensures all versions are valid semver
- 📊 **Version Analysis**: Detects mismatches and compares version differences
- 🎯 **Range Satisfaction**: Check if versions satisfy semver ranges
- ⚡ **Fast & Lightweight**: Built with performance in mind
- 🛡️ **Error Handling**: Comprehensive error checking and reporting
- 🔒 **Bump Disable Management**: Programmatic control of version bumping

## Quick Start

### Interactive Mode

Just run:

```bash
bun rse bump
```

That's it! Follow the prompts to:

1. Choose which files to update
2. Select how you want to bump the version
3. See what changes will be made

### Programmatic Mode

```ts
import { bumpVersionWithAnalysis } from "@reliverse/dler-bump";

// Patch bump
await bumpVersionWithAnalysis(
  "patch",           // bumpType: "patch" | "minor" | "major" | "auto" | "manual"
  ["package.json"],  // files to bump
  { dryRun: false }, // options
);

// Manual version with bumpSet from config
await bumpVersionWithAnalysis(
  "manual",          // bumpType
  ["package.json"],  // files to bump
  { dryRun: false }, // options
  "1.2.3",          // bumpSet from dler.ts
);

// Manual version with customVersion
await bumpVersionWithAnalysis(
  "manual",          // bumpType
  ["package.json"],  // files to bump
  { 
    dryRun: false,
    customVersion: "1.2.3" // overrides bumpSet if provided
  },
);
```

### CLI Mode

CLI is available via [Dler CLI](https://github.com/reliverse/dler) by Reliverse.

```bash
# Basic usage examples
bun rse bump --bumpType patch --files package.json src/version.ts
bun rse bump --bumpType minor --dryRun  # Preview changes
bun rse bump --bumpType major --mainFile package.json
bun rse bump --bumpType auto --mainFile package.json --files package.json dler.ts
bun rse bump --bumpType manual --customVersion 2.0.0 --mainFile package.json

# Advanced usage
bun rse bump \
  --bumpType manual \
  --customVersion 1.0.1 \
  --dryRun \
  --mainFile package.json \
  --verbose \
  --files "package.json dler.ts"

# Available options
--dev              # Run in dev mode
--bumpType         # Type of bump: patch|minor|major|auto|manual
--customVersion    # Set specific version (with manual mode)
--dryRun           # Preview changes without applying
--mainFile         # Version source file (default: package.json)
--verbose          # Show detailed logs
--files            # Files to bump (space or comma-separated)
--disableBump      # Disable bumping (useful for CI)
```

## Advanced Features

### Version Analysis

The tool performs deep analysis of your files to:

- Detect version mismatches across files
- Validate semver format
- Identify unsupported file types
- Provide detailed analysis reports

### Smart Version Detection

- Automatically detects version patterns in different file types
- Supports multiple version formats (quotes, assignments, etc.)
- Preserves original formatting when updating versions

### CI/CD Integration

- Special handling for CI environments
- Non-interactive mode for automated workflows
- Configurable through environment variables
- Support for automated version bumping

### Configuration Management

- Flexible configuration through `dler.ts`
- Support for custom version sources
- Configurable file patterns
- Version bump control flags

### Error Prevention

- Validates all version changes
- Prevents invalid semver versions
- Checks for version mismatches
- Provides detailed error messages

### Version Bump Control

- **Bump Handler**: Advanced version bumping with:
  - Support for auto-patch, auto-minor, auto-major modes
  - Custom version setting capability
  - Dry run support for previewing changes
  - Automatic version validation
  - Configurable file filtering
  - Detailed logging of version changes

- **Bump Disable Management**:
  - Programmatic control of version bumping
  - Integration with common publish pause
  - Automatic configuration file updates
  - Support for both TypeScript and JavaScript configs
  - Graceful handling of missing config files
  - Non-blocking error handling

## Advanced Programmatic Example

```ts
import { 
  bumpVersionWithAnalysis,
  analyzeFiles,
  getCurrentVersion,
  type BumpMode,
  type FileAnalysis
} from "@reliverse/dler-bump";

// First analyze files
const currentVersion = await getCurrentVersion("package.json");
const fileAnalysis = await analyzeFiles(
  [
    "package.json",
    "src/version.ts",
    "dler.ts"
  ],
  currentVersion
);

// Filter supported files
const supportedFiles = fileAnalysis
  .filter(f => f.supported)
  .map(f => f.file);

// Then bump versions
await bumpVersionWithAnalysis(
  "patch",           // bumpType
  supportedFiles,    // only supported files
  {
    dryRun: true,    // preview only
    verbose: true,   // show detailed logs
  }
);
```

### Configuration Types

```ts
type BumpMode = "patch" | "minor" | "major" | "auto" | "manual";

type BumpOptions = {
  dryRun?: boolean;
  verbose?: boolean;
  customVersion?: string;
};

type FileAnalysis = {
  file: string;
  supported: boolean;
  detectedVersion: string | null;
  versionMismatch: boolean;
  reason: string;
  fileType: "package.json" | "typescript" | "unknown";
};
```

### Additional Utility Functions

```ts
// Check if version bumping is currently disabled
await isBumpDisabled(): Promise<boolean>

// Set bumpDisable flag to a specific value
await setBumpDisabledValueTo(value: boolean): Promise<void>

// Update any field in dler.ts
await updateDlerConfig(field: string, value: any): Promise<void>

// Get current version from a file
await getCurrentVersion(filePath?: string, field?: string): Promise<string>

// Get package name from a file
await getPackageName(filePath?: string, field?: string): Promise<string>

// Get package author from a file
await getPackageAuthor(filePath?: string, field?: string): Promise<string>

// Compare two versions
compareVersions(version1: string, version2: string): number

// Get latest version from an array of versions
getLatestVersion(versions: string[]): string | null

// Check if a version is a prerelease
isPrerelease(version: string): boolean

// Check if a version satisfies a range
satisfiesRange(version: string, range: string): boolean

// Parse semver into components
parseSemver(version: string): [number, number, number]

// Validate semver format
isValidSemver(version: string): boolean
```

## Configuration

### CLI Options

```bash
Options:
  --bumpMode <mode>       Mode: patch, minor, major, auto, manual
  --customVersion <ver>   Set specific version (with manual mode)
  --mainFile <file>       Version source file (default: package.json)
  --dryRun                Preview changes without applying
  --disableBump           Disable bumping (useful for CI)
  --dev                   Run in dev mode
```

### Using with `dler.ts`

Create a `dler.ts` to configure default behavior:

```ts
import { defineConfig } from "@reliverse/dler";

export default defineConfig({
  bumpFilter: [
    "package.json",
    "src/version.ts",
  ],
  bumpMode: "patch",
  bumpDisable: false,
});
```

## Advanced Usage

```ts
// src/cli.ts
import { relinka } from "@reliverse/relinka";
import {
  runMain,
  defineCommand,
  defineArgs,
  selectPrompt,
  inputPrompt,
  startPrompt,
  endPrompt,
} from "@reliverse/rempts";
import path from "node:path";
import semver from "semver";

import {
  bumpVersionWithAnalysis,
  getCurrentVersion,
  getFilesFromConfigOrDefault,
  getConfigFromDler,
  type BumpMode,
  validateBumpConfig,
  getDefaultBumpMode,
  handleNonInteractiveSession,
  handleInteractiveSession,
  type SessionConfig,
} from "./mod.js";

const bumpTypes: BumpMode[] = ["patch", "minor", "major", "auto", "manual"];

const main = defineCommand({
  meta: {
    name: "dler-bump",
    description:
      "Allows you to bump the version of your project interactively.",
  },
  args: defineArgs({
    dev: {
      type: "boolean",
      description: "Runs the CLI in dev mode",
    },
    bumpType: {
      type: "string",
      description: "The type of version bump to perform",
      allowed: bumpTypes,
    },
    customVersion: {
      type: "string",
      description: "Custom version to set (only used with manual bump type)",
    },
    disableBump: {
      type: "boolean",
      description: "Disables the bump (this is useful for CI)",
    },
    files: {
      type: "string",
      description:
        'Files to bump (comma or space-separated, or quoted: "package.json dler.ts")',
      default: "",
    },
    dryRun: {
      type: "boolean",
      description: "Preview changes without writing files",
    },
    mainFile: {
      type: "string",
      description:
        "The file to use as version source (defaults to package.json)",
      default: "package.json",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
    },
  }),
  async run({ args }) {
    const isCI = process.env.CI === "true";
    const isNonInteractive = !process.stdout.isTTY;
    const dryRun = !!args.dryRun;
    const verbose = !!args.verbose;
    const mainFile = args.mainFile;
    const customVersion = args.customVersion;

    // Read current versions
    let bleumpVersion = "unknown";
    let projectVersion = "unknown";
    try {
      const bleumpPkg = await import("../package.json", {
        assert: { type: "json" },
      });
      bleumpVersion = bleumpPkg.default.version || "unknown";
      projectVersion = await getCurrentVersion(mainFile);
    } catch (e) {
      relinka("warn", `Could not read package versions: ${e}`);
    }

    await showStartPrompt(args.dev, bleumpVersion);

    // Get files to bump - handle multiple parsing scenarios
    let filesToBumpArr: string[] = [];

    // Handle files from --files flag with improved parsing
    if (args.files) {
      // handle both comma and space separation, plus remaining CLI args
      const filesFromFlag = args.files
        .split(/[,\s]+/) // split on comma or whitespace
        .map((f) => f.trim())
        .filter(Boolean);

      // also check if there are additional file arguments after known flags
      const remainingArgs = process.argv.slice(2);
      const knownFlags = [
        "--dev",
        "--bumpType",
        "--customVersion",
        "--disableBump",
        "--files",
        "--dryRun",
        "--mainFile",
        "--verbose",
      ];

      // find files that appear after --files but aren't flags
      const filesIndex = remainingArgs.findIndex((arg) => arg === "--files");
      if (filesIndex !== -1) {
        for (let i = filesIndex + 2; i < remainingArgs.length; i++) {
          const arg = remainingArgs[i];
          if (arg.startsWith("--") || knownFlags.includes(arg)) break;
          if (!filesFromFlag.includes(arg)) {
            filesFromFlag.push(arg);
          }
        }
      }

      filesToBumpArr = filesFromFlag;
    }

    // If no files specified, use defaults
    if (filesToBumpArr.length === 0) {
      filesToBumpArr = await getFilesFromConfigOrDefault();
    }

    // Ensure mainFile is in the list (using absolute path)
    if (!filesToBumpArr.includes(mainFile)) {
      filesToBumpArr.unshift(mainFile);
    }

    // Remove duplicates while preserving order
    filesToBumpArr = [...new Set(filesToBumpArr)];

    // Get bump type and other settings from config
    const dlerConfig = await getConfigFromDler();
    let effectiveBumpMode = args.bumpType as BumpMode;

    // Apply config settings if not overridden by CLI args
    if (!effectiveBumpMode && dlerConfig.bumpMode) {
      effectiveBumpMode = dlerConfig.bumpMode;
    }
    if (!effectiveBumpMode) {
      effectiveBumpMode = getDefaultBumpMode(isCI, isNonInteractive);
    }

    // Override disableBump from config if not set via CLI
    if (!args.disableBump && dlerConfig.bumpDisable) {
      args.disableBump = true;
    }

    const sessionConfig: SessionConfig = {
      isCI,
      isNonInteractive,
      mainFile,
      filesToBump: filesToBumpArr,
      options: { dryRun, verbose, customVersion },
      bumpType: effectiveBumpMode,
    };

    if (verbose) {
      relinka("info", "Configuration:");
      relinka("log", `  Bump Type: ${effectiveBumpMode}`);
      relinka("log", `  Custom Version: ${customVersion || "none"}`);
      relinka("log", `  Dry Run: ${dryRun}`);
      relinka("log", `  Main File: ${mainFile}`);
      relinka("log", `  Files to Bump (${filesToBumpArr.length}):`);
      for (const file of filesToBumpArr) {
        relinka("log", `    ${file}`);
      }
      relinka("log", `  Current Version: ${projectVersion}`);
    }

    if (args.disableBump) {
      relinka(
        "log",
        "Bump disabled (--disableBump flag set or configured in dler.ts)",
      );
      process.exit(0);
    }

    try {
      if (isCI || isNonInteractive) {
        await handleNonInteractiveSession(sessionConfig);
      } else {
        await handleInteractiveSession(sessionConfig, projectVersion);

        // Get bump type from user if not provided
        if (!args.bumpType) {
          effectiveBumpMode = (await selectPrompt({
            title: `Select a bump type (current: ${projectVersion} from ${path.relative(process.cwd(), mainFile)})`,
            options: [
              {
                value: "patch",
                label: `patch (${projectVersion} → ${semver.inc(projectVersion, "patch")})`,
              },
              {
                value: "minor",
                label: `minor (${projectVersion} → ${semver.inc(projectVersion, "minor")})`,
              },
              {
                value: "major",
                label: `major (${projectVersion} → ${semver.inc(projectVersion, "major")})`,
              },
              {
                value: "auto",
                label: "auto (automatically determine bump type)",
              },
              {
                value: "manual",
                label: "manual (enter your own version)",
              },
            ],
          })) as BumpMode;

          // If manual selected, prompt for the version
          if (effectiveBumpMode === "manual") {
            const newCustomVersion = await inputPrompt({
              title: "Enter the version number",
              content: "Must be a valid semver (e.g., 1.2.3)",
              defaultValue: projectVersion,
              validate: (input: string) => {
                if (!semver.valid(input)) {
                  return "Please enter a valid semver version (e.g., 1.2.3)";
                }
                return true;
              },
            });
            sessionConfig.options.customVersion = newCustomVersion;
          }
        }

        sessionConfig.bumpType = effectiveBumpMode;
        validateBumpConfig(
          effectiveBumpMode,
          sessionConfig.options.customVersion,
        );
        await bumpVersionWithAnalysis(
          effectiveBumpMode,
          filesToBumpArr,
          sessionConfig.options,
          dlerConfig.bumpSet,
        );
      }
    } catch (error) {
      relinka("error", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    relinka("log", " ");
    await showEndPrompt();
  },
});

await runMain(main);

async function showStartPrompt(isDev: boolean, currentVersion: string) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole: false,
    packageName: "bleump",
    packageVersion: currentVersion,
    isDev,
  });
}

async function showEndPrompt() {
  await endPrompt({
    title:
      "❤️  Please support bleump: https://github.com/sponsors/blefnk\n│  📝  Feedback: https://github.com/blefnk/bleump/issues",
    titleColor: "dim",
  });
}
```

## Coming Soon

- [ ] 🤖 Auto-commit and push
- [ ] 📝 Smart commit messages
- [ ] 📋 Changelog generation
- [ ] 🔄 More version patterns
- [ ] 🏷️ Auto-tagging

## Contributing

Got ideas? Found a bug? We'd love your help! Check out our [issues](https://github.com/reliverse/bleump/issues) or submit a PR.

## License

MIT © [Nazar Kornienko (blefnk)](https://github.com/blefnk), [Reliverse](https://github.com/reliverse)
