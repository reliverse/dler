import { relinka } from "@reliverse/relinka";
import { execaCommand } from "execa";
import { globby } from "globby";
import {
  cachePackageOutput,
  cleanCache,
  hashPackage,
  isPackageCached,
  restorePackageCache,
} from "./cache-mod";
import { DependencyGraph } from "./graph-mod";
import {
  findMonorepo,
  getCacheDir,
  type Monorepo,
  type Package,
  readPackageJson,
} from "./monorepo-mod";

export interface MonorepoContext {
  isDebug: boolean;
  cmdArgs: string[];
}

/**
 * Build command - builds dependencies and runs the command
 */
export async function buildCommand(ctx: MonorepoContext): Promise<void> {
  // Check if we're inside another dler command
  if (process.env.INSIDE_DLER === "true") {
    if (ctx.isDebug) {
      relinka(
        "log",
        `[dler] → Ignoring dler, running command immediately: ${ctx.cmdArgs.join(" ")}`,
      );
    }
    if (ctx.cmdArgs.length === 0) {
      relinka("error", "No command provided");
      process.exit(1);
    }
    const command = ctx.cmdArgs.join(" ");
    await execaCommand(command);
    return;
  }

  const monorepo = await requireMonorepo(ctx);
  const graph = await createGraph(monorepo);
  const activePackage = requireActivePackage(ctx, graph);

  const dependencies = graph.getPackageDependenciesBuildOrder(
    activePackage.name,
  );
  const packagesToBuild = [...dependencies, activePackage];

  await buildCachedPackages(ctx, monorepo, packagesToBuild);
}

/**
 * Deps command - builds dependencies only
 */
export async function depsCommand(ctx: MonorepoContext): Promise<void> {
  // Check if we're inside another dler command
  if (process.env.INSIDE_DLER === "true") {
    return; // Dependencies already built by parent
  }

  const monorepo = await requireMonorepo(ctx);
  const graph = await createGraph(monorepo);
  const activePackage = requireActivePackage(ctx, graph);
  const dependencies = graph.getPackageDependenciesBuildOrder(
    activePackage.name,
  );

  await buildCachedPackages(ctx, monorepo, dependencies);
}

/**
 * All command - builds all packages in the monorepo
 */
export async function allCommand(ctx: MonorepoContext): Promise<void> {
  const monorepo = await requireMonorepo(ctx);
  const graph = await createGraph(monorepo);
  const packages = graph.getOverallBuildOrder();

  await buildCachedPackages(ctx, monorepo, packages);
}

/**
 * Graph command - prints the dependency graph
 */
export async function graphCommand(ctx: MonorepoContext): Promise<void> {
  const monorepo = await requireMonorepo(ctx);
  const graph = await createGraph(monorepo);
  graph.print();
}

/**
 * Clean command - deletes the build cache
 */
export async function cleanCommand(ctx: MonorepoContext): Promise<void> {
  const monorepo = await findMonorepo();
  if (monorepo) {
    const cacheDir = getCacheDir(monorepo);
    if (ctx.isDebug) {
      relinka("log", `[dler] → Deleting cache at ${cacheDir}`);
    }
    await cleanCache(monorepo);
  } else {
    if (ctx.isDebug) {
      relinka("log", "[dler] → Not in monorepo");
    }
  }

  relinka("log", "✓ Cache deleted");
}

/**
 * Helper function to require a monorepo or exit
 */
async function requireMonorepo(ctx: MonorepoContext): Promise<Monorepo> {
  const monorepo = await findMonorepo();
  if (!monorepo) {
    relinka("error", "Monorepo root not found. Are you inside a monorepo?");
    process.exit(1);
  }

  if (ctx.isDebug) {
    relinka("log", `[dler] → Monorepo found at ${monorepo.root}`);
  }

  return monorepo;
}

/**
 * Helper function to create a dependency graph
 */
async function createGraph(monorepo: Monorepo): Promise<DependencyGraph> {
  const packageJsonGlobs = monorepo.packageGlobs.map(
    (glob) => `${glob}/package.json`,
  );
  const matches = await globby(packageJsonGlobs, {
    cwd: monorepo.root,
    absolute: true,
  });

  const packages: Package[] = [];
  for (const packageJsonPath of matches) {
    const pkg = await readPackageJson(packageJsonPath);
    if (pkg) {
      packages.push(pkg);
    }
  }

  return new DependencyGraph(packages);
}

/**
 * Helper function to require an active package or exit
 */
function requireActivePackage(
  ctx: MonorepoContext,
  graph: DependencyGraph,
): Package {
  const activePackage = graph.findActivePackage();
  if (!activePackage) {
    relinka(
      "error",
      "Not inside a package directory, could not determine dependencies to build",
    );
    process.exit(1);
  }

  if (ctx.isDebug) {
    relinka("log", `[dler] → Active package ${activePackage.dir}`);
  }

  return activePackage;
}

/**
 * Build a list of packages with caching
 */
async function buildCachedPackages(
  ctx: MonorepoContext,
  monorepo: Monorepo,
  packages: Package[],
): Promise<void> {
  if (ctx.isDebug) {
    const packageNames = packages.map((p) => p.name);
    relinka("log", `[dler] → Packages to build: ${packageNames.join(", ")}`);
  }

  for (const pkg of packages) {
    await buildCachedPackage(ctx, monorepo, pkg);
  }
}

/**
 * Build a single package with caching
 */
async function buildCachedPackage(
  ctx: MonorepoContext,
  monorepo: Monorepo,
  pkg: Package,
): Promise<void> {
  if (!pkg.buildScript) {
    relinka("log", `✓ ${pkg.name}: Nothing to build`);
    return;
  }

  const args = [...monorepo.packageManager.runCmd, "build"];
  if (ctx.isDebug) {
    const relativeDir = pkg.dir.replace(monorepo.root, "").replace(/^\//, "");
    relinka("log", `[dler] → Running ${args.join(" ")} in ${relativeDir}`);
  }

  relinka("log", `◐ ${pkg.name}: ${pkg.buildScript}`);

  const { packageHash } = await hashPackage(pkg);
  const cacheDir = getPackageCacheDir(monorepo, pkg, packageHash);

  if (ctx.isDebug) {
    relinka("log", `[dler] → Cache dir: ${cacheDir}`);
  }

  // Check if package is cached
  if ((await isPackageCached(monorepo, pkg, packageHash)) && pkg.config.cache) {
    await restorePackageCache(monorepo, pkg, packageHash);
    relinka("log", `✓ ${pkg.name}: Cached!`);
    return;
  }

  // Build the package
  await execInDir(pkg.dir, args);

  // Cache the output if enabled
  if (pkg.config.cache) {
    await cachePackageOutput(monorepo, pkg, packageHash);
  }

  relinka("log", `✓ ${pkg.name}: Built`);
}

/**
 * Execute a command in a specific directory
 */
async function execInDir(dir: string, args: string[]): Promise<void> {
  if (args.length === 0) {
    relinka("error", "No command provided");
    process.exit(1);
  }
  const command = args.join(" ");
  await execaCommand(command, {
    cwd: dir,
    env: { ...process.env, INSIDE_DLER: "true" },
  });
}

/**
 * Get the cache directory for a package
 */
function getPackageCacheDir(
  monorepo: Monorepo,
  pkg: Package,
  packageHash: string,
): string {
  return `${monorepo.root}/.cache/${pkg.name}/${packageHash}`;
}
