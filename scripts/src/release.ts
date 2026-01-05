#!/usr/bin/env bun
import { $ } from 'bun'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

type SemverType = 'major' | 'minor' | 'patch' | 'prerelease' | 'current'

interface PackageInfo {
  name: string
  version: string
  path: string
  hasBin: boolean
  publishable: boolean
  modified: boolean
  lastVersion?: string
  publishedVersion?: string
}

interface ReleaseOptions {
  version?: string
  semverType?: SemverType
  packages?: string[]
  auto: boolean
  dryRun: boolean
  yes: boolean
}

async function getAllPackages(): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = []
  const packagesDir = join(process.cwd(), 'packages')

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packagePath = join(packagesDir, entry.name)
        const packageJsonPath = join(packagePath, 'package.json')

        try {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

          // Include all packages that are not private and are part of the Rempts ecosystem
          const isPublishable = !packageJson.private && (
            packageJson.name.startsWith('@reliverse/rempts-') ||
            packageJson.name === 'rempts' ||
            packageJson.name === 'rempts'
          )

          packages.push({
            name: packageJson.name,
            version: packageJson.version,
            path: packagePath,
            hasBin: !!packageJson.bin,
            publishable: isPublishable,
            modified: false // Will be set by detectModifiedPackages
          })
        } catch (error) {
          console.warn(`⚠️  Could not read package.json for ${entry.name}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('❌ Error reading packages directory:', error)
    process.exit(1)
  }

  return packages
}

async function getPublishedVersions(packages: PackageInfo[]): Promise<Map<string, string>> {
  const publishedVersions = new Map<string, string>()

  console.log('🔍 Checking published versions on npm...')

  for (const pkg of packages) {
    if (pkg.publishable) {
      try {
        const { stdout: npmVersion } = await $`bun info ${pkg.name} version`.quiet()
        const version = npmVersion.toString().trim()
        if (version) {
          publishedVersions.set(pkg.name, version)
        }
      } catch {
        // Package doesn't exist on npm yet
        publishedVersions.set(pkg.name, 'not-published')
      }
    }
  }

  return publishedVersions
}

async function detectModifiedPackages(packages: PackageInfo[]): Promise<PackageInfo[]> {
  console.log('🔍 Detecting modified packages since last release...')

  try {
    // Get the last release tag
    const { stdout: lastTag } = await $`git describe --tags --abbrev=0`.quiet()
    const lastRelease = lastTag.toString().trim()

    if (!lastRelease) {
      console.log('ℹ️  No previous release found, all packages will be included')
      return packages.map(pkg => ({ ...pkg, modified: true }))
    }

    console.log(`📋 Comparing against last release: ${lastRelease}`)

    // Get list of modified files since last release
    const { stdout: modifiedFiles } = await $`git diff --name-only ${lastRelease}..HEAD`.quiet()
    const files = modifiedFiles.toString().trim().split('\n').filter(Boolean)

    // Check which packages have been modified
    const modifiedPackages = new Set<string>()

    for (const file of files) {
      if (file.startsWith('packages/')) {
        const packageName = file.split('/')[1]
        if (packageName) {
          modifiedPackages.add(packageName)
        }
      }
    }

    // Get package versions from the last release for comparison
    const lastReleaseVersions = new Map<string, string>()
    try {
      for (const pkg of packages) {
        const packageDir = pkg.path.split('/').pop() || ''
        if (modifiedPackages.has(packageDir)) {
          try {
            const { stdout: lastVersion } = await $`git show ${lastRelease}:packages/${packageDir}/package.json | grep '"version"' | head -1 | cut -d'"' -f4`.quiet()
            lastReleaseVersions.set(packageDir, lastVersion.toString().trim())
          } catch {
            // If we can't get the last version, that's okay
          }
        }
      }
    } catch {
      // If we can't get last release versions, continue without them
    }

    // Get published versions from npm
    const publishedVersions = await getPublishedVersions(packages)

    // Update packages with modification status, last version info, and published version
    const updatedPackages = packages.map(pkg => {
      const packageDir = pkg.path.split('/').pop() || ''
      const lastVersion = lastReleaseVersions.get(packageDir)
      const publishedVersion = publishedVersions.get(pkg.name)
      return {
        ...pkg,
        modified: modifiedPackages.has(packageDir),
        lastVersion: lastVersion,
        publishedVersion: publishedVersion
      }
    })

    const modifiedCount = updatedPackages.filter(p => p.modified).length
    console.log(`📊 Found ${modifiedCount} modified packages out of ${packages.length} total`)

    return updatedPackages
  } catch (error) {
    console.warn('⚠️  Could not detect modified packages, including all packages:', error)
    return packages.map(pkg => ({ ...pkg, modified: true }))
  }
}

function calculateNewVersion(currentVersion: string, semverType: SemverType): string {
  const [major, minor, patch, ...prerelease] = currentVersion.split(/[.-]/)
  if (!major || !minor || !patch) {
    throw new Error('Invalid version format')
  }

  switch (semverType) {
    case 'major':
      return `${parseInt(major) + 1}.0.0`
    case 'minor':
      return `${major}.${parseInt(minor) + 1}.0`
    case 'patch':
      return `${major}.${minor}.${parseInt(patch) + 1}`
    case 'prerelease':
      const prereleaseStr = prerelease.join('-')
      if (prereleaseStr) {
        // Increment prerelease version
        const parts = prereleaseStr.split('.')
        const lastPart = parts[parts.length - 1]
        if (lastPart && /^\d+$/.test(lastPart)) {
          parts[parts.length - 1] = (parseInt(lastPart) + 1).toString()
        } else {
          parts.push('1')
        }
        return `${major}.${minor}.${patch}-${parts.join('.')}`
      } else {
        return `${major}.${minor}.${parseInt(patch) + 1}-beta.1`
      }
    default:
      throw new Error(`Invalid semver type: ${semverType}`)
  }
}

async function promptForReleaseOptions(packages: PackageInfo[], options: ReleaseOptions): Promise<ReleaseOptions> {
  const modifiedPackages = packages.filter(p => p.modified && p.publishable)

  console.log('\n🎯 Release Configuration')
  console.log('='.repeat(50))

  // Show modified packages
  if (modifiedPackages.length > 0) {
    console.log('\n📦 Modified packages since last release:')
    modifiedPackages.forEach(pkg => {
      const gitProgression = pkg.lastVersion && pkg.lastVersion !== pkg.version
        ? `${pkg.lastVersion} → ${pkg.version}`
        : `@${pkg.version}`

      const npmStatus = pkg.publishedVersion === 'not-published'
        ? 'not published'
        : `published @${pkg.publishedVersion}`

      const needsPublish = pkg.publishedVersion === 'not-published' ||
        (pkg.publishedVersion && pkg.publishedVersion !== pkg.version)

      const statusIcon = needsPublish ? '📤' : '✅'

      console.log(`  ${statusIcon} ${pkg.name}: ${gitProgression} (${npmStatus})`)
    })
  } else {
    console.log('\n📦 No modified packages detected since last release')
  }

  // Show summary of what needs publishing
  const needsPublishing = modifiedPackages.filter(pkg =>
    pkg.publishedVersion === 'not-published' ||
    (pkg.publishedVersion && pkg.publishedVersion !== pkg.version)
  )

  if (needsPublishing.length > 0) {
    console.log(`\n📤 ${needsPublishing.length} package(s) need publishing:`)
    needsPublishing.forEach(pkg => {
      console.log(`  • ${pkg.name}@${pkg.version}`)
    })
  }

  // Get current version (use the first package as reference)
  const currentVersion = packages[0]?.version || '0.0.0'
  console.log(`\n📋 Current version: ${currentVersion}`)

  // Calculate suggested versions
  const suggestedVersions = {
    patch: calculateNewVersion(currentVersion, 'patch'),
    minor: calculateNewVersion(currentVersion, 'minor'),
    major: calculateNewVersion(currentVersion, 'major'),
    prerelease: calculateNewVersion(currentVersion, 'prerelease')
  }

  console.log('\n🚀 Suggested versions:')
  console.log(`  patch: ${suggestedVersions.patch} (bug fixes)`)
  console.log(`  minor: ${suggestedVersions.minor} (new features)`)
  console.log(`  major: ${suggestedVersions.major} (breaking changes)`)
  console.log(`  prerelease: ${suggestedVersions.prerelease} (pre-release)`)

  // Auto-select version based on what needs publishing
  let newVersion: string
  let semverType: string

  // Check if we just need to publish existing versions
  const packagesNeedingPublish = modifiedPackages.filter(pkg =>
    pkg.publishedVersion === 'not-published' ||
    (pkg.publishedVersion && pkg.publishedVersion !== pkg.version)
  )

  if (packagesNeedingPublish.length > 0) {
    // We have packages that need publishing at their current version
    newVersion = currentVersion
    semverType = 'current'
    console.log(`\n✅ Auto-selected: publish current versions → ${newVersion}`)
  } else if (modifiedPackages.length > 0) {
    // We have changes but packages are already published, suggest a bump
    semverType = 'minor'
    newVersion = calculateNewVersion(currentVersion, 'minor')
    console.log(`\n✅ Auto-selected: ${semverType} release → ${newVersion}`)
  } else {
    // No changes, suggest patch
    semverType = 'patch'
    newVersion = calculateNewVersion(currentVersion, 'patch')
    console.log(`\n✅ Auto-selected: ${semverType} release → ${newVersion}`)
  }

  // Skip confirmation if --yes flag is provided
  if (!options.yes) {
    console.log('\n❓ Proceed with this release? (y/N)')
    console.log('   Use --yes flag to skip this prompt')

    try {
      // Use Bun's built-in stdin reading
      const stdin = process.stdin
      stdin.setRawMode(true)
      stdin.resume()
      stdin.setEncoding('utf8')

      const response = await new Promise<string>((resolve) => {
        stdin.once('data', (key) => {
          stdin.setRawMode(false)
          stdin.pause()
          resolve(key.toString().toLowerCase())
        })
      })

      if (response !== 'y' && response !== 'yes') {
        console.log('\n❌ Release cancelled by user')
        process.exit(0)
      }

      console.log('\n🚀 Proceeding with release...')
    } catch (error) {
      // Fallback: if stdin reading fails, ask user to run with --dry-run first
      console.log('\n⚠️  Could not prompt for confirmation. Please run with --dry-run first to preview:')
      console.log(`   bun scripts/release.ts --auto --dry-run`)
      console.log('\nThen run without --dry-run to execute:')
      console.log(`   bun scripts/release.ts --auto`)
      console.log('\nOr use --yes flag to skip confirmation:')
      console.log(`   bun scripts/release.ts --auto --yes`)
      process.exit(1)
    }
  } else {
    console.log('\n🚀 Proceeding with release (--yes flag provided)...')
  }

  return {
    ...options,
    version: newVersion,
    semverType: semverType as SemverType,
    packages: modifiedPackages.map(p => p.name),
    auto: true,
    dryRun: false,
  }
}

async function updatePackageVersion(packagePath: string, newVersion: string): Promise<void> {
  const packageJsonPath = join(packagePath, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

  // Only update if version is different (idempotent)
  if (packageJson.version !== newVersion) {
    packageJson.version = newVersion
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  }
}

async function runTests(): Promise<boolean> {
  console.log('🧪 Running tests...')
  try {
    await $`bun test`
    console.log('✅ All tests passed')
    return true
  } catch (error) {
    console.error('❌ Tests failed:', error)
    return false
  }
}

async function buildPackages(): Promise<boolean> {
  console.log('🔨 Building packages...')
  try {
    await $`bun run build`
    console.log('✅ All packages built successfully')
    return true
  } catch (error) {
    console.error('❌ Build failed:', error)
    return false
  }
}

async function publishPackages(packages: PackageInfo[]): Promise<void> {
  const publishablePackages = packages.filter(p => p.publishable)

  if (publishablePackages.length === 0) {
    console.log('ℹ️  No publishable packages found')
    return
  }

  console.log(`📦 Publishing ${publishablePackages.length} packages...`)

  for (const pkg of publishablePackages) {
    console.log(`📤 Publishing ${pkg.name}@${pkg.version}...`)
    try {
      // Check if package version already exists on npm
      try {
        const { stdout: npmInfo } = await $`bun info ${pkg.name}@${pkg.version} version`.quiet()
        if (npmInfo && npmInfo.toString().trim()) {
          console.log(`ℹ️  ${pkg.name}@${pkg.version} already published, skipping`)
          continue
        }
      } catch (infoError) {
        // Package version doesn't exist, proceed with publishing
        console.log(`ℹ️  ${pkg.name}@${pkg.version} not found on npm, proceeding with publish`)
      }

      await $`cd ${pkg.path} && bun publish --access public`
      console.log(`✅ Published ${pkg.name}@${pkg.version}`)
    } catch (error) {
      console.error(`❌ Failed to publish ${pkg.name}:`, error)
      throw error
    }
  }
}

async function createGitTag(version: string): Promise<void> {
  console.log(`🏷️  Creating git tag v${version}...`)
  try {
    // Check if there are any changes to commit
    const { stdout: statusOutput } = await $`git status --porcelain`.quiet()
    if (statusOutput.toString().trim()) {
      await $`git add .`
      await $`git commit -m "chore: release v${version}"`
      console.log(`✅ Committed changes for v${version}`)
    } else {
      console.log(`ℹ️  No changes to commit for v${version}`)
    }

    // Check if tag already exists
    const { stdout: tagOutput } = await $`git tag -l v${version}`.quiet()
    if (!tagOutput.toString().trim()) {
      await $`git tag v${version}`
      console.log(`✅ Created tag v${version}`)
    } else {
      console.log(`ℹ️  Tag v${version} already exists`)
    }
  } catch (error) {
    console.error('❌ Failed to create git tag:', error)
    throw error
  }
}

function parseArgs(args: string[]): ReleaseOptions {
  const options: ReleaseOptions = {
    auto: false,
    dryRun: false,
    yes: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--help':
      case '-h':
        return { ...options, version: '--help' }
      case '--auto':
      case '-a':
        options.auto = true
        break
      case '--dry-run':
      case '-d':
        options.dryRun = true
        break
      case '--yes':
      case '-y':
        options.yes = true
        break
      case '--patch':
        options.semverType = 'patch'
        break
      case '--minor':
        options.semverType = 'minor'
        break
      case '--major':
        options.semverType = 'major'
        break
      case '--prerelease':
        options.semverType = 'prerelease'
        break
      case '--packages':
        if (i + 1 < args.length) {
          options.packages = args[i + 1]?.split(',').map(p => p.trim())
          i++
        }
        break
      default:
        if (arg && !arg.startsWith('-') && !options.version) {
          options.version = arg
        }
        break
    }
  }

  return options
}

async function main() {
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  if (options.version === '--help' || args.length === 0) {
    console.log('🚀 Rempts Release Script')
    console.log('')
    console.log('Usage: bun scripts/release.ts [options] [version]')
    console.log('')
    console.log('Options:')
    console.log('  --auto, -a              Auto-detect version and packages')
    console.log('  --dry-run, -d           Show what would be done without executing')
    console.log('  --yes, -y               Skip confirmation prompt (use with caution)')
    console.log('  --patch                 Bump patch version (bug fixes)')
    console.log('  --minor                 Bump minor version (new features)')
    console.log('  --major                 Bump major version (breaking changes)')
    console.log('  --prerelease            Bump prerelease version')
    console.log('  --packages <list>       Comma-separated list of packages to release')
    console.log('  --help, -h              Show this help message')
    console.log('')
    console.log('Examples:')
    console.log('  bun scripts/release.ts --auto                    # Auto-detect everything')
    console.log('  bun scripts/release.ts --minor                   # Bump minor version')
    console.log('  bun scripts/release.ts 0.2.1                    # Specific version')
    console.log('  bun scripts/release.ts --packages rempts,core     # Release specific packages')
    console.log('  bun scripts/release.ts --dry-run --minor         # Preview minor release')
    console.log('')
    console.log('This script will:')
    console.log('1. Detect modified packages since last release')
    console.log('2. Run tests')
    console.log('3. Build all packages')
    console.log('4. Update version numbers (idempotent)')
    console.log('5. Publish to npm (idempotent)')
    console.log('6. Create git tags (idempotent)')
    console.log('')
    console.log('The script is idempotent - it can be run multiple times safely.')
    console.log('')
    process.exit(0)
  }

  console.log('🚀 Rempts Release Script')
  console.log('')

  // Get all packages and detect modifications
  const allPackages = await getAllPackages()
  const packages = await detectModifiedPackages(allPackages)

  // Determine release options
  let releaseOptions: ReleaseOptions

  if (options.auto || (!options.version && !options.semverType)) {
    // Auto-detect mode
    releaseOptions = await promptForReleaseOptions(packages, options)
  } else {
    // Manual mode
    const currentVersion = packages[0]?.version || '0.0.0'
    let newVersion = options.version

    if (options.semverType && !newVersion) {
      newVersion = calculateNewVersion(currentVersion, options.semverType)
    }

    if (!newVersion) {
      console.error('❌ No version specified. Use --auto, provide a version, or specify --patch/--minor/--major')
      process.exit(1)
    }

    // Basic version validation
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(newVersion)) {
      console.error('❌ Invalid version format. Use semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)')
      process.exit(1)
    }

    releaseOptions = {
      ...options,
      version: newVersion,
      semverType: options.semverType,
      packages: options.packages,
      auto: false,
      dryRun: options.dryRun
    }
  }

  // Filter packages if specific packages were requested
  let packagesToRelease = packages
  if (releaseOptions.packages && releaseOptions.packages.length > 0) {
    packagesToRelease = packages.filter(pkg =>
      releaseOptions.packages!.includes(pkg.name) ||
      releaseOptions.packages!.includes(pkg.name.split('/').pop() || '')
    )
  }

  console.log(`\n📋 Release Plan:`)
  console.log(`  Version: ${releaseOptions.version}`)
  console.log(`  Packages: ${packagesToRelease.filter(p => p.publishable).length} publishable`)
  console.log(`  Mode: ${releaseOptions.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  if (releaseOptions.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('')
  }

  // Run tests
  if (!releaseOptions.dryRun) {
    if (!(await runTests())) {
      console.log('❌ Release aborted due to test failures')
      process.exit(1)
    }
    console.log('')
  } else {
    console.log('🧪 [DRY RUN] Would run tests')
    console.log('')
  }

  // Build packages
  if (!releaseOptions.dryRun) {
    if (!(await buildPackages())) {
      console.log('❌ Release aborted due to build failures')
      process.exit(1)
    }
    console.log('')
  } else {
    console.log('🔨 [DRY RUN] Would build packages')
    console.log('')
  }

  // Update versions
  console.log(`📝 ${releaseOptions.dryRun ? '[DRY RUN] Would update' : 'Updating'} packages to version ${releaseOptions.version}...`)
  let updatedCount = 0
  for (const pkg of packagesToRelease) {
    const oldVersion = pkg.version
    if (!releaseOptions.dryRun) {
      await updatePackageVersion(pkg.path, releaseOptions.version!)
    }
    if (oldVersion !== releaseOptions.version) {
      console.log(`${releaseOptions.dryRun ? '🔍 [DRY RUN]' : '✅'} ${releaseOptions.dryRun ? 'Would update' : 'Updated'} ${pkg.name} from ${oldVersion} to ${releaseOptions.version}`)
      updatedCount++
    } else {
      console.log(`ℹ️  ${pkg.name} already at version ${releaseOptions.version}`)
    }
  }
  console.log(`📊 ${releaseOptions.dryRun ? '[DRY RUN] Would update' : 'Updated'} ${updatedCount} packages, ${packagesToRelease.length - updatedCount} already at target version`)
  console.log('')

  // Publish packages
  if (!releaseOptions.dryRun) {
    await publishPackages(packagesToRelease)
  } else {
    console.log('📦 [DRY RUN] Would publish packages:')
    packagesToRelease.filter(p => p.publishable).forEach(pkg => {
      console.log(`  • ${pkg.name}@${releaseOptions.version}`)
    })
  }
  console.log('')

  // Create git tag
  if (!releaseOptions.dryRun) {
    await createGitTag(releaseOptions.version!)
  } else {
    console.log(`🏷️  [DRY RUN] Would create git tag v${releaseOptions.version}`)
  }
  console.log('')

  if (releaseOptions.dryRun) {
    console.log('🔍 DRY RUN COMPLETED - No changes were made')
    console.log('')
    console.log('To execute this release, run the same command without --dry-run')
  } else {
    console.log('🎉 Release completed successfully!')
    console.log(`📦 Published version ${releaseOptions.version}`)
    console.log('🏷️  Git tag created')
    console.log('')
    console.log('Next steps:')
    console.log('  git push origin main --tags')
  }
}

main().catch(error => {
  console.error('❌ Release failed:', error)
  process.exit(1)
})