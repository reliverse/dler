#!/usr/bin/env bun

/**
 * Migration script to convert relinter codebase from pnpm/node to bun
 *
 * Usage:
 *   bun scripts/codemods/3-migrate-to-bun.ts
 *   bun migrate-to-bun
 *
 * What it does:
 * - Replaces all "pnpm run" with "bun" in package.json scripts
 * - Replaces all "node scripts/" with "bun scripts/" in package.json scripts
 * - Replaces all "@types/node" with "@types/bun"
 * - Updates justfile to use bun instead of pnpm
 * - Converts apps/relfmt/scripts/build.js to TypeScript with proper types
 * - Updates documentation files (README.md, AGENTS.md, etc.)
 * - Updates VS Code tasks in vite-task.json
 * - Updates Rust source files that reference pnpm commands
 * - Updates shell scripts (init.sh, etc.)
 * - Migrates workspace configuration from pnpm-workspace.yaml to package.json
 * - Removes pnpm-workspace.yaml and pnpm-lock.yaml files
 * - Fixes workspace link dependencies ("link:" to "workspace:*")
 * - Cleans up invalid workspace references
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { error, success, info, warning, log, parseArgs, findFiles, createBatchFileProcessor, isAlreadyMigratedToBun, type BatchFileProcessor } from './utils';

// Configuration object for all migration settings
const CONFIG = {
  bunVersion: '1.3.5',
  nodeTypesVersion: '24.1.0',
  bunTypesVersion: '1.3.5',
  ignoredDirs: ['node_modules', '.git'],
  fileExtensions: ['.json', '.md', '.ts', '.js', '.rs', '.sh'] as const,
  replacements: {
    // Script command replacements
    'pnpm run ': 'bun ',
    'pnpm -C ': 'bun -C ',
    'pnpm ': 'bun ',
    'node scripts/': 'bun scripts/',
    'node ./': 'bun ./',
    'node --run ': 'bun ',
    'node apps/': 'bun apps/',
    'node tasks/': 'bun tasks/',

    // Dependency replacements
    '@types/node': '@types/bun',

    // Documentation replacements
    'pnpm install': 'bun install',
    'pnpm test': 'bun test',
    'pnpm build-test': 'bun build-test',
    'pnpm t': 'bun test',

    // Prerequisites update
    'Prerequisites: Rust (MSRV: 1.91), Node.js, pnpm, just': 'Prerequisites: Rust (MSRV: 1.91), Node.js, bun, just',

    // Workspace link replacements
    '"link:../../npm/runtime"': '"workspace:*"',
    '"link:../../napi/minify"': '"workspace:*"',
    '"link:../../napi/transform"': '"workspace:*"',

    // Rust command replacements
    'Command::new("pnpm")': 'Command::new("bun")',

    // Shell script replacements
    'pnpm install --ignore-workspace': 'bun install --ignore-workspace',
  } as const,
} as const;


/**
 * Migrate package.json scripts from pnpm to bun
 */
function migratePackageJsonScripts(processor: BatchFileProcessor): void {
  info('Migrating package.json scripts from pnpm to bun...');

  // Find all package.json files
  const packageJsonFiles = findFiles('.', {
    patterns: 'package.json',
    ignoredDirs: CONFIG.ignoredDirs,
  });

  for (const file of packageJsonFiles) {
    // Queue all script replacements
    for (const [oldStr, newStr] of Object.entries(CONFIG.replacements)) {
      if (oldStr.includes('pnpm') || oldStr.includes('node') || oldStr.includes('@types/node')) {
        processor.queueReplacement(file, oldStr, newStr);
      }
    }

    // Special handling for version-specific replacements
    processor.queueReplacement(file, `"@types/node": "${CONFIG.nodeTypesVersion}"`, `"@types/bun": "${CONFIG.bunTypesVersion}"`);
  }
}

/**
 * Migrate justfile from pnpm to bun
 */
function migrateJustfile(processor: BatchFileProcessor): void {
  info('Migrating justfile from pnpm to bun...');

  const justfilePath = 'justfile';
  if (!existsSync(justfilePath)) {
    warning('justfile not found, skipping...');
    return;
  }

  // Queue replacements for justfile-specific patterns
  const justfileReplacements = [
    '  pnpm install',
    'pnpm run ',
    'pnpm -C ',
    'node --run ',
    'node apps/',
    'node tasks/',
  ];

  for (const replacement of justfileReplacements) {
    if (CONFIG.replacements[replacement as keyof typeof CONFIG.replacements]) {
      processor.queueReplacement(justfilePath, replacement, CONFIG.replacements[replacement as keyof typeof CONFIG.replacements]);
    }
  }
}

/**
 * Migrate build scripts to TypeScript
 */
function migrateBuildScripts(dryRun: boolean, processor?: BatchFileProcessor): void {
  info('Migrating build scripts to TypeScript...');

  const buildJsPath = 'apps/relfmt/scripts/build.js';
  const buildTsPath = 'apps/relfmt/scripts/build.ts';

  if (existsSync(buildJsPath) && !existsSync(buildTsPath)) {
    info('Converting apps/relfmt/scripts/build.js to TypeScript...');

    const content = readFileSync(buildJsPath, 'utf8');

    // Add TypeScript types
    let tsContent = content
      .replace('const relfmtDirPath = join(import.meta.dirname, "..");', 'const relfmtDirPath: string = join(import.meta.dirname, "..");')
      .replace('const distDirPath = join(relfmtDirPath, "dist");', 'const distDirPath: string = join(relfmtDirPath, "dist");')
      .replace('let bindingsJs = readFileSync(bindingsPath, "utf8");', 'let bindingsJs: string = readFileSync(bindingsPath, "utf8");')
      .replace('const bindingsPath = join(relfmtDirPath, "src-js/bindings.js");', 'const bindingsPath: string = join(relfmtDirPath, "src-js/bindings.js");')
      .replace('bindingsJs = bindingsJs.replace(/require\\(\'@relfmt\\/binding-(.+?)\'\\)/g, (_, name) => {', 'bindingsJs = bindingsJs.replace(/require\\(\'@relfmt\\/binding-(.+?)\'\\)/g, (_, name: string): string => {')
      .replace('/**\n * Copy a file, creating parent directories if needed.\n * @param {string} srcPath - Source file path, absolute\n * @param {string} destPath - Destination file path, absolute\n * @returns {void}\n */\nfunction copyFile(srcPath, destPath) {', '/**\n * Copy a file, creating parent directories if needed.\n * @param srcPath - Source file path, absolute\n * @param destPath - Destination file path, absolute\n */\nfunction copyFile(srcPath: string, destPath: string): void {');

    if (!dryRun) {
      writeFileSync(buildTsPath, tsContent);
    }
    success('Created apps/relfmt/scripts/build.ts');

    // Update package.json to reference the new TypeScript file
    const packageJsonPath = 'apps/relfmt/package.json';
    if (processor) {
      processor.queueReplacement(packageJsonPath, '"build-js": "node scripts/build.ts",', '"build-js": "bun scripts/build.ts",');
    }

    info('Updated apps/relfmt/package.json to reference build.ts');
  } else if (existsSync(buildTsPath)) {
    info('apps/relfmt/scripts/build.ts already exists, skipping...');
  } else {
    warning('apps/relfmt/scripts/build.js not found, skipping build script migration...');
  }
}

/**
 * Update documentation files
 */
function updateDocumentation(processor: BatchFileProcessor): void {
  info('Updating documentation files...');

  const files = [
    'AGENTS.md',
    'apps/relfmt/AGENTS.md',
    'apps/relint/conformance/README.md',
    'tasks/e2e/README.md',
    'tasks/compat_data/README.md',
    'tasks/vscode_docs/README.md',
    'apps/relint/tsdown.config.ts',
  ];

  for (const file of files) {
    if (!existsSync(file)) continue;

    // Queue standard replacements
    for (const [oldStr, newStr] of Object.entries(CONFIG.replacements)) {
      if (oldStr.includes('pnpm')) {
        processor.queueReplacement(file, oldStr, newStr);
      }
    }

    // Special handling for AGENTS.md prerequisites
    if (file === 'AGENTS.md') {
      processor.queueReplacement(file, 'Prerequisites: Rust (MSRV: 1.91), Node.js, pnpm, just', 'Prerequisites: Rust (MSRV: 1.91), Node.js, bun, just');
    }
  }
}

/**
 * Update VS Code task configuration
 */
function updateVsCodeTasks(processor: BatchFileProcessor): void {
  info('Updating VS Code tasks...');

  const viteTaskPath = 'vite-task.json';
  if (existsSync(viteTaskPath)) {
    // Queue VS Code specific replacements
    processor.queueReplacement(viteTaskPath, '"pnpm run ', '"bun ');
    processor.queueReplacement(viteTaskPath, '"pnpm --filter ', '"bun --filter ');
    processor.queueReplacement(viteTaskPath, '"pnpm --workspace-concurrency=', '"bun --workspace-concurrency=');
  }
}

/**
 * Update Rust source files that reference pnpm
 */
function updateRustFiles(processor: BatchFileProcessor): void {
  info('Updating Rust source files...');

  const files = [
    'tasks/compat_data/src/main.rs',
  ];

  for (const file of files) {
    if (!existsSync(file)) continue;
    processor.queueReplacement(file, 'Command::new("pnpm")', 'Command::new("bun")');
  }
}

/**
 * Update shell scripts
 */
function updateShellScripts(processor: BatchFileProcessor): void {
  info('Updating shell scripts...');

  const files = [
    'apps/relint/conformance/init.sh',
  ];

  for (const file of files) {
    if (existsSync(file)) {
      processor.queueReplacement(file, 'pnpm install --ignore-workspace', 'bun install --ignore-workspace');
    }
  }
}

/**
 * Required workspace packages that should always be present
 */
const REQUIRED_WORKSPACE_PACKAGES = [
  "apps/*",
  "napi/*",
  "wasm/*",
  "npm/*",
  "editors/*",
  "plugins/",
  "tasks/e2e",
  "tasks/transform_conformance",
  "tasks/compat_data",
  "scripts"
] as const;

/**
 * Required catalog entries for bun workspace
 */
const REQUIRED_CATALOG = {
  "@arethetypeswrong/core": "0.18.2",
  "@napi-rs/cli": "3.5.1",
  "@napi-rs/wasm-runtime": "1.1.0",
  "@types/bun": "1.3.5",
  "cross-env": "^10.1.0",
  "eslint": "9.36.0",
  "publint": "0.3.15",
  "rolldown": "1.0.0-beta.59",
  "tsdown": "0.18.4",
  "typescript": "5.9.3",
  "vitest": "4.0.15"
} as const;

/**
 * Migrate workspace configuration from pnpm-workspace.yaml to package.json
 */
function migrateWorkspaceConfig(dryRun: boolean) {
  info('Migrating workspace configuration from pnpm-workspace.yaml to package.json...');

  const pnpmWorkspacePath = 'pnpm-workspace.yaml';
  const packageJsonPath = 'package.json';

  if (!existsSync(packageJsonPath)) {
    error('package.json not found, cannot migrate workspace config');
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let packagesFromYaml: string[] = [];

    // Extract packages from pnpm-workspace.yaml if it exists
    if (existsSync(pnpmWorkspacePath)) {
      const pnpmWorkspace = readFileSync(pnpmWorkspacePath, 'utf8');

      // Extract onlyBuiltDependencies
      const onlyBuiltDepsMatch = pnpmWorkspace.match(/onlyBuiltDependencies:\s*\n((?:\s*-\s*".*"\s*\n)*)/);
      if (onlyBuiltDepsMatch) {
        const deps = onlyBuiltDepsMatch[1].split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim().replace(/"/g, ''));
        if (deps.length > 0) {
          packageJson.onlyBuiltDependencies = deps;
          success('Added onlyBuiltDependencies to package.json');
        }
      }

      // Extract patchedDependencies
      const patchedDepsMatch = pnpmWorkspace.match(/patchedDependencies:\s*\n((?:\s*.*:\s*patches\/.*\n)*)/);
      if (patchedDepsMatch) {
        const deps: { [key: string]: string } = {};
        patchedDepsMatch[1].split('\n')
          .filter(line => line.trim() && line.includes(':'))
          .forEach(line => {
            const [key, value] = line.trim().split(':').map(s => s.trim());
            deps[key] = value;
          });
        if (Object.keys(deps).length > 0) {
          packageJson.patchedDependencies = deps;
          success('Added patchedDependencies to package.json');
        }
      }

      // Extract workspace packages from pnpm-workspace.yaml
      const packagesMatch = pnpmWorkspace.match(/packages:\s*\n((?:\s*-\s*".*"\s*\n)*)/);
      if (packagesMatch) {
        packagesFromYaml = packagesMatch[1].split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim().replace(/"/g, ''));
      }
    } else {
      info('pnpm-workspace.yaml not found, will ensure required packages are present...');
    }

    // Merge required packages with packages from yaml (or existing packages)
    const existingPackages = packageJson.workspaces?.packages || [];
    const requiredPackagesSet = new Set(REQUIRED_WORKSPACE_PACKAGES);
    const additionalPackages = new Set<string>();

    // Collect additional packages from yaml (if migrating) or existing packages
    const sourcePackages = packagesFromYaml.length > 0 ? packagesFromYaml : existingPackages;
    for (const pkg of sourcePackages) {
      if (!requiredPackagesSet.has(pkg)) {
        additionalPackages.add(pkg);
      }
    }

    // Build final packages array: required packages in order, then additional packages sorted
    const finalPackages = [
      ...REQUIRED_WORKSPACE_PACKAGES,
      ...Array.from(additionalPackages).sort()
    ];

    // Set catalog (ensure required entries are present, merge with existing)
    const existingCatalog = packageJson.workspaces?.catalog || packageJson.catalog || {};
    const hadRootCatalog = !!packageJson.catalog;

    packageJson.workspaces = {
      packages: finalPackages,
      catalog: {
        ...existingCatalog,
        ...REQUIRED_CATALOG  // Required catalog takes precedence to ensure correct versions
      }
    };

    // Remove root-level catalog if it existed (moved to workspaces.catalog)
    if (hadRootCatalog) {
      delete packageJson.catalog;
    }

    if (packagesFromYaml.length > 0) {
      success(`Set workspaces.packages in package.json (merged from pnpm-workspace.yaml with required packages)`);
    } else if (existingPackages.length > 0) {
      success(`Updated workspaces.packages in package.json (ensured required packages are present)`);
    } else {
      success('Set workspaces.packages in package.json (default with required packages)');
    }

    success('Set workspaces.catalog in package.json (ensured required entries are present)');

    // Update packageManager to bun
    packageJson.packageManager = 'bun@1.3.5';
    success('Updated packageManager to bun@1.3.5');

    if (!dryRun) {
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      success('Updated package.json with workspace configuration');
    } else {
      log('[DRY RUN] Would update package.json with workspace configuration', 'yellow');
    }

  } catch (err) {
    error(`Failed to migrate workspace configuration: ${err}`);
  }
}

/**
 * Remove old pnpm files
 */
function removeOldFiles(dryRun: boolean) {
  info('Removing old pnpm files...');

  const filesToRemove = [
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml'
  ];

  for (const file of filesToRemove) {
    if (existsSync(file)) {
      if (!dryRun) {
        unlinkSync(file);
        success(`Removed ${file}`);
      } else {
        log(`[DRY RUN] Would remove ${file}`, 'yellow');
      }
    }
  }
}

/**
 * Fix workspace link dependencies
 */
function fixWorkspaceLinks(processor: BatchFileProcessor): void {
  info('Fixing workspace link dependencies...');

  // Find all package.json files
  const packageJsonFiles = findFiles('.', {
    patterns: 'package.json',
    ignoredDirs: CONFIG.ignoredDirs,
  });

  for (const file of packageJsonFiles) {
    // Queue workspace link replacements
    for (const [oldStr, newStr] of Object.entries(CONFIG.replacements)) {
      if (oldStr.includes('link:')) {
        processor.queueReplacement(file, oldStr, newStr);
      }
    }
  }
}

/**
 * Clean up invalid workspace references
 */
function cleanupWorkspaceRefs(dryRun: boolean) {
  info('Cleaning up invalid workspace references...');

  const packageJsonPath = 'package.json';

  if (!existsSync(packageJsonPath)) {
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (packageJson.workspaces?.packages) {
      const originalLength = packageJson.workspaces.packages.length;
      packageJson.workspaces.packages = packageJson.workspaces.packages.filter((pkg: string) => {
        // Preserve glob patterns (containing *)
        if (pkg.includes('*')) {
          return true;
        }

        // For non-glob patterns, check if the directory exists
        const pkgPath = pkg.startsWith('./') ? pkg.substring(2) : pkg;
        return existsSync(pkgPath);
      });

      if (packageJson.workspaces.packages.length !== originalLength) {
        if (!dryRun) {
          writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          success(`Removed ${originalLength - packageJson.workspaces.packages.length} invalid workspace references`);
        } else {
          log(`[DRY RUN] Would remove ${originalLength - packageJson.workspaces.packages.length} invalid workspace references`, 'yellow');
        }
      } else {
        info('All workspace references are valid');
      }
    }

  } catch (err) {
    error(`Failed to cleanup workspace references: ${err}`);
  }
}

/**
 * Main migration function - can be called directly or via CLI
 */
export async function runMigrateToBun(options?: { dryRun?: boolean; verbose?: boolean; cwd?: string }): Promise<void> {
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
    verbose: options.verbose ?? false,
  } : parseArgs();
  const { dryRun, verbose } = parsed;

  // Check if already migrated to bun
  if (isAlreadyMigratedToBun('.')) {
    info('Project appears to already be migrated to bun.');
    info('Continuing with migration (safe to run multiple times)...');
  }

  log('🚀 Starting relinter codebase migration to bun...', 'cyan');
  if (dryRun) {
    log('🔍 DRY RUN MODE - No files will be modified', 'yellow');
  }
  log('This script will migrate the entire relinter codebase from pnpm/node to bun', 'cyan');
  log('');

  const processor = createBatchFileProcessor(dryRun);

  // Define operations
  const parallelOperations = [
    migratePackageJsonScripts,
    migrateJustfile,
    fixWorkspaceLinks,
    updateDocumentation,
    updateVsCodeTasks,
    updateRustFiles,
    updateShellScripts,
  ];

  try {
    // Sequential operations that depend on file system state
    migrateWorkspaceConfig(dryRun);
    removeOldFiles(dryRun);
    cleanupWorkspaceRefs(dryRun);
    migrateBuildScripts(dryRun, processor);

    // Process all file operations in parallel
    await Promise.all(parallelOperations.map(async (operation) => {
      try {
        operation(processor);
      } catch (err) {
        error(`Failed in ${operation.name}: ${err}`);
        throw err;
      }
    }));

    // Apply all batched file operations
    info('Applying file changes...');
    const { processed, modified } = processor.applyAll();

    log('');
    success('🎉 Migration from pnpm/node to bun completed successfully!');
    log('');
    log('Summary of changes:', 'yellow');
    log(`• ${processed} files processed, ${modified} files modified`);
    log('• Workspace configuration migrated from pnpm-workspace.yaml to package.json');
    log('• onlyBuiltDependencies and patchedDependencies moved to package.json');
    log('• pnpm-workspace.yaml and pnpm-lock.yaml removed');
    log('• Workspace link dependencies fixed ("link:" → "workspace:*")');
    log('• Invalid workspace references cleaned up');
    log('• All package.json scripts now use "bun" instead of "pnpm run"');
    log('• All "node script" commands replaced with "bun script"');
    log('• All "@types/node" replaced with "@types/bun"');
    log('• apps/relfmt/scripts/build.js converted to TypeScript');
    log('• justfile updated to use bun commands');
    log('• Documentation updated');
    log('• VS Code tasks updated');
    log('• Rust source files updated');
    log('');
  } catch (err) {
    error(`Migration failed: ${err}`);
    throw err;
  }
}

/**
 * CLI entry point
 */
async function main() {
  try {
    await runMigrateToBun();
  } catch (err) {
    process.exit(1);
  }
}

// Run the migration if called directly
if (process.argv[1]?.endsWith('3-migrate-to-bun.ts')) {
  main();
}
