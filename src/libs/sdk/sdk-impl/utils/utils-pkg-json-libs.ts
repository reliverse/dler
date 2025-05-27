import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  definePackageJSON,
  type PackageJson,
  readPackageJSON,
} from "pkg-types";

import type {
  NpmOutExt,
  BuildPublishConfig,
  LibConfig,
} from "~/libs/sdk/sdk-types";

import { filterDeps } from "./utils-deps";

/**
 * Creates a package.json for a lib distribution.
 */
export async function library_createPackageJSON(
  libName: string,
  npmOutDir: string,
  jsrOutDir: string,
  effectivePubRegistry: "npm" | "jsr" | "npm-jsr" | undefined,
  libsList: Record<string, LibConfig>,
  config: BuildPublishConfig,
  unifiedBundlerOutExt: NpmOutExt,
): Promise<void> {
  relinka("verbose", `Creating package.json for library ${libName}`);

  // Read the original package.json
  const originalPkg = await readPackageJSON();
  const commonPkg = await library_createCommonPackageFields(libName, libsList);

  // Create NPM package.json if needed
  if (effectivePubRegistry === "npm" || effectivePubRegistry === "npm-jsr") {
    await library_writeNpmLibPackageJSON(
      libName,
      npmOutDir,
      npmOutDir,
      originalPkg,
      commonPkg,
      libsList,
      config,
      unifiedBundlerOutExt,
    );
  }

  // Create JSR package.json if needed
  if (effectivePubRegistry === "jsr" || effectivePubRegistry === "npm-jsr") {
    await library_writeJsrPackageJSON(
      libName,
      jsrOutDir,
      jsrOutDir,
      originalPkg,
      commonPkg,
      libsList,
      config,
    );
  }
}

/**
 * Creates common package.json fields based on the library name and config.
 */
async function library_createCommonPackageFields(
  libName: string,
  libsList: Record<string, LibConfig>,
): Promise<Partial<PackageJson>> {
  relinka("verbose", `Generating common package fields for ${libName}`);
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

  return commonPkg;
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
  config: BuildPublishConfig,
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
      config,
      libName,
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
        // Get the appropriate patterns based on the build type and library
        const patterns = new Set<string>();

        // Always include global patterns
        for (const pattern of config.removeDepsPatterns.global) {
          patterns.add(pattern);
        }

        // Add NPM-specific patterns if not JSR
        if (!isJsr) {
          for (const pattern of config.removeDepsPatterns["dist-npm"]) {
            patterns.add(pattern);
          }
        }

        // Add JSR-specific patterns if JSR
        if (isJsr) {
          for (const pattern of config.removeDepsPatterns["dist-jsr"]) {
            patterns.add(pattern);
          }
        }

        // Add library-specific patterns if a library is specified
        if (libName && config.removeDepsPatterns["dist-libs"][libName]) {
          const libPatterns = config.removeDepsPatterns["dist-libs"][libName];
          // Add NPM-specific patterns if not JSR
          if (!isJsr) {
            for (const pattern of libPatterns.npm) {
              patterns.add(pattern);
            }
          }
          // Add JSR-specific patterns if JSR
          if (isJsr) {
            for (const pattern of libPatterns.jsr) {
              patterns.add(pattern);
            }
          }
        }

        // Check if the dependency should be excluded
        const shouldExclude =
          devDeps ||
          Array.from(patterns).some((pattern) =>
            k.toLowerCase().includes(pattern.toLowerCase()),
          );

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
    config,
    libName,
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
  pkgJsonDir: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  libsList: Record<string, LibConfig>,
  config: BuildPublishConfig,
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
      config,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outDirBin,
      true,
      config,
      libName,
    ),
    exports: {
      ".": "./bin/mod.ts",
    },
  });

  const pkgPath = path.join(pkgJsonDir, "package.json");
  await fs.ensureDir(path.dirname(pkgPath));
  await fs.writeJson(pkgPath, jsrPkg, { spaces: 2 });
  relinka("verbose", `Completed writing package.json for JSR lib: ${libName}`);
}

/**
 * Writes a package.json for a NPM lib distribution.
 */
async function library_writeNpmLibPackageJSON(
  libName: string,
  outDirBin: string,
  pkgJsonDir: string,
  originalPkg: PackageJson,
  commonPkg: Partial<PackageJson>,
  libsList: Record<string, LibConfig>,
  config: BuildPublishConfig,
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
      config,
    ),
    devDependencies: await filterDeps(
      originalPkg.devDependencies,
      true,
      outDirBin,
      false,
      config,
      libName,
    ),
    exports: {
      ".": `./bin/mod.${unifiedBundlerOutExt}`,
    },
    files: ["bin", "package.json", "README.md", "LICENSE"],
    main: `./bin/mod.${unifiedBundlerOutExt}`,
    module: `./bin/mod.${unifiedBundlerOutExt}`,
    publishConfig: { access: "public" },
  });

  const pkgPath = path.join(pkgJsonDir, "package.json");
  await fs.ensureDir(path.dirname(pkgPath));
  await fs.writeJson(pkgPath, npmPkg, { spaces: 2 });
  relinka("verbose", `Completed writing package.json for NPM lib: ${libName}`);
}
