import type { PackageJson } from "pkg-types";

import { resolve } from "@reliverse/pathkit";
import { existsSync } from "node:fs";

import type { BuildContext } from "~/libs/sdk/sdk-types";

import { arrayIncludes, extractExportFilenames, getpkg, warn } from "./utils";

export function validateDependencies(ctx: BuildContext): void {
  const usedDependencies = new Set<string>();
  const unusedDependencies = new Set<string>(Object.keys(ctx.pkg.dependencies || {}));
  const implicitDependencies = new Set<string>();
  for (const id of ctx.usedImports) {
    unusedDependencies.delete(id);
    usedDependencies.add(id);
  }
  if (Array.isArray(ctx.options.dependencies)) {
    for (const id of ctx.options.dependencies) {
      unusedDependencies.delete(id);
    }
  }
  for (const id of usedDependencies) {
    if (
      !arrayIncludes(ctx.options.externals, id) &&
      !id.startsWith("chunks/") &&
      !ctx.options.dependencies.includes(getpkg(id)) &&
      !ctx.options.peerDependencies.includes(getpkg(id))
    ) {
      implicitDependencies.add(id);
    }
  }
  if (unusedDependencies.size > 0) {
    warn(ctx, `Potential unused dependencies found: ${[...unusedDependencies].join(", ")}`);
  }
  if (implicitDependencies.size > 0 && !ctx.options.rollup.inlineDependencies) {
    warn(ctx, `Potential implicit dependencies found: ${[...implicitDependencies].join(", ")}`);
  }
}

export function validatePackage(pkg: PackageJson, rootDir: string, ctx: BuildContext): void {
  if (!pkg) {
    return;
  }

  const filenames = new Set(
    [
      ...(typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin || {})),
      pkg.main,
      pkg.module,
      pkg.types,
      pkg.typings,
      ...extractExportFilenames(pkg.exports).map((i) => i.file),
    ].map((i) => i && resolve(rootDir, i.replace(/\/[^/]*\*.*$/, ""))),
  );

  const missingOutputs = [];

  for (const filename of filenames) {
    if (filename && !filename.includes("*") && !existsSync(filename)) {
      missingOutputs.push(filename.replace(`${rootDir}/`, ""));
    }
  }
  if (missingOutputs.length > 0) {
    warn(ctx, `Potential missing package.json files: ${missingOutputs.join(", ")}`);
  }
}
