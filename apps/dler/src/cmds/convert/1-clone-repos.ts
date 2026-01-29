#!/usr/bin/env bun

/**
 * Script to clone external repositories and set up local dependencies
 *
 * Usage:
 *   bun scripts/codemods/1-clone-repos.ts
 *   bun scripts/codemods/1-clone-repos.ts --dry-run
 *   bun scripts/codemods/1-clone-repos.ts --fresh-clone
 *   bun scripts/codemods/1-clone-repos.ts --init
 *   bun scripts/codemods/1-clone-repos.ts --cwd /path/to/dir
 *
 * This script clones reliverse/relinter and reliverse/relinter-miette repositories
 * to a temp directory (cached for 12 hours) and updates Cargo.toml to use local
 * relinter-miette instead of external dependency.
 *
 * Options:
 *   --dry-run      Show what would be done without making changes
 *   --fresh-clone  Force fresh clone instead of using cached repositories
 *   --init         Init mode: clone relinter directly into current directory (for new projects)
 *   --cwd <dir>    Change working directory before running
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, rmdirSync, unlinkSync, writeFileSync, cpSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir, homedir } from 'os';
import { error, success, info, warning, log, parseArgs, isDirectoryEmpty, isRelinterProject } from './utils';

/**
 * Get or create temporary directory for repositories with expiration
 */
function getTempReposDir(freshClone: boolean, dryRun: boolean): { tempDir: string; cacheExpired: boolean } {
  const tempBase = join(tmpdir(), 'relinter-repos-cache');
  const expirationHours = 12;
  const expirationMs = expirationHours * 60 * 60 * 1000;

  // Create temp directory if it doesn't exist
  if (!existsSync(tempBase)) {
    mkdirSync(tempBase, { recursive: true });
  }

  // Check for existing cache
  const cacheInfoPath = join(tempBase, '.cache-info.json');
  let cacheExpired = false;

  if (!freshClone && existsSync(cacheInfoPath)) {
    try {
      const cacheInfo = JSON.parse(readFileSync(cacheInfoPath, 'utf8'));
      const cacheAge = Date.now() - cacheInfo.timestamp;

      if (cacheAge < expirationMs) {
        info(`Using cached repositories (created ${Math.round(cacheAge / (60 * 60 * 1000))} hours ago)`);
        return { tempDir: tempBase, cacheExpired: false };
      } else {
        info('Cached repositories expired, will refresh');
        cacheExpired = true;
      }
    } catch (err) {
      warning('Could not read cache info, will refresh');
      cacheExpired = true;
    }
  }

  // Remove old cache if it exists or cache expired
  if (existsSync(cacheInfoPath) && cacheExpired) {
    try {
      const items = readdirSync(tempBase);
      for (const item of items) {
        if (item !== '.cache-info.json') {
          const itemPath = join(tempBase, item);
          rmdirSync(itemPath, { recursive: true });
        }
      }
    } catch (err) {
      warning('Could not clean old cache directory');
    }
  }

  // Create new cache info
  const cacheInfo = {
    timestamp: Date.now(),
    expirationHours
  };

  if (!dryRun) {
    writeFileSync(cacheInfoPath, JSON.stringify(cacheInfo, null, 2));
  }

  return { tempDir: tempBase, cacheExpired };
}

/**
 * Copy repository from temp directory to final location
 */
function copyRepoToFinalLocation(tempPath: string, finalPath: string, dryRun: boolean, verbose: boolean): boolean {
  try {
    if (dryRun) {
      if (verbose) {
        log(`[DRY RUN] Would copy: ${tempPath} -> ${finalPath}`, 'yellow');
      }
      return true;
    }

    // Ensure parent directory exists
    const parentDir = dirname(finalPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Copy the repository
    cpSync(tempPath, finalPath, { recursive: true });
    if (verbose) {
      success(`Copied repository to ${finalPath}`);
    }
    return true;
  } catch (err) {
    error(`Failed to copy repository from ${tempPath} to ${finalPath}: ${err}`);
    return false;
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): { dryRun: boolean; freshClone: boolean; initMode: boolean; verbose: boolean; cwd: string } {
  const parsed = parseArgs(['fresh-clone', 'init']);
  return {
    dryRun: parsed.dryRun,
    freshClone: parsed['fresh-clone'] as boolean,
    initMode: parsed['init'] as boolean,
    verbose: parsed.verbose,
    cwd: parsed.cwd,
  };
}

/**
 * Clone a repository to a temporary directory
 */
function cloneRepositoryToTemp(repoUrl: string, tempDir: string, repoName: string, dryRun: boolean, verbose: boolean): boolean {
  const tempPath = join(tempDir, repoName);

  try {
    if (verbose) {
      info(`Cloning ${repoUrl} to temp directory...`);
    }

    if (dryRun) {
      if (verbose) {
        log(`[DRY RUN] Would clone: git clone ${repoUrl} ${tempPath}`, 'yellow');
      }
      return true;
    }

    // Remove existing temp repo if it exists
    if (existsSync(tempPath)) {
      rmdirSync(tempPath, { recursive: true });
    }

    // Clone the repository
    execSync(`git clone ${repoUrl} ${tempPath}`, { stdio: verbose ? 'inherit' : 'pipe' });
    if (verbose) {
      success(`Successfully cloned ${repoUrl} to temp`);
    }
    return true;
  } catch (err) {
    error(`Failed to clone ${repoUrl}: ${err}`);
    return false;
  }
}

/**
 * Handle license and project files for the cloned repository
 */
function handleLicenseFiles(dryRun: boolean): boolean {
  const projectRoot = join(__dirname, '..', '..');
  const relinterLicensePath = join(projectRoot, 'LICENSE');
  const relinterGitignorePath = join(projectRoot, '.gitignore');

  try {
    info('Handling license and project files...');

    // Delete the relinter LICENSE file
    if (existsSync(relinterLicensePath)) {
      if (!dryRun) {
        unlinkSync(relinterLicensePath);
      }
      info('Deleted relinter LICENSE file');
    }

    // Create new LICENSE file with relinter content
    if (!dryRun) {
      const relinterLicenseContent = readFileSync(relinterLicensePath, 'utf8');
      writeFileSync(relinterLicensePath, relinterLicenseContent);
    }
    success('Created new LICENSE file');

    // Delete the relinter .gitignore file
    if (existsSync(relinterGitignorePath)) {
      if (!dryRun) {
        unlinkSync(relinterGitignorePath);
      }
      info('Deleted relinter .gitignore file');
    }

    // Create new .gitignore file with specified content
    if (!dryRun) {
      const gitignoreContent = `# Rust
target/
**/*.rs.bk

# Wasm
**/*.wasm

# node_modules
/node_modules/
/website/node_modules/
/benchmark/node_modules/
/tasks/benchmark/codspeed/node_modules/
/tasks/transform_conformance/node_modules/
/tasks/compat_data/node_modules/
/tasks/compat_data/compat-table/
/tasks/e2e/node_modules/
/plugins/node_modules/
/tasks/e2e/tests/nestjs/node_modules/
/npm/*/node_modules
/napi/*/npm-dir

# vscode
/editors/vscode/.vscode-test/
/editors/vscode/node_modules/
/editors/vscode/icon.png
/editors/vscode/out/
/editors/vscode/out_test/
/editors/vscode/*.vsix
/editors/vscode/test_workspace/
/editors/vscode/test_workspace_second/
/editors/vscode/*.test.code-workspace

# Cloned conformance repos
tasks/coverage/babel/
tasks/coverage/test262/
tasks/coverage/typescript/
tasks/coverage/estree-conformance/
tasks/coverage/estree-conformance-diff/
tasks/coverage/node-compat-table/
tasks/prettier_conformance/prettier/

# Ignore accidental files from the root
/*.js
/*.jsx
/*.ts
/*.tsx
/*.ast.txt
/*.cfg.txt
/*.dot

# https://github.com/oraios/serena cache
.serena/cache

.claude

# NOTE: For non-project files such as '.vscode' or '.idea', please add them to your '.gitignore_global'.
# In '.gitconfig', add '[core] excludesfile = ~/.gitignore_global'
# See also
# * https://stackoverflow.com/a/7335487
# * https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files#configuring-ignored-files-for-all-repositories-on-your-computer
`;
      writeFileSync(relinterGitignorePath, gitignoreContent);
    }
    success('Created new .gitignore file');

    // Generate LICENSES file content
    if (!dryRun) {
      const licensesContent = generateLicensesContent();
      writeFileSync('LICENSES', licensesContent);
    }
    success('Created LICENSES file');

    return true;
  } catch (err) {
    error(`Failed to handle license and project files: ${err}`);
    return false;
  }
}

/**
 * Generate LICENSES content with commit hashes from cloned repositories
 */
function generateLicensesContent(): string {
  // Get commit hashes from cloned repositories
  let relinterCommit = 'latest';
  let relinterMietteCommit = 'latest';

  try {
    // Get relinter commit hash (from current directory since relinter is cloned there)
    relinterCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 7);
  } catch (err) {
    // Fallback if git command fails
    relinterCommit = 'latest';
  }

  try {
    // Get relinter-miette commit hash from the cloned repository
    relinterMietteCommit = execSync('cd vendor/relinter-miette && git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 7);
  } catch (err) {
    // Fallback if git command fails
    relinterMietteCommit = 'latest';
  }

  return `LICENSES

---

MIT License

Copyright (c) 2026 Nazar Kornienko (reliverse), Bleverse, Reliverse

See LICENSE file for full license text.

---

NOTICES

Some parts of this project are based on and significantly adapt:
- https://github.com/oxc-project/oxc/tree/${relinterCommit} - MIT © 2023 Boshen, 2024-present VoidZero Inc. & Contributors
- https://github.com/oxc-project/oxc-miette/tree/${relinterMietteCommit} - Apache-2.0 © Zkat
`;
}

/**
 * Clone multiple repositories to temp directory and copy to final locations
 */
function cloneRepositories(dryRun: boolean, freshClone: boolean, initMode: boolean, verbose: boolean): boolean {
  const { tempDir, cacheExpired } = getTempReposDir(freshClone, dryRun);
  // Force fresh clone if cache expired
  const effectiveFreshClone = freshClone || cacheExpired;

  let repositories;
  if (initMode) {
    // In init mode, clone relinter directly into current directory
    repositories = [
      {
        url: 'https://github.com/oxc-project/oxc',
        tempName: 'oxc',
        finalPath: '.',  // Clone directly into current directory
        description: 'oxc repository (init mode)',
        isInitClone: true
      },
      {
        url: 'https://github.com/oxc-project/oxc-miette',
        tempName: 'oxc-miette',
        finalPath: 'vendor/relinter-miette',
        description: 'relinter-miette dependency'
      }
    ];
  } else {
    // Normal mode: clone as dependencies
    repositories = [
      {
        url: 'https://github.com/oxc-project/oxc',
        tempName: 'oxc',
        finalPath: 'oxc-project/oxc',
        description: 'oxc repository'
      },
      {
        url: 'https://github.com/oxc-project/oxc-miette',
        tempName: 'oxc-miette',
        finalPath: 'vendor/relinter-miette',
        description: 'relinter-miette dependency'
      }
    ];
  }

  // Clone all repositories to temp directory
  for (const repo of repositories) {
    const tempPath = join(tempDir, repo.tempName);

    // Check if we already have this repo in temp (and not doing fresh clone)
    if (!effectiveFreshClone && existsSync(tempPath)) {
      info(`Using cached ${repo.description}`);
    } else {
      if (!cloneRepositoryToTemp(repo.url, tempDir, repo.tempName, dryRun, verbose)) {
        return false;
      }
    }

    if (!dryRun && !verifyRepository(tempPath)) {
      return false;
    }

    // Special handling for init mode relinter clone
    if (repo.isInitClone) {
      // Check if current directory is already a relinter project
      if (isRelinterProject('.')) {
        info('Directory is already a relinter project. Skipping clone step.');
        return true; // Skip cloning but return success
      }

      // Check if current directory is empty before cloning relinter into it
      if (!isDirectoryEmpty('.')) {
        error('Current directory is not empty and is not a relinter project. Please run in an empty directory for init mode, or ensure package.json contains "name": "relinter".');
        return false;
      }
    }

    // Skip copying if target already exists (unless doing fresh clone or dry run)
    if (existsSync(repo.finalPath)) {
      if (effectiveFreshClone && !dryRun) {
        // In fresh clone mode, we want to overwrite, so continue
        info(`Target ${repo.finalPath} exists but will be overwritten (fresh clone mode)`);
      } else {
        info(`Target ${repo.finalPath} already exists. Skipping copy.`);
        continue;
      }
    }

    // Copy from temp to final location
    if (!copyRepoToFinalLocation(tempPath, repo.finalPath, dryRun, verbose)) {
      return false;
    }

    // Remove .git directory from the cloned repository
    if (!repo.isInitClone) {
      removeGitDirectory(repo.finalPath, dryRun, verbose);
    }
  }

  return true;
}

/**
 * Update Cargo.toml to use local miette dependency
 */
function updateCargoTomlForMiette(dryRun: boolean): boolean {
  // Use the original working directory (before --cwd changes it)
  const originalCwd = process.cwd();
  const scriptDir = __dirname;
  const projectRoot = join(scriptDir, '..', '..');
  const cargoTomlPath = join(projectRoot, 'Cargo.toml');

  try {
    if (!existsSync(cargoTomlPath)) {
      error(`Cargo.toml not found at ${cargoTomlPath}`);
      return false;
    }

    info('Updating Cargo.toml to use local relinter-miette...');

    let cargoTomlContent = readFileSync(cargoTomlPath, 'utf8');

    // Replace the external miette dependencies with local paths
    const replacements = [
      {
        from: 'miette = { package = "relinter-miette", version = "2.7.0", features = [\n  "fancy-no-syscall",\n] }',
        to: 'miette = { path = "vendor/relinter-miette", package = "relinter-miette", features = [\n  "fancy-no-syscall",\n] }'
      },
      {
        from: 'relinter-miette = { package = "relinter-miette", version = "2.7.0", features = [\n  "fancy-no-syscall",\n] }',
        to: 'relinter-miette = { path = "vendor/relinter-miette", package = "relinter-miette", features = [\n  "fancy-no-syscall",\n] }'
      }
    ];

    let updated = false;
    for (const { from, to } of replacements) {
      if (cargoTomlContent.includes(from)) {
        if (dryRun) {
          log(`[DRY RUN] Would replace in Cargo.toml:`, 'yellow');
          log(`  FROM: ${from.replace(/\n/g, '\\n')}`, 'yellow');
          log(`  TO: ${to.replace(/\n/g, '\\n')}`, 'yellow');
        } else {
          cargoTomlContent = cargoTomlContent.replace(from, to);
        }
        updated = true;
      }
    }

    if (updated && !dryRun) {
      writeFileSync(cargoTomlPath, cargoTomlContent);
      success('Updated Cargo.toml to use local relinter-miette');
    } else if (!updated) {
      warning('No miette dependencies found to update in Cargo.toml');
    }

    return true;
  } catch (err) {
    error(`Failed to update Cargo.toml: ${err}`);
    return false;
  }
}

/**
 * Verify that the cloned repository has the expected structure
 */
function verifyRepository(localPath: string): boolean {
  try {
    info(`Verifying repository at ${localPath}...`);

    if (!existsSync(localPath)) {
      error(`Repository directory ${localPath} does not exist`);
      return false;
    }

    // Check for basic repository structure
    if (!existsSync(join(localPath, 'Cargo.toml'))) {
      error(`Cargo.toml not found in ${localPath}`);
      return false;
    }

    success(`Repository verification passed for ${localPath}`);
    return true;
  } catch (err) {
    error(`Failed to verify repository: ${err}`);
    return false;
  }
}

/**
 * Remove .git directory from a cloned repository
 */
function removeGitDirectory(repoPath: string, dryRun: boolean, verbose: boolean): void {
  const gitPath = join(repoPath, '.git');

  if (!existsSync(gitPath)) {
    if (verbose) {
      info(`No .git directory found in ${repoPath}`);
    }
    return;
  }

  try {
    if (dryRun) {
      if (verbose) {
        log(`[DRY RUN] Would remove .git directory: ${gitPath}`, 'yellow');
      }
    } else {
      rmdirSync(gitPath, { recursive: true });
      if (verbose) {
        info(`Removed .git directory from ${repoPath}`);
      }
    }
  } catch (err) {
    error(`Failed to remove .git directory ${gitPath}: ${err}`);
  }
}

/**
 * Main function - can be called directly or via CLI
 */
export async function runCloneRepos(options?: { dryRun?: boolean; freshClone?: boolean; initMode?: boolean; verbose?: boolean; cwd?: string }): Promise<void> {
  try {
    // Handle cwd if provided
    if (options?.cwd) {
      let cwd = options.cwd;
      if (cwd.startsWith('~')) {
        cwd = join(homedir(), cwd.slice(1));
      }
      if (!existsSync(cwd)) {
        mkdirSync(cwd, { recursive: true });
      }
      process.chdir(cwd);
    }

    // If called from CLI, parse arguments; otherwise use provided options
    const parsed = options ? {
      dryRun: options.dryRun ?? false,
      freshClone: options.freshClone ?? false,
      initMode: options.initMode ?? false,
      verbose: options.verbose ?? false,
      cwd: options.cwd ?? process.cwd(),
    } : parseArguments();
    const { dryRun, freshClone, initMode, verbose } = parsed;

    // Check if already a relinter project (skip cloning if so)
    if (isRelinterProject('.')) {
      info('Directory is already a relinter project. Skipping repository cloning.');
      success('🎉 Relinter project detected. Skipping clone step.');
      return;
    }

    if (initMode) {
      log('🚀 Initializing fresh relinter codebase...', 'cyan');
      log('Will clone oxc directly into current directory', 'cyan');
    } else {
      log('🚀 Setting up local repositories...', 'cyan');
      log('Will clone repositories as dependencies', 'cyan');
    }

    if (dryRun) {
      log('🔍 DRY RUN MODE - No changes will be made', 'yellow');
    }
    if (freshClone) {
      log('🆕 FRESH CLONE MODE - Will ignore cached repositories', 'yellow');
    }
    log('Will use temp directory cache (12h expiration)', 'cyan');

    if (!initMode) {
      log('Will remove .git directories from cloned repositories', 'cyan');
      log('Will update LICENSE and .gitignore files', 'cyan');
    }
    log('');

    // Clone repositories
    if (!cloneRepositories(dryRun, freshClone, initMode, verbose)) {
      process.exit(1);
    }

    // Skip the rest in init mode (handled by transformation scripts)
    // Also skip if already a relinter project
    if (!initMode && !isRelinterProject('.')) {
      // Handle license and project files
      if (!handleLicenseFiles(dryRun)) {
        process.exit(1);
      }

      // Update Cargo.toml
      if (!updateCargoTomlForMiette(dryRun)) {
        process.exit(1);
      }
    }

    log('');
    if (initMode) {
      success('🎉 Fresh relinter codebase initialized successfully!');
      if (!dryRun) {
        log('');
        log('Next steps:', 'cyan');
        log('1. Run transformation scripts to convert to relinter');
        log('2. Test that builds work: bun run build');
        log('3. Run tests: bun test');
      }
    } else {
      success('🎉 Local repository setup completed successfully!');
      if (!dryRun) {
        log('');
        log('Next steps:', 'cyan');
        log('1. Review the changes in Cargo.toml');
        log('2. Run `cargo check` to verify the local dependency works');
        log('3. Commit the changes if everything looks good');
      }
    }

  } catch (err) {
    error(`Setup failed: ${err}`);
    throw err;
  }
}

/**
 * CLI entry point
 */
async function main() {
  try {
    await runCloneRepos();
  } catch (err) {
    process.exit(1);
  }
}

// Run the script if called directly
if (process.argv[1]?.endsWith('1-clone-repos.ts')) {
  main();
}
