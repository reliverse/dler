import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  definePackageJSON,
  type PackageJson,
  readPackageJSON,
} from "pkg-types";

import type { NpmOutExt, DlerConfig, LibConfig } from "~/libs/sdk/sdk-types";

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
  config: DlerConfig,
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
  config: DlerConfig,
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

    // Get the appropriate patterns based on the build type and library
    const patterns = new Set<string>();
    const addPatterns = new Set<string>(); // Track patterns that should be added
    const negPatterns = new Set<string>(); // Track negation patterns

    // Always include global patterns
    for (const pattern of config.filterDepsPatterns.global) {
      if (pattern.startsWith("+")) {
        addPatterns.add(pattern.slice(1));
      } else if (pattern.startsWith("!")) {
        negPatterns.add(pattern.slice(1));
      } else {
        patterns.add(pattern);
      }
    }

    // Add NPM-specific patterns if not JSR
    if (!isJsr) {
      for (const pattern of config.filterDepsPatterns["dist-npm"]) {
        if (pattern.startsWith("+")) {
          addPatterns.add(pattern.slice(1));
        } else if (pattern.startsWith("!")) {
          negPatterns.add(pattern.slice(1));
        } else {
          patterns.add(pattern);
        }
      }
    }

    // Add JSR-specific patterns if JSR
    if (isJsr) {
      for (const pattern of config.filterDepsPatterns["dist-jsr"]) {
        if (pattern.startsWith("+")) {
          addPatterns.add(pattern.slice(1));
        } else if (pattern.startsWith("!")) {
          negPatterns.add(pattern.slice(1));
        } else {
          patterns.add(pattern);
        }
      }
    }

    // Add library-specific patterns if a library is specified
    if (libName && config.filterDepsPatterns["dist-libs"][libName]) {
      const libPatterns = config.filterDepsPatterns["dist-libs"][libName];
      // Add NPM-specific patterns if not JSR
      if (!isJsr) {
        for (const pattern of libPatterns.npm) {
          if (pattern.startsWith("+")) {
            addPatterns.add(pattern.slice(1));
          } else if (pattern.startsWith("!")) {
            negPatterns.add(pattern.slice(1));
          } else {
            patterns.add(pattern);
          }
        }
      }
      // Add JSR-specific patterns if JSR
      if (isJsr) {
        for (const pattern of libPatterns.jsr) {
          if (pattern.startsWith("+")) {
            addPatterns.add(pattern.slice(1));
          } else if (pattern.startsWith("!")) {
            negPatterns.add(pattern.slice(1));
          } else {
            patterns.add(pattern);
          }
        }
      }
    }

    const result = Object.entries(originalDeps).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        const depNameLower = k.toLowerCase();

        // First check if the dependency matches any negation pattern
        const isNegated = Array.from(negPatterns).some((pattern) =>
          depNameLower.includes(pattern.toLowerCase()),
        );

        // If negated, don't exclude
        if (isNegated) {
          acc[k] = v;
          return acc;
        }

        // Then check if it should be excluded by regular patterns
        const shouldExclude =
          devDeps ||
          Array.from(patterns).some((pattern) =>
            depNameLower.includes(pattern.toLowerCase()),
          );

        if (!shouldExclude) {
          acc[k] = v;
        }
        return acc;
      },
      {},
    );

    // Add dependencies from addPatterns if they don't exist
    for (const pattern of addPatterns) {
      if (!result[pattern] && !originalPkg.dependencies?.[pattern]) {
        // Use the version from the original package.json if it exists in devDependencies
        // Otherwise use the latest version
        result[pattern] = originalPkg.devDependencies?.[pattern] || "latest";
      }
    }

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
  config: DlerConfig,
): Promise<void> {
  relinka("verbose", `Writing package.json for JSR lib: ${libName}`);

  // Throw error if libsList is empty or not provided
  if (!libsList) {
    throw new Error("libsList is empty or not provided");
  }

  // Check if libMainFile is defined
  if (!libsList[libName]?.libMainFile) {
    throw new Error(
      `libsList.${libName}.libMainFile is not defined for library ${libName}`,
    );
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
        libMainFile: libsList[libName].libMainFile,
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
      ".": `./bin/${path.basename(libsList[libName].libMainFile)}`,
    },
    files: config.publishArtifacts?.global || [
      "bin",
      "package.json",
      "README.md",
      "LICENSE",
    ],
    main: `./bin/${path.basename(libsList[libName].libMainFile)}`,
    module: `./bin/${path.basename(libsList[libName].libMainFile)}`,
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
  config: DlerConfig,
  unifiedBundlerOutExt: NpmOutExt,
): Promise<void> {
  relinka("verbose", `Writing package.json for NPM lib: ${libName}`);

  // Throw error if libsList is empty or not provided
  if (!libsList) {
    throw new Error("libsList is empty or not provided");
  }

  // Check if libMainFile is defined
  if (!libsList[libName]?.libMainFile) {
    throw new Error(
      `libsList.${libName}.libMainFile is not defined for library ${libName}`,
    );
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
        libMainFile: libsList[libName].libMainFile,
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
      ".": `./bin/${path.basename(libsList[libName].libMainFile).replace(/\.ts$/, `.${unifiedBundlerOutExt}`)}`,
    },
    files: config.publishArtifacts?.global || [
      "bin",
      "package.json",
      "README.md",
      "LICENSE",
    ],
    main: `./bin/${path.basename(libsList[libName].libMainFile).replace(/\.ts$/, `.${unifiedBundlerOutExt}`)}`,
    module: `./bin/${path.basename(libsList[libName].libMainFile).replace(/\.ts$/, `.${unifiedBundlerOutExt}`)}`,
    publishConfig: { access: "public" },
  });

  const pkgPath = path.join(pkgJsonDir, "package.json");
  await fs.ensureDir(path.dirname(pkgPath));
  await fs.writeJson(pkgPath, npmPkg, { spaces: 2 });
  relinka("verbose", `Completed writing package.json for NPM lib: ${libName}`);
}

/**
 * Creates a JSR configuration file for a library.
 */
async function library_createJsrConfig(
  libName: string,
  pkgJsonDir: string,
  libsList: Record<string, LibConfig>,
  config: DlerConfig,
): Promise<void> {
  relinka("verbose", `Creating JSR config for lib: ${libName}`);

  // Get the JSR artifacts for this library
  const jsrArtifacts = config.publishArtifacts?.["dist-libs"]?.[libName]?.jsr ||
    config.publishArtifacts?.["dist-jsr"] || ["jsr.json"];

  // Determine the JSR config file extension
  const jsrConfigExt =
    jsrArtifacts
      .find((artifact) => artifact.startsWith("jsr.json"))
      ?.split(".")
      .pop() || "json";
  const jsrConfigPath = path.join(pkgJsonDir, `jsr.${jsrConfigExt}`);

  const originalPkg = await readPackageJSON();
  const jsrConfig = {
    name: libName,
    version: libsList[libName]?.version || originalPkg.version || "0.0.0",
    exports: `./bin/${path.basename(libsList[libName]?.libMainFile || "")}`,
    files: config.publishArtifacts?.global || [
      "bin",
      "package.json",
      "README.md",
      "LICENSE",
    ],
  };

  await fs.ensureDir(path.dirname(jsrConfigPath));
  await fs.writeJson(jsrConfigPath, jsrConfig, { spaces: 2 });
  relinka("verbose", `Completed creating JSR config for lib: ${libName}`);
}

// Export the function so it can be used by other modules
export { library_createJsrConfig };
