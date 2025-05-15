import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import path from "pathe";
import {
  definePackageJSON,
  type PackageJson,
  readPackageJSON,
} from "pkg-types";

import type {
  ExcludeMode,
  LibConfig,
  NpmOutExt,
} from "~/libs/sdk/sdk-types.js";

import { filterDeps } from "~/libs/sdk/sdk-impl/utils/utils-deps.js";

/**
 * Creates a package.json for a lib distribution.
 */
export async function library_createPackageJSON(
  libName: string,
  outDirRoot: string,
  isJsr: boolean,
  libsList: Record<string, LibConfig>,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  unifiedBundlerOutExt: NpmOutExt,
): Promise<void> {
  relinka(
    "verbose",
    `Generating package.json for lib ${libName} (isJsr=${isJsr})...`,
  );

  // Throw error if libsList is empty or not provided
  if (!libsList) {
    throw new Error("libsList is empty or not provided");
  }

  const originalPkg = await readPackageJSON();
  let { description } = originalPkg;
  const { author, keywords, license, version } = originalPkg;

  // Set description based on config
  if (libsList?.[libName]?.libDescription) {
    description = libsList[libName].libDescription;
    relinka(
      "verbose",
      `Using ${libName}'s description from config: "${description}"`,
    );
  } else {
    description = description || `${libName} is a helper library.`;
    relinka(
      "verbose",
      `Using default helper library description: "${description}"`,
    );
  }

  const commonPkg: Partial<PackageJson> = {
    description,
    license: license || "MIT",
    name: libName,
    type: "module",
    version,
  };

  if (author) {
    const repoOwner = typeof author === "string" ? author : author.name;
    const repoName = originalPkg.name
      ? originalPkg.name.startsWith("@")
        ? originalPkg.name.split("/").pop() || originalPkg.name
        : originalPkg.name
      : "";
    Object.assign(commonPkg, {
      author,
      bugs: {
        email: "blefnk@gmail.com",
        url: `https://github.com/${repoOwner}/${repoName}/issues`,
      },
      keywords: [...new Set([author, ...(keywords || [])])],
      repository: {
        type: "git",
        url: `git+https://github.com/${repoOwner}/${repoName}.git`,
      },
    });
  } else if (keywords && keywords.length > 0 && !commonPkg.keywords) {
    commonPkg.keywords = keywords;
  }

  const outDirBin = path.join(outDirRoot, "bin");
  if (isJsr) {
    relinka("verbose", `Creating JSR package.json for lib ${libName}...`);
    await library_writeJsrPackageJSON(
      libName,
      outDirBin,
      outDirRoot,
      originalPkg,
      commonPkg,
      libsList,
      rmDepsMode,
      rmDepsPatterns,
    );
  } else {
    relinka("verbose", `Creating NPM package.json for lib ${libName}...`);
    await library_writeNpmLibPackageJSON(
      libName,
      outDirBin,
      outDirRoot,
      originalPkg,
      commonPkg,
      libsList,
      rmDepsMode,
      rmDepsPatterns,
      unifiedBundlerOutExt,
    );
  }
  relinka("verbose", `Completed creation of package.json for lib: ${libName}`);
}

/**
 * Gets dependencies for a lib based on the LibConfig dependencies field.
 *
 * @returns A filtered record of dependencies
 */
async function library_getlibPkgKeepDeps(
  libName: string,
  originalDeps: Record<string, string> | undefined,
  outDirBin: string,
  isJsr: boolean,
  libConfig: LibConfig,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
): Promise<Record<string, string>> {
  relinka("verbose", `Getting lib dependencies for: ${libName}`);
  if (!originalDeps) return {};

  // Check if the lib has a dependencies configuration
  if (!libConfig) {
    // Default behavior - filter based on usage
    const result = await filterDeps(
      originalDeps,
      true,
      outDirBin,
      isJsr,
      rmDepsMode,
      rmDepsPatterns,
    );
    relinka(
      "verbose",
      `Lib ${libName} dependencies filtered by usage, count: ${Object.keys(result).length}`,
    );
    return result;
  }

  // If dependencies is true, include all dependencies from the original package.json
  if (libConfig.libPkgKeepDeps === true) {
    relinka("log", `Preserving all dependencies for lib ${libName}`);

    // Read the original package.json to determine if we're dealing with devDependencies
    const originalPkg = await readPackageJSON();
    const devDeps = originalDeps === originalPkg.devDependencies;

    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        // Determine if the dependency should be excluded based on the rmDepsMode
        let shouldExclude = false;

        if (rmDepsMode === "patterns-only") {
          // Only exclude dependencies matching patterns
          shouldExclude = rmDepsPatterns.some((pattern) =>
            k.toLowerCase().includes(pattern.toLowerCase()),
          );
        } else if (rmDepsMode === "patterns-and-devdeps") {
          // Exclude both dev dependencies and dependencies matching patterns
          shouldExclude =
            devDeps ||
            rmDepsPatterns.some((pattern) =>
              k.toLowerCase().includes(pattern.toLowerCase()),
            );
        }

        if (!shouldExclude) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    return result;
  }

  // If dependencies is an array, only include those specific dependencies
  if (Array.isArray(libConfig.libPkgKeepDeps)) {
    relinka(
      "log",
      `Including specific dependencies for lib ${libName}: ${libConfig.libPkgKeepDeps.join(", ")}`,
    );
    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (
          Array.isArray(libConfig.libPkgKeepDeps) &&
          libConfig.libPkgKeepDeps.includes(k)
        ) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );
    return result;
  }

  // Default behavior - filter based on usage
  const result = await filterDeps(
    originalDeps,
    true,
    outDirBin,
    isJsr,
    rmDepsMode,
    rmDepsPatterns,
  );
  relinka(
    "verbose",
    `Default filtering for lib ${libName} done, count: ${Object.keys(result).length}`,
  );
  return result;
}

/**
 * Writes a package.json for a JSR lib distribution.
 */
async function library_writeJsrPackageJSON(
  libName: string,
  outDirBin: string,
  outDirRoot: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  libsList: Record<string, LibConfig>,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
): Promise<void> {
  relinka("verbose", `Writing package.json for JSR lib: ${libName}`);

  // Throw error if libsList is empty or not provided
  if (!libsList) {
    throw new Error("libsList is empty or not provided");
  }

  // For JSR packages, we need to handle bin entries differently
  // JSR uses TypeScript files directly
  const binEntry = commonPkg.bin;
  if (binEntry) {
    relinka(
      "verbose",
      `Found bin entry in commonPkg: ${JSON.stringify(binEntry)}`,
    );
    // Convert bin paths to .ts extension for JSR
    const updatedBin: Record<string, string> = {};
    for (const [key, value] of Object.entries(binEntry)) {
      updatedBin[key] = value.replace(/\.js$/, ".ts");
    }
    commonPkg.bin = updatedBin;
    relinka(
      "verbose",
      `Updated bin entry for JSR: ${JSON.stringify(updatedBin)}`,
    );
  }

  const jsrPkg = definePackageJSON({
    ...commonPkg,
    dependencies: await library_getlibPkgKeepDeps(
      libName,
      originalPkg.dependencies,
      outDirBin,
      true,
      libsList?.[libName] ?? {
        libDeclarations: false,
        libDescription: "",
        libDirName: libName,
        libMainFile: "src/libs/libName/libName-mod.ts",
        libPkgKeepDeps: false,
        libTranspileMinify: true,
      },
      rmDepsMode,
      rmDepsPatterns,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outDirBin,
      true,
      rmDepsMode,
      rmDepsPatterns,
    ),
    exports: {
      ".": "./bin/mod.ts",
    },
  });

  await fs.writeJSON(path.join(outDirRoot, "package.json"), jsrPkg, {
    spaces: 2,
  });
  relinka("verbose", `Completed writing package.json for JSR lib: ${libName}`);
}

/**
 * Writes a package.json for a NPM lib distribution.
 */
async function library_writeNpmLibPackageJSON(
  libName: string,
  outDirBin: string,
  outDirRoot: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  libsList: Record<string, LibConfig>,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
  unifiedBundlerOutExt: NpmOutExt,
): Promise<void> {
  relinka("verbose", `Writing package.json for NPM lib: ${libName}`);

  // Throw error if libsList is empty or not provided
  if (!libsList) {
    throw new Error("libsList is empty or not provided");
  }

  const npmPkg = definePackageJSON({
    ...commonPkg,
    dependencies: await library_getlibPkgKeepDeps(
      libName,
      originalPkg.dependencies,
      outDirBin,
      false,
      libsList?.[libName] ?? {
        libDeclarations: true,
        libDescription: "",
        libDirName: libName,
        libMainFile: "src/libs/libName/libName-mod.ts",
        libPkgKeepDeps: true,
        libTranspileMinify: true,
      },
      rmDepsMode,
      rmDepsPatterns,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outDirBin,
      false,
      rmDepsMode,
      rmDepsPatterns,
    ),
    exports: {
      ".": `./bin/mod.${unifiedBundlerOutExt}`,
    },
    files: ["bin", "package.json", "README.md", "LICENSE"],
    main: `./bin/mod.${unifiedBundlerOutExt}`,
    module: `./bin/mod.${unifiedBundlerOutExt}`,
    publishConfig: { access: "public" },
  });

  await fs.writeJSON(path.join(outDirRoot, "package.json"), npmPkg, {
    spaces: 2,
  });
  relinka("verbose", `Completed writing package.json for NPM lib: ${libName}`);
}
