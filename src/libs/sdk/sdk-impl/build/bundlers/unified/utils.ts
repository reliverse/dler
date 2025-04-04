import type { PackageJson } from "pkg-types";

import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";
import { readdirSync, statSync } from "node:fs";
import fsp from "node:fs/promises";
import { dirname, resolve } from "pathe";

import type { BuildContext, BuildPreset, UnifiedBuildConfig } from "./types.js";

import { autoPreset } from "./auto.js";

type OutputDescriptor = { file: string; type?: "cjs" | "esm" };

export function arrayIncludes(
  arr: (RegExp | string)[],
  searchElement: string,
): boolean {
  return arr.some((entry) =>
    entry instanceof RegExp
      ? entry.test(searchElement)
      : entry === searchElement,
  );
}

export function dumpObject(obj: Record<string, any>): string {
  return `{ ${Object.keys(obj)
    .map((key) => `${key}: ${JSON.stringify(obj[key])}`)
    .join(", ")} }`;
}

export async function ensuredir(path: string): Promise<void> {
  await fsp.mkdir(dirname(path), { recursive: true });
}

export function extractExportFilenames(
  exports: PackageJson["exports"],
  conditions: string[] = [],
): OutputDescriptor[] {
  if (!exports) {
    return [];
  }
  if (typeof exports === "string") {
    return [{ file: exports, type: "esm" }];
  }
  return (
    Object.entries(exports)
      // Filter out .json subpaths such as package.json
      .filter(([subpath]) => !subpath.endsWith(".json"))
      .flatMap(([condition, exports]) =>
        typeof exports === "string"
          ? {
              file: exports,
              type: inferExportType(condition, conditions, exports),
            }
          : extractExportFilenames(exports, [...conditions, condition]),
      )
  );
}

export function getpkg(id = ""): string {
  const s = id.split("/");
  return s[0]?.startsWith("@") ? `${s[0]}/${s[1] || ""}` : s[0] || "";
}

export function inferPkgExternals(pkg: PackageJson): (RegExp | string)[] {
  const externals: (RegExp | string)[] = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.devDependencies || {}).filter((dep) =>
      dep.startsWith("@types/"),
    ),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];

  if (pkg.name) {
    externals.push(pkg.name);
    if (pkg.exports) {
      for (const subpath of Object.keys(pkg.exports)) {
        if (subpath.startsWith("./")) {
          externals.push(pathToRegex(`${pkg.name}/${subpath.slice(2)}`));
        }
      }
    }
  }

  if (pkg.imports) {
    for (const importName of Object.keys(pkg.imports)) {
      if (importName.startsWith("#")) {
        externals.push(pathToRegex(importName));
      }
    }
  }

  return [...new Set(externals)];
}

export function listRecursively(path: string): string[] {
  const filenames = new Set<string>();
  const walk = (path: string): void => {
    const files = readdirSync(path);
    for (const file of files) {
      const fullPath = resolve(path, file);
      if (statSync(fullPath).isDirectory()) {
        filenames.add(`${fullPath}/`);
        walk(fullPath);
      } else {
        filenames.add(fullPath);
      }
    }
  };
  walk(path);
  return [...filenames];
}

export function removeExtension(filename: string): string {
  return filename.replace(/\.(js|mjs|cjs|ts|mts|cts|json|jsx|tsx)$/, "");
}

export async function resolvePreset(
  preset: BuildPreset | string,
  rootDir: string,
): Promise<UnifiedBuildConfig> {
  let resolvedPreset = preset;
  if (preset === "auto") {
    resolvedPreset = autoPreset;
  } else if (typeof preset === "string") {
    resolvedPreset =
      (await createJiti(rootDir, { interopDefault: true }).import(preset, {
        default: true,
      })) || {};
  }
  if (typeof resolvedPreset === "function") {
    resolvedPreset = resolvedPreset();
  }
  return resolvedPreset as UnifiedBuildConfig;
}

export async function rmdir(dir: string): Promise<void> {
  await fsp.unlink(dir).catch(() => {
    /* Ignore error if file doesn't exist */
  });
  await fsp.rm(dir, { force: true, recursive: true }).catch(() => {
    /* Ignore error if directory doesn't exist or can't be removed */
  });
}

export async function symlink(
  from: string,
  to: string,
  force = true,
): Promise<void> {
  await ensuredir(to);
  if (force) {
    await fsp.unlink(to).catch(() => {
      /* Ignore error if file doesn't exist */
    });
  }
  await fsp.symlink(from, to, "junction");
}

export function warn(ctx: BuildContext, message: string): void {
  if (ctx.warnings.has(message)) {
    return;
  }
  relinka("verbose", "[relidler] [warn]", message);
  ctx.warnings.add(message);
}

export function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function inferExportType(
  condition: string,
  previousConditions: string[] = [],
  filename = "",
): "cjs" | "esm" {
  if (filename) {
    if (filename.endsWith(".d.ts")) {
      return "esm";
    }
    if (filename.endsWith(".mjs")) {
      return "esm";
    }
    if (filename.endsWith(".cjs")) {
      return "cjs";
    }
  }
  switch (condition) {
    case "import": {
      return "esm";
    }
    case "require": {
      return "cjs";
    }
    default: {
      if (previousConditions.length === 0) {
        return "esm";
      }
      const [newCondition] = previousConditions;
      return inferExportType(
        newCondition || "import",
        previousConditions.slice(1),
        filename,
      );
    }
  }
}

function pathToRegex(path: string): RegExp | string {
  return path.includes("*")
    ? new RegExp(
        `^${path.replace(/\./g, String.raw`\.`).replace(/\*/g, ".*")}$`,
      )
    : path;
}
