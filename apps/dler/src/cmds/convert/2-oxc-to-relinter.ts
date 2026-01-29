#!/usr/bin/env bun

/**
 * Comprehensive branding script to rename oxc to relinter across the entire codebase
 *
 * Usage:
 *   bun scripts/codemods/2-oxc-to-relinter.ts                    # Run the migration
 *   bun scripts/codemods/2-oxc-to-relinter.ts --dry-run          # Preview changes without modifying files
 *   bun scripts/codemods/2-oxc-to-relinter.ts --debug            # Show all files containing 'oxc' references
 *
 * What it does:
 * - Renames all package names from oxc-* to relinter-*
 * - Renames all crate names from oxc_* to relinter_*
 * - Renames binary names (oxlint -> relint, oxfmt -> relfmt, etc.)
 * - Renames directories (apps/oxlint -> apps/relint, apps/oxfmt -> apps/relfmt)
 * - Updates all documentation references with case-preserving replacements
 * - Updates configuration files (.json, .yml, .toml, etc.)
 * - Updates repository URLs and metadata
 * - Updates source code references (Rust, TypeScript, JavaScript)
 * - Updates Rust crate declarations and imports
 * - Updates Node.js package declarations
 * - Updates CI/CD configurations (.github, .gitlab-ci.yml, etc.)
 * - Updates editor integrations and extensions
 * - Updates author information and contributor references
 * - Handles case variations: oxc, Oxc, OXC, OxC, etc. → relinter, Relinter, RELINTER, etc.
 * - Processes hidden files and comprehensive file types
 */

import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import { error, success, info, warning, log, parseArgs, findFiles, createBatchFileProcessor, readFileContent, clearFileCache, isAlreadyMigratedFromOxc, type BatchFileProcessor } from './utils';

/**
 * Configuration manager for centralized replacement rule handling
 */
function createConfigManager() {
  const getReplacementRules = (fileType: string): Array<{
    config: Record<string, string>;
    prefix?: string;
    suffix?: string;
    skipKeys?: string[];
  }> => {
    const baseRules: Array<{
      config: Record<string, string>;
      prefix?: string;
      suffix?: string;
      skipKeys?: string[];
    }> = [
      { config: CONFIG.names },
      { config: CONFIG.urls },
      { config: CONFIG.testFilePaths },
      { config: CONFIG.linterDirectives },
      { config: CONFIG.identifiers },
      { config: CONFIG.stringLiterals },
      { config: CONFIG.commentRefs }
    ];

    switch (fileType) {
      case 'package.json':
        return [
          { config: CONFIG.packages, prefix: '"name": "' },
          { config: CONFIG.packages, prefix: '"@oxc-project/', suffix: '"' },
          { config: CONFIG.names, prefix: '"bin": "', skipKeys: ['relinter'] },
          { config: CONFIG.names, prefix: '"', suffix: '": ', skipKeys: ['relinter'] },
          { config: CONFIG.urls },
          { config: CONFIG.lspRefs }
        ];

      case 'Cargo.toml':
        return [
          { config: CONFIG.crates, prefix: 'name = "' },
          { config: CONFIG.crates, prefix: '"' },
          { config: CONFIG.names, prefix: 'name = "' },
          { config: CONFIG.urls },
          { config: CONFIG.authors }
        ];

      case 'rust':
        return [
          { config: CONFIG.crates, prefix: 'use ' },
          { config: CONFIG.crates, prefix: 'extern crate ' },
          { config: CONFIG.crates, prefix: 'pub use ' },
          { config: CONFIG.modulePaths },
          { config: CONFIG.lspRefs },
          { config: CONFIG.names, prefix: '"' },
          { config: CONFIG.urls },
          { config: CONFIG.linterDirectives },
          { config: CONFIG.commentRefs }
        ];

      case 'docs':
        return [
          { config: CONFIG.names },
          { config: CONFIG.packages },
          { config: CONFIG.packages, prefix: '@oxc-project/' },
          { config: CONFIG.urls },
          { config: CONFIG.crates },
          { config: CONFIG.authors },
          { config: CONFIG.commentRefs },
          { config: CONFIG.linterDirectives },
          { config: CONFIG.stringLiterals }
        ];

      case 'config':
        return [
          ...baseRules,
          { config: CONFIG.testFilePaths },
          { config: CONFIG.linterDirectives },
          { config: CONFIG.identifiers },
          { config: CONFIG.stringLiterals }
        ];

      default:
        return baseRules;
    }
  };

  const getCustomProcessors = (fileType: string) => {
    switch (fileType) {
      case 'package.json':
        return (file: string, processor: BatchFileProcessor) => {
          try {
            const content = readFileSync(file, 'utf8');
            let modifiedContent = content;

            // Skip renaming dependencies in root package.json
            if (basename(file) === 'package.json' && dirname(file) === '.') {
              const packageJson = JSON.parse(content);
              const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

              // Apply all other replacements but skip dependency names in dependency sections
              for (const replacement of getReplacementRules('package.json')) {
                for (const [oldValue, newValue] of Object.entries(replacement.config)) {
                  if (replacement.skipKeys?.includes(oldValue)) continue;

                  const prefix = replacement.prefix || '';
                  const suffix = replacement.suffix || '';
                  const oldStr = prefix ? `${prefix}${oldValue}${suffix}` : oldValue;
                  const newStr = prefix ? `${prefix}${newValue}${suffix}` : newValue;

                  // Skip if this is a dependency name in a dependency section
                  if (prefix === '"' && suffix === '": ') {
                    let shouldSkip = false;
                    for (const section of dependencySections) {
                      if (packageJson[section] && packageJson[section][oldValue]) {
                        shouldSkip = true;
                        break;
                      }
                    }
                    if (shouldSkip) continue;
                  }

                  modifiedContent = modifiedContent.replace(
                    new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                    newStr
                  );
                }
              }

              if (modifiedContent !== content) {
                processor.queueReplacement(file, content, modifiedContent);
              }
            } else {
              // For non-root package.json files, apply all replacements normally
              for (const replacement of getReplacementRules('package.json')) {
                for (const [oldValue, newValue] of Object.entries(replacement.config)) {
                  if (replacement.skipKeys?.includes(oldValue)) continue;

                  const prefix = replacement.prefix || '';
                  const suffix = replacement.suffix || '';
                  const oldStr = prefix ? `${prefix}${oldValue}${suffix}` : oldValue;
                  const newStr = prefix ? `${prefix}${newValue}${suffix}` : newValue;

                  processor.queueReplacement(file, oldStr, newStr);
                }
              }
            }
          } catch (err) {
            // Fall back to standard processing if JSON parsing fails
            for (const replacement of getReplacementRules('package.json')) {
              for (const [oldValue, newValue] of Object.entries(replacement.config)) {
                if (replacement.skipKeys?.includes(oldValue)) continue;

                const prefix = replacement.prefix || '';
                const suffix = replacement.suffix || '';
                const oldStr = prefix ? `${prefix}${oldValue}${suffix}` : oldValue;
                const newStr = prefix ? `${prefix}${newValue}${suffix}` : newValue;

                processor.queueReplacement(file, oldStr, newStr);
              }
            }
          }
        };

      case 'config':
        return (file: string, processor: BatchFileProcessor) => {
          // Skip package.json and Cargo.toml (handled separately)
          if (basename(file) === 'package.json' || basename(file) === 'Cargo.toml') return;

          // Special handling for specific config files
          if (basename(file) === 'oxlintrc.json') {
            processor.queueReplacement(file, 'oxlintrc.json', 'relinter.json');
          }
          if (basename(file) === 'oxfmtrc.jsonc') {
            processor.queueReplacement(file, 'oxfmtrc.jsonc', 'relfmtrc.jsonc');
          }

          // Special handling for CODEOWNERS file
          if (basename(file) === 'CODEOWNERS') {
            for (const [oldPath, newPath] of Object.entries(CONFIG.codeownersPaths)) {
              processor.queueReplacement(file, oldPath, newPath);
            }
          }
        };

      default:
        return undefined;
    }
  };

  return {
    getReplacementRules,
    getCustomProcessors
  };
}

// Configuration object for all branding changes
const CONFIG = {
  // Core name mappings (case variants will be handled by casePreservingReplacer)
  names: {
    oxc: 'relinter',
    oxlint: 'relint',
    oxfmt: 'relfmt',
    oxc_cli: 'relinter_cli',
    // Add more variants for comprehensive replacement
    'oxc-project': 'reliverse',
    'oxc_project': 'relinter_project',
    'oxcproject': 'relinterproject',
    'oxc-rs': 'relinter-rs',
    'oxc_rs': 'relinter_rs',
    'oxcrs': 'relinterrs',
  } as const,

  // Package name mappings
  packages: {
    'oxc': 'relinter',
    'oxlint': 'relint',
    'oxfmt': 'relfmt',
    'oxc-parser': 'relinter-parser',
    'oxc-minify': 'relinter-minify',
    'oxc-transform': 'relinter-transform',
    'oxc-types': 'relinter-types',
    'oxlint-plugin': 'relint-plugin',
  } as const,

  // Crate name mappings
  crates: {
    'oxc': 'relinter',
    'oxc_cli': 'relinter_cli',
    'oxc_parser': 'relinter_parser',
    'oxc_coverage': 'relinter_coverage',
    'oxc_tasks_common': 'relinter_tasks_common',
    'oxc_ast': 'relinter_ast',
    'oxc_ast_macros': 'relinter_ast_macros',
    'oxc_ast_visit': 'relinter_ast_visit',
    'oxc_cfg': 'relinter_cfg',
    'oxc_codegen': 'relinter_codegen',
    'oxc_compat': 'relinter_compat',
    'oxc_data_structures': 'relinter_data_structures',
    'oxc_diagnostics': 'relinter_diagnostics',
    'oxc_ecmascript': 'relinter_ecmascript',
    'oxc_estree': 'relinter_estree',
    'oxc_formatter': 'relinter_formatter',
    'oxc_isolated_declarations': 'relinter_isolated_declarations',
    'oxc_language_server': 'relinter_language_server',
    'oxc_linter': 'relinter_linter',
    'oxc_macros': 'relinter_macros',
    'oxc_mangler': 'relinter_mangler',
    'oxc_minifier': 'relinter_minifier',
    'oxc_napi': 'relinter_napi',
    'oxc_regular_expression': 'relinter_regular_expression',
    'oxc_semantic': 'relinter_semantic',
    'oxc_span': 'relinter_span',
    'oxc_syntax': 'relinter_syntax',
    'oxc_transformer': 'relinter_transformer',
    'oxc_transformer_plugins': 'relinter_transformer_plugins',
    'oxc_traverse': 'relinter_traverse',
  } as const,

  // Module path mappings (for use statements like oxc::span::Span)
  modulePaths: {
    'oxc::': 'relinter::',
    'crate::rules::oxc::': 'crate::rules::relinter::',
    'use oxc::{': 'use relinter::{',
    'use oxc::': 'use relinter::',
    'use crate::oxc::': 'use crate::relinter::',
    'use oxc ': 'use relinter ',
    'extern crate oxc': 'extern crate relinter',
    'pub use oxc::': 'pub use relinter::',
  } as const,

  // Comment/reference mappings (for documentation and examples)
  commentRefs: {
    'cargo run -p oxc': 'cargo run -p relinter',
    'cargo run --package oxc': 'cargo run --package relinter',
    'cargo test -p oxc': 'cargo test -p relinter',
    'cargo build -p oxc': 'cargo build -p relinter',
    'oxc --example': 'relinter --example',
    'oxlint --help': 'relint --help',
    'oxfmt --help': 'relfmt --help',
    'Oxfmt': 'Relfmt',
    'Oxfmt configuration': 'Relfmt configuration',
    'Oxfmt default': 'Relfmt default',
    'Oxfmt format': 'Relfmt format',
    'Oxfmt does not support': 'Relfmt does not support',
    'Oxlint': 'Relint',
    'Oxc': 'Relinter',
    'OXC': 'RELINTER',
    'oxc CLI': 'relinter CLI',
    'oxc tool': 'relinter tool',
    'oxc project': 'relinter project',
  } as const,

  // Linter directive mappings (for comment directives)
  linterDirectives: {
    'oxlint-disable': 'relint-disable',
    'oxlint-disable-next-line': 'relint-disable-next-line',
    'oxlint-disable-line': 'relint-disable-line',
  } as const,

  // Identifier name mappings (for variable/function names)
  identifiers: {
    'oxfmtrc': 'relfmtrc',
    'hasOxfmtrcFile': 'hasRelfmtrcFile',
    'createBlankOxfmtrcFile': 'createBlankRelfmtrcFile',
    'saveOxfmtrcFile': 'saveRelfmtrcFile',
  } as const,

  // String literal mappings (for paths and file names in strings)
  stringLiterals: {
    '.oxfmtrc.json': '.relfmtrc.json',
    '.oxfmtrc.jsonc': '.relfmtrc.jsonc',
    '.oxlintrc.json': '.relinter.json',
    'oxlintrc.json': 'relinter.json',
    'oxfmtrc.json': 'relfmtrc.json',
    'oxfmtrc.jsonc': 'relfmtrc.jsonc',
    'node_modules/oxfmt/': 'node_modules/relfmt/',
    'node_modules/oxlint/': 'node_modules/relint/',
    'node_modules/oxc/': 'node_modules/relinter/',
    'node_modules/@oxc-project/': 'node_modules/@reliverse/',
    'packages/oxc': 'packages/relinter',
    'packages/oxlint': 'packages/relint',
    'packages/oxfmt': 'packages/relfmt',
  } as const,

  // Test file path mappings
  testFilePaths: {
    'misc/fail/oxc-9525-2.js': 'misc/fail/relinter-9525-2.js',
    'misc/fail/oxc-9525-3.js': 'misc/fail/relinter-9525-3.js',
    'pass/oxc-1740.tsx': 'pass/relinter-1740.tsx',
    'pass/oxc-2087.ts': 'pass/relinter-2087.ts',
    'pass/oxc-3443.tsx': 'pass/relinter-3443.tsx',
    'pass/oxc-8193.ts': 'pass/relinter-8193.ts',
    'pass/oxc-9215.ts': 'pass/relinter-9215.ts',
    // Snapshot file path mappings
    'crates/oxc_isolated_declarations/tests/': 'crates/relinter_isolated_declarations/tests/',
    'crates/oxc_isolated_declarations/': 'crates/relinter_isolated_declarations/',
  } as const,

  // CODEOWNERS path mappings
  codeownersPaths: {
    '/apps/oxlint': '/apps/relint',
    '/apps/oxfmt': '/apps/relfmt',
    '/crates/oxc_': '/crates/relinter_',
    '/npm/oxc-types': '/npm/relinter-types',
    '/npm/oxlint': '/npm/relint',
    '/npm/oxfmt': '/npm/relfmt',
    '/plugins/oxlint-plugin': '/plugins/relint-plugin',
  } as const,

  // LSP and extension mappings
  lspRefs: {
    'source.fixAll.oxc': 'source.fixAll.relinter',
    'oxc.fixAll': 'relinter.fixAll',
    'oxc.restartServer': 'relinter.restartServer',
    'oxc.restartServerFormatter': 'relinter.restartServerFormatter',
    'oxc.toggleEnable': 'relinter.toggleEnable',
    'oxc.showOutputChannel': 'relinter.showOutputChannel',
    'oxc.showOutputChannelFormatter': 'relinter.showOutputChannelFormatter',
    'Boshen and oxc contributors': 'reliverse and relinter contributors',
    '"publisher": "oxc"': '"publisher": "relinter"',
    '"publisher": "oxlint"': '"publisher": "relint"',
    '"publisher": "oxfmt"': '"publisher": "relfmt"',
    'is_source_fix_all_oxc': 'is_source_fix_all_relinter',
    'oxc/tsconfig.json': 'relinter/tsconfig.json',
    'Disable oxc unique rules': 'Disable relinter unique rules',
    'oxc.': 'relinter.',
    'oxlint.': 'relint.',
    'oxfmt.': 'relfmt.',
    'extension.oxc': 'extension.relinter',
    'extension.oxlint': 'extension.relint',
    'extension.oxfmt': 'extension.relfmt',
  } as const,

  // Directory renames
  directories: {
    'apps/oxlint': 'apps/relint',
    'apps/oxfmt': 'apps/relfmt',
    'crates/oxc': 'crates/relinter',
    'crates/oxc_cli': 'crates/relinter_cli',
    'crates/oxc_parser': 'crates/relinter_parser',
    'crates/oxc_ast': 'crates/relinter_ast',
    'crates/oxc_ast_macros': 'crates/relinter_ast_macros',
    'crates/oxc_ast_visit': 'crates/relinter_ast_visit',
    'crates/oxc_cfg': 'crates/relinter_cfg',
    'crates/oxc_codegen': 'crates/relinter_codegen',
    'crates/oxc_compat': 'crates/relinter_compat',
    'crates/oxc_data_structures': 'crates/relinter_data_structures',
    'crates/oxc_diagnostics': 'crates/relinter_diagnostics',
    'crates/oxc_ecmascript': 'crates/relinter_ecmascript',
    'crates/oxc_estree': 'crates/relinter_estree',
    'crates/oxc_formatter': 'crates/relinter_formatter',
    'crates/oxc_isolated_declarations': 'crates/relinter_isolated_declarations',
    'crates/oxc_language_server': 'crates/relinter_language_server',
    'crates/oxc_linter': 'crates/relinter_linter',
    'crates/oxc_macros': 'crates/relinter_macros',
    'crates/oxc_mangler': 'crates/relinter_mangler',
    'crates/oxc_minifier': 'crates/relinter_minifier',
    'crates/oxc_napi': 'crates/relinter_napi',
    'crates/oxc_regular_expression': 'crates/relinter_regular_expression',
    'crates/oxc_semantic': 'crates/relinter_semantic',
    'crates/oxc_span': 'crates/relinter_span',
    'crates/oxc_syntax': 'crates/relinter_syntax',
    'crates/oxc_transformer': 'crates/relinter_transformer',
    'crates/oxc_transformer_plugins': 'crates/relinter_transformer_plugins',
    'crates/oxc_traverse': 'crates/relinter_traverse',
    'npm/oxc-types': 'npm/relinter-types',
    'npm/oxfmt': 'npm/relfmt',
    'npm/oxlint': 'npm/relint',
    'plugins/oxlint-plugin': 'plugins/relint-plugin',
  } as const,

  // URL replacements
  urls: {
    'https://oxc.rs': 'https://relinter.dev',
    'http://oxc.rs': 'http://relinter.dev',
    'oxc.rs': 'relinter.dev',
    'https://github.com/oxc-project/oxc': 'https://github.com/reliverse/relinter',
    'http://github.com/oxc-project/oxc': 'http://github.com/reliverse/relinter',
    'github.com/oxc-project/oxc': 'github.com/reliverse/relinter',
    'oxc-project/oxc': 'reliverse/relinter',
    'oxc-project.github.io/oxc': 'reliverse.github.io/relinter',
    'https://github.com/sponsors/Boshen': 'https://github.com/sponsors/reliverse',
    'github.com/sponsors/Boshen': 'github.com/sponsors/reliverse',
    'img.shields.io/github/sponsors/Boshen': 'img.shields.io/github/sponsors/reliverse',
    'raw.githubusercontent.com/Boshen/sponsors': 'raw.githubusercontent.com/reliverse/sponsors',
    'oxc-project/oxc-miette': 'reliverse/relinter-miette',
    '@oxc-project/': '@reliverse/',
    'npmjs.com/package/oxc': 'npmjs.com/package/relinter',
    'npmjs.com/package/oxlint': 'npmjs.com/package/relint',
    'npmjs.com/package/oxfmt': 'npmjs.com/package/relfmt',
  } as const,

  // Author replacements
  authors: {
    'Boshen <boshenc@gmail.com>': 'reliverse',
    'Oxc contributors': 'relinter contributors',
    'Boshen and oxc contributors': 'reliverse and relinter contributors',
    'Boshen and relinter contributors': 'reliverse and relinter contributors',
  } as const,

  ignoredDirs: ['codemods', 'node_modules', '.git', 'target', 'dist', '.next', '.nuxt', 'build', 'out', '.idea', '.cache'],
  ignoredFilePatterns: ['*.node', '*.wasm', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.woff', '*.woff2', '*.ttf', '*.eot', '*.pdf', '*.zip', '*.tar.gz', '*.7z', 'LICENSES'] as const,
  fileExtensions: [
    '.json', '.md', '.rs', '.ts', '.js', '.toml', '.yml', '.yaml', '.sh', '.txt', '.html', '.css', '.scss', '.less', '.xml', '.svg', '.lock',
    '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc', '.babelrc', '.dockerignore', 'Dockerfile', 'Makefile',
    '.env', '.env.local', '.env.production', '.env.development', 'LICENSE', 'LICENSE.md', 'README', 'CHANGELOG', 'CONTRIBUTING',
    '.github', '.gitlab-ci.yml', '.travis.yml', '.circleci', 'Jenkinsfile', 'package-lock.json', 'yarn.lock', 'bun.lockb',
    '.nvmrc', '.ruby-version', '.python-version', 'pyproject.toml', 'setup.py', 'requirements.txt', 'Cargo.lock',
    '.clang-format', '.rustfmt.toml', 'rust-toolchain.toml', 'deny.toml', 'Cross.toml', '.snap',
    '.jsonc', '.mjs', '.cjs', '.tsx', '.jsx', '.mts', '.cts', '.d.ts', '.d.mts', '.d.cts'
  ] as const,
} as const;


/**
 * Case-preserving replacement function for 'oxc' variants
 * Enhanced to catch all edge cases and ensure idempotency
 */
function createCasePreservingReplacer() {
  const oxcVariants = [
    // Handle oxc-project first (before oxc to avoid partial matches)
    { pattern: /oxc-project/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('reliverse')) return match;
      if (match === 'oxc-project') return 'reliverse';
      if (match === 'Oxc-project') return 'Reliverse';
      if (match === 'OXC-PROJECT') return 'RELIVERSE';
      return match.replace(/oxc-project/gi, 'reliverse');
    }},
    // Handle oxc_* patterns (crate names, identifiers)
    { pattern: /\boxc_[a-z0-9_]+/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinter_')) return match;
      return match.replace(/^oxc_/i, 'relinter_');
    }},
    // Handle oxc-* patterns (package names, URLs)
    { pattern: /\boxc-[a-z0-9-]+/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinter-')) return match;
      return match.replace(/^oxc-/i, 'relinter-');
    }},
    // Handle standalone oxc word boundary (most common case)
    { pattern: /\boxc\b|oxc(?=[_\-])/gi, replacement: (match: string, offset: number, string: string) => {
      // Skip if this is part of "Box" (B followed by oxc)
      const beforeMatch = string.substring(Math.max(0, offset - 1), offset);
      if (beforeMatch.toLowerCase() === 'b') {
        return match; // Don't replace if preceded by 'B' or 'b'
      }

      // Idempotency check: skip if already replaced
      const afterMatch = string.substring(offset, Math.min(string.length, offset + 20));
      if (afterMatch.toLowerCase().startsWith('relinter')) return match;

      // Extract just "oxc" part (remove trailing _ or - if present)
      const oxcPart = match.replace(/[_\-]$/, '');
      const suffix = match.endsWith('_') ? '_' : match.endsWith('-') ? '-' : '';

      if (oxcPart === 'oxc') return 'relinter' + suffix;
      if (oxcPart === 'Oxc') return 'Relinter' + suffix;
      if (oxcPart === 'OXC') return 'RELINTER' + suffix;
      if (oxcPart === 'OxC') return 'Relinter' + suffix;
      if (oxcPart === 'oXc') return 'rElinter' + suffix;
      if (oxcPart === 'OXc') return 'RELinter' + suffix;
      if (oxcPart === 'oXC') return 'rELINTER' + suffix;
      return oxcPart.replace(/oxc/gi, 'relinter') + suffix; // fallback
    }},
    // Handle OXC at end of identifiers (like CODE_ACTION_KIND_SOURCE_FIX_ALL_OXC)
    { pattern: /_OXC\b/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinter')) return match;
      return '_RELINTER';
    }},
    // Handle oxlint-disable directives (must come before oxlint)
    { pattern: /oxlint-disable(-next-line|-line)?/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relint-disable')) return match;
      if (match === 'oxlint-disable') return 'relint-disable';
      if (match === 'Oxlint-disable') return 'Relint-disable';
      if (match === 'OXLINT-DISABLE') return 'RELINT-DISABLE';
      if (match === 'oxlint-disable-next-line') return 'relint-disable-next-line';
      if (match === 'Oxlint-disable-next-line') return 'Relint-disable-next-line';
      if (match === 'OXLINT-DISABLE-NEXT-LINE') return 'RELINT-DISABLE-NEXT-LINE';
      if (match === 'oxlint-disable-line') return 'relint-disable-line';
      if (match === 'Oxlint-disable-line') return 'Relint-disable-line';
      if (match === 'OXLINT-DISABLE-LINE') return 'RELINT-DISABLE-LINE';
      return match.replace(/oxlint-disable/gi, 'relint-disable');
    }},
    // Handle oxlint (must come after oxlint-disable)
    { pattern: /oxlint/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relint')) return match;
      if (match === 'oxlint') return 'relint';
      if (match === 'Oxlint') return 'Relint';
      if (match === 'OXLINT') return 'RELINT';
      if (match === 'OxLint') return 'RelInt';
      if (match === 'OXlint') return 'RELint';
      if (match === 'oxLint') return 'relInt';
      return match.replace(/oxlint/gi, 'relint');
    }},
    // Handle oxfmtrc in identifiers (camelCase, PascalCase, etc.)
    // This pattern matches oxfmtrc as a whole word or as part of camelCase identifiers
    { pattern: /oxfmtrc/gi, replacement: (match: string, offset: number, string: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relfmtrc')) return match;

      // Check if it's part of a camelCase identifier (preceded by uppercase letter)
      const beforeMatch = offset > 0 ? string[offset - 1] : '';
      const isCamelCase = /[A-Z]/.test(beforeMatch);

      if (match === 'oxfmtrc') return 'relfmtrc';
      if (match === 'Oxfmtrc') return 'Relfmtrc';
      if (match === 'OXFMTRC') return 'RELFMTRC';
      if (match === 'OxFmtrc') return 'RelFmtrc';
      // Handle camelCase context: if preceded by uppercase, preserve that context
      if (isCamelCase && match[0] === 'o') {
        return 'relfmtrc'; // In camelCase, keep lowercase after uppercase letter
      }
      // Preserve case of first letter
      if (match[0] === match[0].toUpperCase()) {
        return 'Relfmtrc';
      }
      return match.replace(/oxfmtrc/gi, 'relfmtrc');
    }},
    // Handle oxfmt (must come after oxfmtrc)
    { pattern: /oxfmt/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relfmt')) return match;
      if (match === 'oxfmt') return 'relfmt';
      if (match === 'Oxfmt') return 'Relfmt';
      if (match === 'OXFMT') return 'RELFMT';
      if (match === 'OxFmt') return 'RelFmt';
      if (match === 'OXfmt') return 'RELfmt';
      if (match === 'oxFmt') return 'relFmt';
      return match.replace(/oxfmt/gi, 'relfmt');
    }},
    // Handle oxlintrc (must come after oxlint)
    { pattern: /oxlintrc/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinter') || match.toLowerCase().includes('relintrc')) return match;
      if (match === 'oxlintrc') return 'relinter'; // oxlintrc.json -> relinter.json
      if (match === 'Oxlintrc') return 'Relinter';
      if (match === 'OXLINTRC') return 'RELINTER';
      return match.replace(/oxlintrc/gi, 'relinter');
    }},
    // Handle oxcrs (no separator)
    { pattern: /\boxcrs\b/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinterrs')) return match;
      return match.replace(/oxcrs/gi, 'relinterrs');
    }},
    // Handle oxcproject (no separator)
    { pattern: /\boxcproject\b/gi, replacement: (match: string) => {
      // Idempotency check: skip if already replaced
      if (match.toLowerCase().includes('relinterproject')) return match;
      return match.replace(/oxcproject/gi, 'relinterproject');
    }},
    // Handle type names like OxcDiagnostic -> RelinterDiagnostic
    { pattern: /\bOxc([A-Z][a-zA-Z]*)\b/g, replacement: (match: string, suffix: string) => {
      // Idempotency check: skip if already replaced
      if (match.includes('Relinter')) return match;
      return 'Relinter' + suffix;
    }},
  ];

  return function replaceWithCasePreservation(text: string): string {
    let result = text;
    // Apply replacements in order (more specific patterns first)
    for (const { pattern, replacement } of oxcVariants) {
      result = result.replace(pattern, replacement);
    }
    return result;
  };
}



/**
 * Find all files that might contain 'oxc/oxlint/oxfmt' references (for debugging)
 */
function findFilesWithOxc(dir: string = '.'): Array<{file: string, count: number, lines: string[]}> {
  const files = findFiles(dir, {
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });
  const results: Array<{file: string, count: number, lines: string[]}> = [];

  for (const file of files) {
    // Skip branding and migration scripts (only in scripts/codemods directory)
    if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

    try {
      const content = readFileContent(file);
      const lines = content.split('\n');
      const oxcLines: string[] = [];
      let count = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\boxc\b|oxlint|oxfmt|oxc[a-zA-Z_]/i.test(line)) {
          oxcLines.push(`${i + 1}: ${line.trim()}`);
          count++;
        }
      }

      if (count > 0) {
        results.push({ file, count, lines: oxcLines });
      }
    } catch (err) {
      // Skip files that can't be read
      continue;
    }
  }

  // Sort by count descending
  return results.sort((a, b) => b.count - a.count);
}

/**
 * Rename directories
 */
function renameDirectories(dryRun: boolean, verbose: boolean): { renamed: string[]; skipped: string[] } {
  const renamed: string[] = [];
  const skipped: string[] = [];

  for (const [oldPath, newPath] of Object.entries(CONFIG.directories)) {
    if (existsSync(oldPath)) {
      if (!existsSync(newPath)) {
        if (!dryRun) {
          try {
            renameSync(oldPath, newPath);
            renamed.push(newPath);
          } catch (err) {
            error(`Failed to rename ${oldPath}: ${err}`);
            skipped.push(oldPath);
          }
        } else {
          renamed.push(newPath);
        }
      } else {
        skipped.push(oldPath);
      }
    } else {
      skipped.push(oldPath);
    }
  }

  return { renamed, skipped };
}

/**
 * Create a generic file updater function using centralized configuration
 */
function createFileUpdater(fileType: string, filePatterns: string[] | string) {
  const configManager = createConfigManager();
  const replacementRules = configManager.getReplacementRules(fileType);
  const customProcessor = configManager.getCustomProcessors(fileType);

  return function(processor: BatchFileProcessor): void {
    const files = findFiles('.', {
      patterns: filePatterns,
      ignoredDirs: CONFIG.ignoredDirs,
      ignoredFilePatterns: CONFIG.ignoredFilePatterns,
    });
    if (files.length === 0) return;

    for (const file of files) {
      // Skip branding and migration scripts (only in scripts/codemods directory)
      if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

      // Apply standard replacements
      for (const replacement of replacementRules) {
        for (const [oldValue, newValue] of Object.entries(replacement.config)) {
          if (replacement.skipKeys?.includes(oldValue)) continue;

          const prefix = replacement.prefix || '';
          const suffix = replacement.suffix || '';
          const oldStr = prefix ? `${prefix}${oldValue}${suffix}` : oldValue;
          const newStr = prefix ? `${prefix}${newValue}${suffix}` : newValue;

          processor.queueReplacement(file, oldStr, newStr);
        }
      }

      // Apply custom processing if provided
      customProcessor?.(file, processor);
    }
  };
}

/**
 * Update package.json files
 */
const updatePackageJsonFiles = createFileUpdater('package.json', ['package.json']);

/**
 * Update Cargo.toml files
 */
const updateCargoTomlFiles = createFileUpdater('Cargo.toml', ['Cargo.toml']);

/**
 * Special handler for task Cargo.toml files that need additional dependency updates
 */
function updateTaskCargoTomlFiles(processor: BatchFileProcessor): void {
  const taskCargoFiles = findFiles('.', {
    patterns: ['Cargo.toml'],
    ignoredDirs: CONFIG.ignoredDirs,
  }).filter(file => file.includes('/tasks/'));
  if (taskCargoFiles.length === 0) return;

  for (const file of taskCargoFiles) {
    try {
      const content = readFileContent(file);
      let modifiedContent = content;
      let wasModified = false;

      // Replace crate name
      if (modifiedContent.includes('name = "oxc_coverage"')) {
        modifiedContent = modifiedContent.replace(/name = "oxc_coverage"/g, 'name = "relinter_coverage"');
        wasModified = true;
      }
      if (modifiedContent.includes("name = 'oxc_coverage'")) {
        modifiedContent = modifiedContent.replace(/name = 'oxc_coverage'/g, "name = 'relinter_coverage'");
        wasModified = true;
      }

      // Replace oxc workspace dependencies
      modifiedContent = modifiedContent.replace(/oxc\s*=\s*\{\s*workspace\s*=\s*true/g, 'relinter = { workspace = true');
      if (content !== modifiedContent) wasModified = true;

      // Replace oxc_formatter workspace dependencies
      modifiedContent = modifiedContent.replace(/oxc_formatter\s*=\s*\{\s*workspace\s*=\s*true/g, 'relinter_formatter = { workspace = true');
      if (content !== modifiedContent) wasModified = true;

      // Replace all oxc_* crate dependencies
      modifiedContent = modifiedContent.replace(/oxc_([a-z_]+)\s*=\s*\{/g, (match, crateName) => {
        // Idempotency check
        if (match.toLowerCase().includes('relinter_')) return match;
        return `relinter_${crateName} = {`;
      });
      if (content !== modifiedContent) wasModified = true;

      // Replace task-specific crates
      modifiedContent = modifiedContent.replace(/oxc_tasks_common/g, 'relinter_tasks_common');
      modifiedContent = modifiedContent.replace(/oxc_tasks_transform_checker/g, 'relinter_tasks_transform_checker');
      if (content !== modifiedContent) wasModified = true;

      if (wasModified && content !== modifiedContent) {
        processor.queueReplacement(file, content, modifiedContent);
      }
    } catch (err) {
      // Skip if file can't be read
      continue;
    }
  }
}

/**
 * Update Rust source files with special handling for use statements and identifiers
 */
function updateRustSourceFiles(processor: BatchFileProcessor, dryRun: boolean): void {
  const files = findFiles('.', {
    patterns: ['.rs'],
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });
  if (files.length === 0) return;

  for (const file of files) {
    // Skip branding and migration scripts (only in scripts/codemods directory)
    if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

    try {
      const content = readFileContent(file);

      // Idempotency check: only skip if there are NO oxc/oxlint/oxfmt references
      // This allows processing files that have both relinter (from comments) and oxc (needs replacement)
      // Check for oxc patterns: word boundaries, capitalized types, oxlint/oxfmt, oxc_ prefixes, _oxc suffixes
      const hasOxc = /\boxc\b|Oxc[A-Z]|oxlint|oxfmt|oxc_|_[a-z_]*oxc\(|_OXC\b|oxc[a-zA-Z_]/i.test(content);
      if (!hasOxc) {
        continue; // No oxc references, already migrated or never had them
      }

      let modifiedContent = content;

      // Handle use statements with multi-line imports (use oxc::{...})
      modifiedContent = modifiedContent.replace(
        /use\s+oxc::\{/gi,
        (match) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter')) return match;
          return match.replace(/oxc/gi, 'relinter');
        }
      );

      // Handle use oxc:: statements
      modifiedContent = modifiedContent.replace(
        /use\s+oxc::/gi,
        (match) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter')) return match;
          return match.replace(/oxc/gi, 'relinter');
        }
      );

      // Handle use statements for crates like `use oxc_coverage::` or `use oxc_tasks_common::`
      modifiedContent = modifiedContent.replace(
        /use\s+oxc_([a-z_]+)::/gi,
        (match, crateName) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter_')) return match;
          return `use relinter_${crateName}::`;
        }
      );

      // Handle use statements like `use oxc_coverage::AppArgs;` (without the ::)
      modifiedContent = modifiedContent.replace(
        /use\s+oxc_([a-z_]+)::([A-Z][a-zA-Z]*);/g,
        (match, crateName, typeName) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter_')) return match;
          return `use relinter_${crateName}::${typeName};`;
        }
      );

      // Handle variable names like oxc_printed, oxc_diagnostics
      modifiedContent = modifiedContent.replace(
        /\boxc_([a-z_]+)/gi,
        (match, suffix) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter_')) return match;
          return 'relinter_' + suffix;
        }
      );

      // Handle type names like OxcDiagnostic (must come before other oxc replacements)
      // This handles cases like `diagnostics::OxcDiagnostic` even when already using `relinter::`
      modifiedContent = modifiedContent.replace(
        /\bOxc([A-Z][a-zA-Z]*)\b/g,
        (match, suffix) => {
          // Idempotency check
          if (match.includes('Relinter')) return match;
          return 'Relinter' + suffix;
        }
      );

      // Handle struct field names and method names
      modifiedContent = modifiedContent.replace(
        /\.oxc_([a-z_]+)/gi,
        (match, suffix) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter_')) return match;
          return '.relinter_' + suffix;
        }
      );

      // Handle method names like print_oxc() -> print_relinter()
      // This catches both method calls (.print_oxc()) and method definitions (fn print_oxc())
      modifiedContent = modifiedContent.replace(
        /([a-z_]+)_oxc\(/gi,
        (match, prefix) => {
          // Idempotency check
          if (match.toLowerCase().includes('relinter')) return match;
          return `${prefix}_relinter(`;
        }
      );

      // Apply standard replacements from config
      const configManager = createConfigManager();
      const replacementRules = configManager.getReplacementRules('rust');

      for (const replacement of replacementRules) {
        for (const [oldValue, newValue] of Object.entries(replacement.config)) {
          if (replacement.skipKeys?.includes(oldValue)) continue;

          const prefix = replacement.prefix || '';
          const suffix = replacement.suffix || '';
          const oldStr = prefix ? `${prefix}${oldValue}${suffix}` : oldValue;
          const newStr = prefix ? `${prefix}${newValue}${suffix}` : newValue;

          // Apply replacement directly
          if (modifiedContent.includes(oldStr)) {
            modifiedContent = modifiedContent.replace(
              new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              newStr
            );
          }
        }
      }

      // Apply case-preserving replacer for comments and other contexts
      const casePreservingReplacer = createCasePreservingReplacer();
      const finalContent = casePreservingReplacer(modifiedContent);

      if (content !== finalContent) {
        if (dryRun) {
          log(`[DRY RUN] Would update ${file}`, 'yellow');
        } else {
          writeFileSync(file, finalContent, 'utf8');
        }
      }
    } catch (err) {
      // Skip files that can't be read
      continue;
    }
  }
}

/**
 * Update documentation files
 */
const updateDocumentationFiles = createFileUpdater('docs', ['.md', '.txt']);

/**
 * Update configuration files
 */
const updateConfigFiles = createFileUpdater('config', ['.json', '.yml', '.yaml', '.toml', '.js', '.ts', 'CODEOWNERS', '.snap']);

/**
 * Update TypeScript/JavaScript source files with special handling for:
 * - Linter directive comments (oxlint-disable, oxlint-disable-next-line)
 * - String literals containing config file names
 * - Import/require paths with oxc/oxlint/oxfmt
 */
function updateTypeScriptFiles(processor: BatchFileProcessor, dryRun: boolean): { processed: number; modified: number } {
  const files = findFiles('.', {
    patterns: ['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs'],
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });

  // Also process .mjs files that contain Rust code (generated files)
  const mjsFiles = findFiles('.', {
    patterns: ['.mjs'],
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });

  const allFiles = [...files, ...mjsFiles];
  if (allFiles.length === 0) return { processed: 0, modified: 0 };

  let processed = 0;
  let modified = 0;

  for (const file of allFiles) {
    // Skip branding and migration scripts (only in scripts/codemods directory)
    if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

    try {
      const content = readFileContent(file);
      let modifiedContent = content;

      // Handle linter directive comments in /* */ and // comments
      // Pattern: /* oxlint-disable ... */ or // oxlint-disable-next-line
      modifiedContent = modifiedContent.replace(
        /(\/\*|\/\/)\s*oxlint-disable(-next-line|-line)?/gi,
        (match, commentType, suffix = '') => {
          // Idempotency check: skip if already replaced
          if (match.toLowerCase().includes('relint-disable')) return match;

          if (suffix === '-next-line') {
            return match.replace(/oxlint-disable-next-line/gi, 'relint-disable-next-line');
          } else if (suffix === '-line') {
            return match.replace(/oxlint-disable-line/gi, 'relint-disable-line');
          } else {
            return match.replace(/oxlint-disable/gi, 'relint-disable');
          }
        }
      );

      // Handle string literals with config file names
      for (const [oldValue, newValue] of Object.entries(CONFIG.stringLiterals)) {
        // Match in single quotes, double quotes, and template literals
        const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match quoted strings (exact match with quotes)
        modifiedContent = modifiedContent.replace(
          new RegExp(`(["'\`])${escapedOld}\\1`, 'g'),
          (match, quote) => quote + newValue + quote
        );
        // Match in template literals (backticks)
        modifiedContent = modifiedContent.replace(
          new RegExp(`\`([^\`]*)${escapedOld}([^\`]*)\``, 'g'),
          (match, before, after) => `\`${before}${newValue}${after}\``
        );
        // Match in comments and other contexts (more permissive)
        modifiedContent = modifiedContent.replace(
          new RegExp(escapedOld, 'g'),
          newValue
        );
      }

      // Handle import/require paths (with idempotency check)
      modifiedContent = modifiedContent.replace(
        /(import|require|from)\s+['"]([^'"]*)(oxfmt|oxlint|\boxc\b)([^'"]*)['"]/gi,
        (match, keyword, before, target, after) => {
          // Idempotency check: skip if already replaced
          if (target.toLowerCase().includes('relinter') ||
              target.toLowerCase().includes('relint') ||
              target.toLowerCase().includes('relfmt')) {
            return match;
          }

          let newTarget = target;
          if (target.toLowerCase() === 'oxfmt') newTarget = 'relfmt';
          else if (target.toLowerCase() === 'oxlint') newTarget = 'relint';
          else if (target.toLowerCase() === 'oxc') newTarget = 'relinter';
          // Preserve original quote style
          const quote = match.includes("'") ? "'" : '"';
          return `${keyword} ${quote}${before}${newTarget}${after}${quote}`;
        }
      );

      // Handle function/variable names with oxfmtrc
      for (const [oldValue, newValue] of Object.entries(CONFIG.identifiers)) {
        const escaped = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match as whole word (case-insensitive)
        let identifierPattern = new RegExp(`\\b${escaped}\\b`, 'gi');
        modifiedContent = modifiedContent.replace(identifierPattern, (match) => {
          // Idempotency check: skip if already replaced
          if (match.toLowerCase().includes(newValue.toLowerCase())) return match;

          // Preserve case of first letter
          if (match[0] === match[0].toUpperCase()) {
            return newValue[0].toUpperCase() + newValue.slice(1);
          }
          return newValue;
        });
        // Also match in camelCase contexts (e.g., hasOxfmtrcFile)
        // Match when preceded by uppercase letter (camelCase)
        identifierPattern = new RegExp(`([A-Z])${escaped}`, 'gi');
        modifiedContent = modifiedContent.replace(identifierPattern, (match, before) => {
          // Idempotency check: skip if already replaced
          if (match.toLowerCase().includes(newValue.toLowerCase())) return match;

          // In camelCase, keep the preceding uppercase and make the replacement start with uppercase
          return before + (newValue[0].toUpperCase() + newValue.slice(1));
        });
      }

      // Also handle standalone oxfmtrc variable names (not in CONFIG.identifiers)
      modifiedContent = modifiedContent.replace(
        /\boxfmtrc\b/gi,
        (match) => {
          // Idempotency check: skip if already replaced
          if (match.toLowerCase().includes('relfmtrc')) return match;

          if (match === 'oxfmtrc') return 'relfmtrc';
          if (match === 'Oxfmtrc') return 'Relfmtrc';
          if (match === 'OXFMTRC') return 'RELFMTRC';
          return match.replace(/oxfmtrc/gi, 'relfmtrc');
        }
      );

      // Handle oxfmt in comments and strings (Oxfmt -> Relfmt)
      modifiedContent = modifiedContent.replace(
        /\bOxfmt\b/g,
        (match) => {
          // Idempotency check: skip if already replaced
          if (match.toLowerCase().includes('relfmt')) return match;
          return 'Relfmt';
        }
      );

      processed++;
      if (modifiedContent !== content) {
        modified++;
        if (dryRun) {
          log(`[DRY RUN] Would update ${file}`, 'yellow');
        } else {
          writeFileSync(file, modifiedContent, 'utf8');
        }
      }
    } catch (err) {
      // Skip files that can't be read
      continue;
    }
  }

  return { processed, modified };
}

/**
 * Remove specific devDependencies from root package.json
 */
function removeDevDependencies(dryRun: boolean): void {
  const packageJsonPath = 'package.json';
  if (!existsSync(packageJsonPath)) {
    warning('Root package.json not found, skipping devDependencies removal...');
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let removed = false;

    // Dependencies to remove from devDependencies
    const dependenciesToRemove = ['relfmt', 'relint', 'relint-tsgolint'];

    if (packageJson.devDependencies) {
      for (const dep of dependenciesToRemove) {
        if (packageJson.devDependencies[dep]) {
          delete packageJson.devDependencies[dep];
          removed = true;
          info(`Removed ${dep} from devDependencies`);
        }
      }
    }

    if (removed) {
      if (!dryRun) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        success('Removed relinter tools from devDependencies');
      } else {
        log('[DRY RUN] Would remove relinter tools from devDependencies', 'yellow');
      }
    }

  } catch (err) {
    error(`Failed to remove devDependencies: ${err}`);
  }
}

/**
 * Post-processing function to handle special transformations that must run after main transformations
 */
function applyPostProcessingTransformations(dryRun: boolean): void {
  const allFiles = findFiles('.', {
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });

  info('Applying post-processing transformations...');

  // First remove devDependencies
  removeDevDependencies(dryRun);

  // Then apply other post-processing transformations
  for (const file of allFiles) {
    // Skip branding and migration scripts (only in scripts/codemods directory)
    if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

    try {
      const content = readFileContent(file);
      let newContent = content;

      // Special transformation: relinter.rs -> docs.reliverse.org
      // This must run after general oxc -> relinter transformations
      newContent = newContent.replace(/relinter\.rs/g, 'docs.reliverse.org');

      if (content !== newContent) {
        if (dryRun) {
          log(`[DRY RUN] Would apply post-processing to ${file}`, 'yellow');
        } else {
          writeFileSync(file, newContent);
        }
      }
    } catch (err) {
      // Skip files that can't be read/written
      continue;
    }
  }
}

/**
 * Comprehensive text file processor - handles all remaining text files with case-preserving replacements
 * Enhanced with idempotency checks to work on already migrated codebases
 */
function updateAllTextFiles(processor: BatchFileProcessor, dryRun: boolean): void {
  // Find all text files, including .mjs files that may contain embedded Rust code
  const allFiles = findFiles('.', {
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });

  // Also explicitly find .mjs files to ensure they're included
  const mjsFiles = findFiles('.', {
    patterns: ['.mjs'],
    ignoredDirs: CONFIG.ignoredDirs,
    ignoredFilePatterns: CONFIG.ignoredFilePatterns,
  });

  const combinedFiles = Array.from(new Set([...allFiles, ...mjsFiles])).sort();
  const casePreservingReplacer = createCasePreservingReplacer();

  info('Processing all text files with comprehensive case-preserving replacements...');

  for (const file of combinedFiles) {
    // Skip branding and migration scripts (only in scripts/codemods directory)
    if (file.includes('scripts/codemods/') && (file.includes('branding') || file.includes('migration') || file.includes('oxc-to-relinter.ts'))) continue;

    try {
      const content = readFileContent(file);

      // Idempotency check: only skip if there are NO oxc/oxlint/oxfmt references
      // This allows processing files that have both relinter (from comments) and oxc (needs replacement)
      const hasOxc = /\boxc\b|oxlint|oxfmt/i.test(content);
      if (!hasOxc) {
        continue; // No oxc references, already migrated or never had them
      }

      const newContent = casePreservingReplacer(content);

      if (content !== newContent) {
        if (dryRun) {
          log(`[DRY RUN] Would update ${file} with case-preserving replacements`, 'yellow');
        } else {
          writeFileSync(file, newContent);
        }
      }
    } catch (err) {
      // Skip files that can't be read/written
      continue;
    }
  }
}

/**
 * Update workspace references in root package.json
 */
function updateWorkspaceReferences(dryRun: boolean): void {
  const packageJsonPath = 'package.json';
  if (!existsSync(packageJsonPath)) {
    warning('Root package.json not found, skipping workspace updates...');
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    // Update workspace packages array
    if (packageJson.workspaces?.packages) {
      packageJson.workspaces.packages = packageJson.workspaces.packages.map((pkg: string) => {
        for (const [oldPath, newPath] of Object.entries(CONFIG.directories)) {
          if (pkg === oldPath || pkg === `./${oldPath}`) {
            return `./${newPath}`;
          }
        }
        return pkg;
      });

      if (!dryRun) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      }
    }

  } catch (err) {
    error(`Failed to update workspace references: ${err}`);
  }
}

/**
 * Update scripts in root package.json for fresh relinter setup
 */
function updateScripts(dryRun: boolean): void {
  const packageJsonPath = 'package.json';
  if (!existsSync(packageJsonPath)) {
    warning('Root package.json not found, skipping scripts updates...');
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    // Set the standard relinter scripts
    packageJson.scripts = {
      "build": "bun --filter \"./napi/*\" --filter \"./apps/*\" build",
      "build-dev": "bun --filter \"./napi/*\" --filter \"./apps/*\" build-dev",
      "build-test": "bun --filter \"./napi/*\" --filter \"./apps/*\" build-test",
      "build-wasm-dev": "bun --filter \"./napi/*\" build-wasm-dev",
      "test": "bun --filter \"./napi/*\" --filter \"./apps/*\" test",
      "fmt": "relfmt -c relfmtrc.jsonc",
      "lint": "relint -c relintrc.json --deny-warnings --type-aware --type-check --report-unused-disable-directives",
      "fresh": "bun clean && bun i",
      "clean": "./clean.sh"
    };

    if (!dryRun) {
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      success('Updated package.json scripts for relinter setup');
    } else {
      log('[DRY RUN] Would update package.json scripts', 'yellow');
    }

  } catch (err) {
    error(`Failed to update scripts: ${err}`);
  }
}

/**
 * Rename branded files throughout the codebase
 */
function renameBrandedFiles(dryRun: boolean, verbose: boolean): void {
  // Define intelligent replacement rules for different oxc patterns
  const renameRules: Array<{
    pattern: RegExp;
    replacement: (filename: string) => string;
    priority: number; // Higher priority rules are checked first
  }> = [
    // Specific filename matches (highest priority)
    {
      pattern: /^oxc\.rs$/,
      replacement: () => 'relinter.rs', // Rename oxc.rs to relinter.rs
      priority: 10
    },
    {
      pattern: /^oxc_release\.toml$/,
      replacement: () => 'relinter_release.toml',
      priority: 10
    },
    {
      pattern: /^declare_oxc_lint\.rs$/,
      replacement: () => 'declare_relinter_lint.rs',
      priority: 10
    },
    {
      pattern: /^\.oxlintrc\.json$/,
      replacement: () => '.relinter.json',
      priority: 10
    },
    {
      pattern: /^\.oxfmtrc\.json$/,
      replacement: () => '.relfmtrc.json',
      priority: 10
    },
    {
      pattern: /^\.oxfmtrc\.jsonc$/,
      replacement: () => '.relfmtrc.jsonc',
      priority: 10
    },
    {
      pattern: /^oxlintrc\.json$/,
      replacement: () => 'relinter.json',
      priority: 10
    },
    {
      pattern: /^oxfmtrc\.json$/,
      replacement: () => 'relfmtrc.json',
      priority: 10
    },
    {
      pattern: /^oxfmtrc\.jsonc$/,
      replacement: () => 'relfmtrc.jsonc',
      priority: 10
    },
    // Match oxlintrc anywhere in filename (high priority but lower than exact matches)
    {
      pattern: /oxlintrc/,
      replacement: (filename) => filename.replace(/oxlintrc/g, 'relinter'),
      priority: 5
    },
    // Match oxlint anywhere in filename
    {
      pattern: /oxlint/,
      replacement: (filename) => filename.replace(/oxlint/g, 'relint'),
      priority: 5
    },
    // Match oxfmtrc anywhere in filename
    {
      pattern: /oxfmtrc/,
      replacement: (filename) => filename.replace(/oxfmtrc/g, 'relfmtrc'),
      priority: 5
    },
    // Generic oxc replacement (lowest priority)
    {
      pattern: /oxc/,
      replacement: (filename) => filename.replace(/oxc/g, 'relinter'),
      priority: 1
    }
  ];

  // Sort rules by priority (highest first)
  renameRules.sort((a, b) => b.priority - a.priority);

  function renameRecursive(dir: string) {
    let items;
    try {
      items = readdirSync(dir);
    } catch (err) {
      // Skip directories we can't read (broken symlinks, permission issues, etc.)
      return;
    }

    for (const item of items) {
      // Allow processing of coverage directory since it contains oxlintrc files
      const isIgnoredDir = (CONFIG.ignoredDirs as readonly string[]).includes(item);
      if (isIgnoredDir && item !== 'coverage') continue;

      const fullPath = join(dir, item);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch (err) {
        // Skip files/directories that can't be accessed (broken symlinks, permission issues, etc.)
        continue;
      }

      // Check if directory name needs renaming
      let renamedItem = item;
      let wasRenamed = false;

      if (stat.isDirectory()) {
        // Check if directory name matches any rename patterns
        for (const rule of renameRules) {
          if (rule.pattern.test(item)) {
            const newDirName = rule.replacement(item);
            if (newDirName !== item && !existsSync(join(dir, newDirName))) {
              const oldPath = fullPath;
              const newPath = join(dir, newDirName);

              if (dryRun) {
                if (verbose) {
                  info(`Would rename directory: ${oldPath} → ${newPath}`);
                }
              } else {
                try {
                  renameSync(oldPath, newPath);
                  if (verbose) {
                    success(`Renamed directory: ${oldPath} → ${newPath}`);
                  }
                  renamedItem = newDirName;
                  wasRenamed = true;
                } catch (err) {
                  error(`Failed to rename directory ${oldPath}: ${err}`);
                }
              }
            }
            break; // Only apply the first matching rule
          }
        }
      }

      // Update fullPath if directory was renamed
      const currentPath = join(dir, renamedItem);

      if (stat.isDirectory()) {
        renameRecursive(currentPath);
      } else {
        // Skip the migration script itself (only in scripts/codemods) and binary files
        if ((renamedItem === 'oxc-to-relinter.ts' && currentPath.includes('scripts/codemods/')) ||
            CONFIG.ignoredFilePatterns.some(pattern => renamedItem.endsWith(pattern.replace('*', '')))) {
          continue;
        }

        // Check if filename contains 'oxc' and should be renamed
        for (const rule of renameRules) {
          if (rule.pattern.test(renamedItem)) {
            const newFilename = rule.replacement(renamedItem);
            const newPath = join(dir, newFilename);

            // Only rename if the new filename is different and target doesn't exist
            if (newFilename !== renamedItem && !existsSync(newPath)) {
              const currentFullPath = join(dir, renamedItem);
              if (dryRun) {
                if (verbose) {
                  info(`Would rename: ${currentFullPath} → ${newPath}`);
                }
              } else {
                try {
                  renameSync(currentFullPath, newPath);
                  if (verbose) {
                    success(`Renamed: ${currentFullPath} → ${newPath}`);
                  }
                } catch (err) {
                  error(`Failed to rename ${currentFullPath}: ${err}`);
                }
              }
            }
            break; // Only apply the first matching rule (highest priority)
          }
        }
      }
    }
  }

  // Start recursive renaming from current directory
  renameRecursive('.');
}


/**
 * Parse command line arguments
 */
function parseArguments(): { dryRun: boolean; debugMode: boolean; verbose: boolean; cwd: string } {
  const parsed = parseArgs(['debug']);
  return {
    dryRun: parsed.dryRun,
    debugMode: parsed['debug'] as boolean,
    verbose: parsed.verbose,
    cwd: parsed.cwd,
  };
}

/**
 * Run debug mode to find all files containing 'oxc' references
 */
function runDebugMode(debugMode: boolean): void {
  log('🔍 DEBUG MODE - Finding all files containing "oxc" references...', 'cyan');
  log('');

  const filesWithOxc = findFilesWithOxc();
  const totalFiles = filesWithOxc.length;
  const totalOccurrences = filesWithOxc.reduce((sum, file) => sum + file.count, 0);

  log(`Found ${totalOccurrences} occurrences of "oxc/oxlint/oxfmt" in ${totalFiles} files:`, 'yellow');
  log('');

  // Show top 20 files with most occurrences
  const topFiles = filesWithOxc.slice(0, 20);
  for (const { file, count, lines } of topFiles) {
    log(`${file}: ${count} occurrences`, 'blue');
    if (debugMode && lines.length <= 10) { // Only show lines if not too many
      for (const line of lines.slice(0, 5)) { // Show first 5 lines
        log(`  ${line}`, 'gray');
      }
      if (lines.length > 5) {
        log(`  ... and ${lines.length - 5} more lines`, 'gray');
      }
    }
  }

  if (totalFiles > 20) {
    log(`... and ${totalFiles - 20} more files`, 'gray');
  }

  log('');
  log('To fix these references, run the script without --debug flag.', 'cyan');
}

/**
 * Initialize the migration process
 */
function initializeMigration(dryRun: boolean, debugMode: boolean): { processor: BatchFileProcessor; operations: any[] } {
  if (debugMode) {
    runDebugMode(debugMode);
    process.exit(0);
  }

  log('🚀 Starting oxc to relinter branding migration...', 'cyan');
  if (dryRun) {
    log('🔍 DRY RUN MODE - No files will be modified', 'yellow');
  }
  log('This script will rebrand the entire oxc codebase to relinter', 'cyan');
  log('');

  const processor = createBatchFileProcessor(dryRun);

  // Define operations
  const operations = [
    updatePackageJsonFiles,
    updateCargoTomlFiles,
    updateTaskCargoTomlFiles, // Special handling for task Cargo.toml dependencies
    updateRustSourceFiles,
    updateDocumentationFiles,
    updateConfigFiles,
    updateTypeScriptFiles, // TypeScript/JavaScript specific handling (linter directives, imports, etc.)
    updateAllTextFiles, // Comprehensive case-preserving replacement for all text files
    applyPostProcessingTransformations, // Special transformations that must run after main processing
  ];

  return { processor, operations };
}

/**
 * Perform directory and file renaming operations
 */
function performRenamingOperations(dryRun: boolean, verbose: boolean): { renamedDirs: string[] } {
  info('Renaming directories...');
  const { renamed: renamedDirs } = renameDirectories(dryRun, verbose);

  info('Renaming branded files...');
  renameBrandedFiles(dryRun, verbose);

  info('Updating workspace references...');
  updateWorkspaceReferences(dryRun);

  info('Updating scripts...');
  updateScripts(dryRun);

  return { renamedDirs };
}

/**
 * Process all file operations with controlled concurrency
 */
async function processFileOperations(operations: any[], processor: BatchFileProcessor, dryRun: boolean): Promise<{ tsProcessed: number; tsModified: number }> {
  const operationNames = ['Processing package.json files', 'Processing Cargo.toml files', 'Processing Rust files', 'Processing documentation', 'Processing config files', 'Processing TypeScript/JavaScript files', 'Applying comprehensive text replacements', 'Applying post-processing transformations'];
  const concurrencyLimit = 4; // Limit concurrent operations to avoid overwhelming the system
  let tsProcessed = 0;
  let tsModified = 0;

  for (let i = 0; i < operations.length; i += concurrencyLimit) {
    const batch = operations.slice(i, i + concurrencyLimit);
    const batchNames = operationNames.slice(i, i + concurrencyLimit);
    info(batchNames.join(', '));

    const results = await Promise.all(batch.map(async (operation) => {
      try {
        if (operation === updateAllTextFiles) {
          operation(processor, dryRun);
          return { processed: 0, modified: 0 };
        } else if (operation === applyPostProcessingTransformations) {
          operation(dryRun);
          return { processed: 0, modified: 0 };
        } else if (operation === updateTypeScriptFiles) {
          return operation(processor, dryRun);
        } else if (operation === updateRustSourceFiles) {
          operation(processor, dryRun);
          return { processed: 0, modified: 0 };
        } else {
          operation(processor);
          return { processed: 0, modified: 0 };
        }
      } catch (err) {
        error(`Failed in operation: ${err}`);
        throw err;
      }
    }));

    // Track TypeScript file modifications
    for (const result of results) {
      if (result && result.processed > 0) {
        tsProcessed += result.processed;
        tsModified += result.modified;
      }
    }
  }

  return { tsProcessed, tsModified };
}

/**
 * Apply all batched file operations and return results
 */
function applyFileOperations(processor: BatchFileProcessor): { processed: number; modified: number } {
  return processor.applyAll();
}

/**
 * Display migration summary and next steps
 */
function displayMigrationSummary(renamedDirs: string[], processed: number, modified: number, dryRun: boolean): void {
  log('');
  success('🎉 Branding migration from oxc to relinter completed successfully!');
  log('');
  log('Summary of changes:', 'yellow');
  log(`• ${renamedDirs.length} directories renamed`);
  log(`• ${processed} files processed, ${modified} files modified`);
  log('• Package names updated (oxc-* → relinter-*)');
  log('• Crate names updated (oxc_* → relinter_*)');
  log('• Binary names updated (oxlint → relint, oxfmt → relfmt)');
  log('• Case-preserving replacements applied (oxc → relinter, Oxc → Relinter, OXC → RELINTER)');
  log('• Documentation updated with comprehensive branding changes');
  log('• Configuration files updated (including hidden files and CI/CD configs)');
  log('• Repository URLs and metadata updated');
  log('• Source code references updated across all file types');
  log('• Workspace references updated');
  log('• Scripts updated in package.json');
  log('• Relinter tools removed from devDependencies');
  log('• Comprehensive coverage of all text files in codebase');
  log('');
  log('Next steps:', 'cyan');
  log('1. Review the changes and ensure everything looks correct');
  log('2. Update any remaining references that may have been missed');
  log('3. Test that the build still works: bun build');
  log('4. Test that the tools work: bun relint --help, bun relfmt --help');
  log('5. Update CI/CD pipelines if needed');
  log('6. Update README and other documentation as needed');
  log('');
}

/**
 * Main branding function - can be called directly or via CLI
 */
export async function runOxcToRelinter(options?: { dryRun?: boolean; debugMode?: boolean; verbose?: boolean; cwd?: string }): Promise<void> {
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
      debugMode: options.debugMode ?? false,
      verbose: options.verbose ?? false,
      cwd: options.cwd ?? process.cwd(),
    } : parseArguments();
    const { dryRun, debugMode, verbose } = parsed;

    // Check if already migrated (but still allow running for idempotency)
    if (isAlreadyMigratedFromOxc('.')) {
      info('Project appears to already be migrated from oxc to relinter.');
      info('Continuing with transformation (safe to run multiple times)...');
    }

    // Initialize migration
    const { processor, operations } = initializeMigration(dryRun, debugMode);

    // Perform renaming operations
    const { renamedDirs } = performRenamingOperations(dryRun, verbose);

    // Process file operations
    const { tsProcessed, tsModified } = await processFileOperations(operations, processor, dryRun);

    // Apply file operations
    const { processed, modified } = applyFileOperations(processor);

    // Combine results (TypeScript files are processed separately)
    const totalProcessed = processed + tsProcessed;
    const totalModified = modified + tsModified;

    // Display summary
    displayMigrationSummary(renamedDirs, totalProcessed, totalModified, dryRun);

  } catch (err) {
    error(`Branding migration failed: ${err}`);
    throw err;
  }
}

/**
 * CLI entry point
 */
async function main() {
  try {
    await runOxcToRelinter();
  } catch (err) {
    process.exit(1);
  }
}

// Run the branding migration if called directly
if (process.argv[1]?.endsWith('2-oxc-to-relinter.ts')) {
  main();
}
