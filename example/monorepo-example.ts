#!/usr/bin/env bun
/**
 * Example demonstrating the new monorepo build orchestration features
 *
 * This example shows how to use the monorepo functionality programmatically
 * instead of through CLI commands.
 */

import {
  DependencyGraph,
  findMonorepo,
  hashPackage,
  type MonorepoContext,
  readMonorepoPackageJson,
} from "~/mod";

async function demonstrateMonorepoFeatures() {
  console.log("🔍 Monorepo Build Orchestration Demo\n");

  // 1. Find and analyze the monorepo
  console.log("1. Detecting monorepo...");
  const monorepo = await findMonorepo();

  if (!monorepo) {
    console.log("❌ No monorepo found. Please run this from within a monorepo.");
    return;
  }

  console.log(`✅ Found monorepo at: ${monorepo.root}`);
  console.log(`   Package manager: ${monorepo.packageManager.name}`);
  console.log(`   Package patterns: ${monorepo.packageGlobs.join(", ")}\n`);

  // 2. Create dependency graph
  console.log("2. Building dependency graph...");
  const { globby } = await import("globby");
  const packageJsonGlobs = monorepo.packageGlobs.map((glob) => `${glob}/package.json`);
  const matches = await globby(packageJsonGlobs, { cwd: monorepo.root, absolute: true });

  const packages = [];
  for (const packageJsonPath of matches) {
    const pkg = await readMonorepoPackageJson(packageJsonPath);
    if (pkg) {
      packages.push(pkg);
    }
  }

  const graph = new DependencyGraph(packages);
  console.log(`✅ Found ${packages.length} packages: ${packages.map((p) => p.name).join(", ")}\n`);

  // 3. Show dependency graph
  console.log("3. Dependency graph:");
  graph.print();
  console.log();

  // 4. Show build order
  console.log("4. Build order:");
  const buildOrder = graph.getOverallBuildOrder();
  console.log(`   ${buildOrder.map((p) => p.name).join(" → ")}\n`);

  // 5. Show active package and its dependencies
  console.log("5. Active package analysis:");
  const activePackage = graph.findActivePackage();
  if (activePackage) {
    console.log(`   Active package: ${activePackage.name}`);
    const deps = graph.getPackageDependenciesBuildOrder(activePackage.name);
    console.log(`   Dependencies: ${deps.map((p) => p.name).join(", ")}`);
    console.log(`   Build script: ${activePackage.buildScript || "None"}`);
    console.log(`   Cache enabled: ${activePackage.config.cache}`);
    console.log(`   Output dir: ${activePackage.config.outDir}\n`);
  } else {
    console.log("   No active package found (not in a package directory)\n");
  }

  // 6. Demonstrate package hashing
  console.log("6. Package hashing (for cache keys):");
  for (const pkg of packages) {
    const { packageHash } = await hashPackage(pkg);
    console.log(`   ${pkg.name}: ${packageHash.substring(0, 12)}...`);
  }
  console.log();

  // 7. Show available commands
  console.log("7. Available monorepo commands:");
  console.log("   bun run dler monorepo-build --command 'unbuild'");
  console.log("   bun run dler monorepo-deps");
  console.log("   bun run dler monorepo-all");
  console.log("   bun run dler monorepo-graph");
  console.log("   bun run dler monorepo-clean");
  console.log();

  // 8. Demonstrate command context
  console.log("8. Command context example:");
  const ctx: MonorepoContext = {
    isDebug: true,
    cmdArgs: ["unbuild", "--minify"],
  };
  console.log(`   Debug mode: ${ctx.isDebug}`);
  console.log(`   Command args: ${ctx.cmdArgs.join(" ")}\n`);

  console.log("✅ Demo completed! The monorepo functionality is ready to use.");
}

// Run the demo
demonstrateMonorepoFeatures().catch(console.error);
