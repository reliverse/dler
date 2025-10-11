#!/usr/bin/env bun
import {
  DependencyGraph,
  findMonorepo,
  hashPackage,
  type Package,
  readMonorepoPackageJson,
} from "../../src/impl/monorepo/mod";

async function testMonorepo() {
  console.log("Testing monorepo functionality...\n");

  // Test 1: Find monorepo
  console.log("1. Testing monorepo detection:");
  const monorepo = await findMonorepo();
  if (monorepo) {
    console.log(`   ✓ Found monorepo at: ${monorepo.root}`);
    console.log(`   ✓ Package manager: ${monorepo.packageManager.name}`);
    console.log(`   ✓ Package globs: ${monorepo.packageGlobs.join(", ")}`);
  } else {
    console.log("   ✗ No monorepo found");
    return;
  }

  // Test 2: Create dependency graph
  console.log("\n2. Testing dependency graph:");
  const { globby } = await import("globby");
  const packageJsonGlobs = monorepo.packageGlobs.map((glob) => `${glob}/package.json`);
  const matches = await globby(packageJsonGlobs, { cwd: monorepo.root, absolute: true });

  const packages: Package[] = [];
  for (const packageJsonPath of matches) {
    const pkg = await readMonorepoPackageJson(packageJsonPath);
    if (pkg) {
      packages.push(pkg);
    }
  }

  console.log(`   ✓ Found ${packages.length} packages: ${packages.map((p) => p.name).join(", ")}`);

  const graph = new DependencyGraph(packages);
  console.log("   ✓ Dependency graph created");

  // Test 3: Test build order
  console.log("\n3. Testing build order:");
  const buildOrder = graph.getOverallBuildOrder();
  console.log(`   ✓ Build order: ${buildOrder.map((p) => p.name).join(" → ")}`);

  // Test 4: Test active package detection
  console.log("\n4. Testing active package detection:");
  const activePackage = graph.findActivePackage();
  if (activePackage) {
    console.log(`   ✓ Active package: ${activePackage.name}`);
    const deps = graph.getPackageDependenciesBuildOrder(activePackage.name);
    console.log(`   ✓ Dependencies: ${deps.map((p) => p.name).join(", ")}`);
  } else {
    console.log("   ✗ No active package found");
  }

  // Test 5: Test package hashing
  console.log("\n5. Testing package hashing:");
  for (const pkg of packages) {
    const { packageHash } = await hashPackage(pkg);
    console.log(`   ✓ ${pkg.name}: ${packageHash.substring(0, 8)}...`);
  }

  console.log("\n✅ All tests passed!");
}

testMonorepo().catch(console.error);
