#!/usr/bin/env bun

/**
 * Script to prepare a fresh relinter codebase from relinter repositories
 *
 * Usage:
 *   bun scripts/codemods/0-init-relinter.ts
 *   bun scripts/codemods/0-init-relinter.ts --cwd /path/to/dir
 *   bun scripts/codemods/0-init-relinter.ts --fresh-clone
 *
 * This script orchestrates the creation of a fresh relinter codebase by calling:
 * 1. 1-clone-repos.ts - Clones repositories with caching and sets up dependencies
 * 2. 2-oxc-to-relinter.ts - Rebrands everything from oxc to relinter
 * 3. 3-migrate-to-bun.ts - Converts from pnpm to bun
 */

import { error, success, info, log, parseArgs, isRelinterProject } from './utils';
import { runCloneRepos } from './1-clone-repos';
import { runOxcToRelinter } from './2-oxc-to-relinter';
import { runMigrateToBun } from './3-migrate-to-bun';

/**
 * Parse command line arguments
 */
function parseArguments(): { dryRun: boolean; freshClone: boolean; verbose: boolean; cwd: string } {
  const parsed = parseArgs(['fresh-clone']);
  return {
    dryRun: parsed.dryRun,
    freshClone: parsed['fresh-clone'] as boolean,
    verbose: parsed.verbose,
    cwd: parsed.cwd,
  };
}

/**
 * Main function
 */
async function main() {
  try {
    const { dryRun, freshClone, verbose, cwd } = parseArguments();

    // Check if already a relinter project
    const isAlreadyRelinter = isRelinterProject(cwd || '.');

    if (isAlreadyRelinter) {
      log('🚀 Detected existing relinter project. Running transformations only...', 'cyan');
      log('Skipping repository cloning step.', 'cyan');
    } else {
      log('🚀 Preparing fresh relinter codebase from relinter repositories...', 'cyan');
    }

    if (dryRun) {
      log('🔍 DRY RUN MODE - No changes will be made', 'yellow');
    }
    if (freshClone) {
      log('🆕 FRESH CLONE MODE - Will ignore cached repositories', 'yellow');
    }
    log('');

    // Step 1: Clone repositories in init mode (skip if already relinter project)
    if (!isAlreadyRelinter) {
      info('Step 1/3: Cloning repositories...');
      await runCloneRepos({ dryRun, freshClone, initMode: true, verbose, cwd });
      success('Completed fresh codebase creation');
    } else {
      info('Step 1/3: Skipping repository cloning (already a relinter project)');
      success('Skipped cloning step');
    }

    // Step 2: Run oxc-to-relinter migration
    info('Step 2/3: Running oxc-to-relinter migration...');
    await runOxcToRelinter({ dryRun, verbose, cwd });
    success('Completed oxc-to-relinter migration');

    // Step 3: Run migrate-to-bun
    info('Step 3/3: Running migrate-to-bun...');
    await runMigrateToBun({ dryRun, verbose, cwd });
    success('Completed migrate-to-bun migration');

    log('');
    success('🎉 Fresh relinter codebase preparation completed successfully!');

    if (!dryRun) {
      log('');
      log('Next steps:', 'cyan');
      log('1. Review the migrated codebase');
      log('2. Test that builds work: bun run build');
      log('3. Run tests: bun test');
      log('4. Commit the changes');
    }

  } catch (err) {
    error(`Preparation failed: ${err}`);
    process.exit(1);
  }
}

// Run the script
main();
