import dts from 'bun-plugin-dts'
import path from 'node:path'
import os from 'node:os'
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// Parse command line arguments
const args = process.argv.slice(2);
const providerIndex = args.indexOf('--provider');
const provider = providerIndex !== -1 && args[providerIndex + 1] 
  ? args[providerIndex + 1] 
  : 'xgo'; // Default to xgo

const targetIndex = args.indexOf('--target');
const target = targetIndex !== -1 && args[targetIndex + 1] 
  ? args[targetIndex + 1] 
  : null; // No target specified

if (provider !== 'xgo' && provider !== 'native') {
  console.error(`Error: Invalid provider "${provider}". Must be "xgo" or "native".`);
  process.exit(1);
}

console.log(`Using build provider: ${provider}`);
if (target) {
  console.log(`Target platform: ${target}`);
}

const output = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  external: ['bun:ffi'],
  plugins: [
    dts()
  ],
})


// Target platforms: [GOOS, GOARCH, outputSuffix, platformName]
// platformName is what Node.js process.platform returns
const TARGETS = [
  ['windows', 'amd64', 'dll', 'win32'],
  ['linux', 'amd64', 'so', 'linux'],
  ['linux', 'arm64', 'so', 'linux'],
  ['darwin', 'amd64', 'dylib', 'darwin'],
  ['darwin', 'arm64', 'dylib', 'darwin'],
];

async function buildTarget(goos, goarch, suffix, platformName) {
  const outputName = `dler-prompt-${platformName}-${goarch}.${suffix}`;
  const outputPath = path.join('release', outputName);
  
  // Ensure release directory exists
  if (!existsSync('release')) {
    await mkdir('release', { recursive: true });
  }
  
  console.log(`Building for ${goos}/${goarch}...`);
  
  const env = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: '1',
  };
  
  const proc = Bun.spawnSync([
    'go', 'build',
    '-buildmode=c-shared',
    '-ldflags=-s -w',
    '-o', outputPath,
    'main.go',
  ], {
    env,
    cwd: process.cwd(),
  });
  
  if (proc.exitCode !== 0) {
    console.error(`Failed to build for ${goos}/${goarch}`);
    if (proc.stderr) {
      console.error(proc.stderr.toString());
    }
    return false;
  }
  
  console.log(`✓ Built ${outputName}`);
  return true;
}

async function findGoFiles(dir = '.', goFiles = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, release, dist, and .git directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'release' || 
            entry.name === 'dist' || entry.name === '.git') {
          continue;
        }
        await findGoFiles(fullPath, goFiles);
      } else if (entry.isFile() && entry.name.endsWith('.go')) {
        goFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors (e.g., permission denied)
  }
  return goFiles;
}

// Map xgo target format to expected binary filename
function getExpectedBinaryName(target) {
  const [goos, goarch] = target.split('/');
  let platformName = goos;
  let suffix = '';
  
  if (goos === 'windows') {
    platformName = 'win32';
    suffix = '.dll';
  } else if (goos === 'linux') {
    platformName = 'linux';
    suffix = '.so';
  } else if (goos === 'darwin') {
    platformName = 'darwin';
    suffix = '.dylib';
  }
  
  return `dler-prompt-${platformName}-${goarch}${suffix}`;
}

async function shouldRebuild(targetsString) {
  // Parse targets
  const targets = targetsString.split(',').map(t => t.trim());
  
  // Check if release directory exists
  if (!existsSync('release')) {
    return { rebuild: true, reason: 'Release directory does not exist' };
  }
  
  try {
    const binaries = await readdir('release');
    
    // Find all Go files to get their modification times
    const goFiles = await findGoFiles();
    goFiles.push('go.mod');
    if (existsSync('go.sum')) {
      goFiles.push('go.sum');
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
    const missingBinaries = [];
    const outdatedBinaries = [];
    
    for (const target of targets) {
      const expectedBinary = getExpectedBinaryName(target);
      let binaryPath = path.join('release', expectedBinary);
      
      // For Windows, also check for windows variant (before rename)
      // xgo outputs: dler-prompt-windows-amd64.dll
      // We expect: dler-prompt-win32-amd64.dll
      if (target.startsWith('windows/') && !existsSync(binaryPath)) {
        // Check for windows-amd64 (xgo output format)
        const windowsBinary = expectedBinary.replace('win32', 'windows');
        const windowsPath = path.join('release', windowsBinary);
        if (existsSync(windowsPath)) {
          binaryPath = windowsPath;
        } else {
          // Also check for windows-4.0 variant (older xgo versions)
          const windows4Binary = expectedBinary.replace('win32', 'windows-4.0');
          const windows4Path = path.join('release', windows4Binary);
          if (existsSync(windows4Path)) {
            binaryPath = windows4Path;
          }
        }
      }
      
      if (!existsSync(binaryPath)) {
        missingBinaries.push(target);
        continue;
      }
      
      // Check if binary is older than any Go file
      const binaryStats = await stat(binaryPath);
      if (binaryStats.mtimeMs < newestGoFileTime) {
        outdatedBinaries.push(target);
      }
    }
    
    // Rebuild if any binaries are missing or outdated
    if (missingBinaries.length > 0) {
      return { 
        rebuild: true, 
        reason: `Missing binaries for: ${missingBinaries.join(', ')}` 
      };
    }
    
    if (outdatedBinaries.length > 0) {
      return { 
        rebuild: true, 
        reason: `Outdated binaries for: ${outdatedBinaries.join(', ')}` 
      };
    }
    
    // All required binaries exist and are up-to-date
    return { rebuild: false, reason: 'All binaries are up-to-date' };
  } catch (error) {
    // On error, rebuild to be safe
    return { 
      rebuild: true, 
      reason: `Error checking binaries: ${error.message}` 
    };
  }
}

async function buildWithXgo() {
  const xgoBase = path.join(os.homedir(), 'go/bin/xgo');
  const XGO = os.platform() === 'win32' ? `${xgoBase}.exe` : xgoBase;
  
  // Determine targets
  let TARGETS;
  if (target) {
    // Use specified target
    TARGETS = target;
  } else {
    // Default: build for all platforms
    TARGETS = 'linux/arm64,linux/amd64,darwin/arm64,darwin/amd64,windows/amd64';
  }
  
  // Check if rebuild is needed (per-platform check)
  const rebuildCheck = await shouldRebuild(TARGETS);
  if (!rebuildCheck.rebuild) {
    console.log(`✓ ${rebuildCheck.reason}, skipping rebuild`);
    return;
  }
  
  if (rebuildCheck.reason) {
    console.log(`Rebuilding: ${rebuildCheck.reason}`);
  }
  
  if (!existsSync(XGO)) {
    console.error(`Error: xgo not found at ${XGO}`);
    console.error('Please install xgo: go install github.com/crazy-max/xgo@latest');
    process.exit(1);
  }
  
  console.log('Compiling native binaries with xgo...');
  const proc = Bun.spawnSync([
    XGO,
    "-go", "1.20.3",
    "-out", "release/dler-prompt",
    `--targets=${TARGETS}`,
    "-ldflags=-s -w",
    "-buildmode=c-shared",
    ".",
  ]);
  console.log(proc.stdout.toString());
  
  if (proc.exitCode !== 0) {
    console.error('xgo compilation failed');
    if (proc.stderr) {
      console.error(proc.stderr.toString());
    }
    process.exit(1);
  }
  
  // Rename Windows binaries if release directory exists
  // xgo outputs: dler-prompt-windows-amd64.dll -> rename to dler-prompt-win32-amd64.dll
  if (existsSync('release')) {
    const binaries = await readdir('release');
    const windowsBinaries = binaries.filter((binary) => 
      binary.includes('windows') && !binary.includes('win32')
    );
    await Promise.all(
      windowsBinaries.map((binary) => {
        const binaryPath = path.join('release', binary);
        // Replace windows-4.0 or windows with win32
        const newPath = binaryPath.replace(/windows(-4\.0)?/g, 'win32');
        return rename(binaryPath, newPath);
      })
    );
  }
}

async function buildWithNative() {
  console.log('Compiling native binaries with native Go build...');
  
  // On Windows, CGO cross-compilation is limited, so only build for Windows
  const currentPlatform = os.platform();
  let targetsToBuild = TARGETS;
  
  if (currentPlatform === 'win32') {
    // On Windows, only build for Windows (CGO cross-compilation requires special setup)
    targetsToBuild = TARGETS.filter(([goos]) => goos === 'windows');
    console.log('Building only for Windows (CGO cross-compilation from Windows requires special setup)');
  }
  
  // Build for selected targets
  const results = await Promise.all(
    targetsToBuild.map(([goos, goarch, suffix, platformName]) => 
      buildTarget(goos, goarch, suffix, platformName).catch(err => {
        console.error(`Error building ${goos}/${goarch}:`, err.message);
        return false;
      })
    )
  );
  
  const successCount = results.filter(r => r === true).length;
  const failCount = results.filter(r => r === false).length;
  
  console.log(`\nBuild complete: ${successCount} succeeded, ${failCount} failed`);
  
  if (successCount === 0) {
    console.error('No targets built successfully');
    process.exit(1);
  }
}

if (output.success) {
  if (provider === 'xgo') {
    await buildWithXgo();
  } else {
    await buildWithNative();
  }
}
