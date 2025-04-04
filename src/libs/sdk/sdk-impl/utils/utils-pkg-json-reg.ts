import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import path from "pathe";
import {
  definePackageJSON,
  type PackageJson,
  readPackageJSON,
} from "pkg-types";

import type { ExcludeMode, NpmOutExt } from "~/libs/sdk/sdk-types.js";

import { cliDomainDocs } from "~/libs/sdk/sdk-impl/utils/utils-consts.js";

/**
 * Creates a package.json for the main distribution.
 */
export async function regular_createPackageJSON(
  outDirRoot: string,
  isJsr: boolean,
  coreIsCLI: boolean,
  unifiedBundlerOutExt: NpmOutExt,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
): Promise<void> {
  relinka(
    "info",
    `Generating distribution package.json and tsconfig.json (isJsr=${isJsr})...`,
  );
  const commonPkg = await regular_createCommonPackageFields(coreIsCLI);
  const originalPkg = await readPackageJSON();
  const packageName = originalPkg.name || "";
  const cliCommandName = packageName.startsWith("@")
    ? packageName.split("/").pop() || "cli"
    : packageName;

  relinka(
    "verbose",
    `Package name: "${packageName}", CLI command name: "${cliCommandName}", coreIsCLI: ${coreIsCLI}`,
  );

  const outDirBin = path.join(outDirRoot, "bin");
  const outExt = unifiedBundlerOutExt || "js";

  if (isJsr) {
    // For JSR, we need to handle bin entries with .ts extension
    const binEntry = coreIsCLI
      ? { [cliCommandName]: "bin/main.ts" }
      : undefined;
    if (coreIsCLI) {
      relinka(
        "verbose",
        `Adding CLI bin entry for JSR: { "${cliCommandName}": "bin/main.ts" }`,
      );
    }

    const jsrPkg = definePackageJSON({
      ...commonPkg,
      bin: binEntry,
      dependencies: await regular_getPkgKeepDeps(
        originalPkg.dependencies,
        outDirBin,
        isJsr,
        rmDepsMode,
        rmDepsPatterns,
      ),
      devDependencies: await regular_getPkgKeepDeps(
        originalPkg.devDependencies,
        outDirBin,
        isJsr,
        rmDepsMode,
        rmDepsPatterns,
      ),
      exports: {
        ".": "./bin/main.ts",
      },
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), jsrPkg, {
      spaces: 2,
    });

    if (coreIsCLI) {
      relinka(
        "verbose",
        `JSR package.json created with CLI bin entry: ${JSON.stringify(jsrPkg.bin)}`,
      );
    }
  } else {
    const binEntry = coreIsCLI
      ? { [cliCommandName]: `bin/main.${outExt}` }
      : undefined;

    if (coreIsCLI) {
      relinka(
        "verbose",
        `Adding CLI bin entry for NPM: { "${cliCommandName}": "bin/main.${outExt}" }`,
      );
    }

    const npmPkg = definePackageJSON({
      ...commonPkg,
      bin: binEntry,
      dependencies: await regular_getPkgKeepDeps(
        originalPkg.dependencies,
        outDirBin,
        isJsr,
        rmDepsMode,
        rmDepsPatterns,
      ),
      devDependencies: await regular_getPkgKeepDeps(
        originalPkg.devDependencies,
        outDirBin,
        isJsr,
        rmDepsMode,
        rmDepsPatterns,
      ),
      exports: {
        ".": `./bin/main.${outExt}`,
      },
      files: ["bin", "package.json", "README.md", "LICENSE"],
      main: `./bin/main.${outExt}`,
      module: `./bin/main.${outExt}`,
      publishConfig: { access: "public" },
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), npmPkg, {
      spaces: 2,
    });

    if (coreIsCLI) {
      relinka(
        "verbose",
        `NPM package.json created with CLI bin entry: ${JSON.stringify(npmPkg.bin)}`,
      );
    }
  }
  relinka("verbose", `Created package.json in ${outDirRoot}`);
}

/**
 * Creates common package.json fields based on the original package.json.
 */
async function regular_createCommonPackageFields(
  coreIsCLI: boolean,
): Promise<Partial<PackageJson>> {
  relinka("verbose", "Generating common package fields");
  const originalPkg = await readPackageJSON();
  const { author, description, keywords, license, name, version } = originalPkg;

  relinka("verbose", `Original package name: "${name}", version: "${version}"`);

  const pkgHomepage = cliDomainDocs;
  const commonPkg: Partial<PackageJson> = {
    dependencies: originalPkg.dependencies || {},
    description,
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    type: "module",
    version,
  };

  if (coreIsCLI) {
    relinka(
      "verbose",
      "coreIsCLI is true, adding CLI-specific fields to common package fields",
    );
    if (commonPkg.keywords) {
      const cliCommandName = name?.startsWith("@")
        ? name.split("/").pop() || "cli"
        : name || "relidler";
      relinka(
        "verbose",
        `Adding CLI keywords to existing keywords, CLI command name: "${cliCommandName}"`,
      );
      commonPkg.keywords = [
        ...new Set([
          "cli",
          cliCommandName,
          "command-line",
          ...commonPkg.keywords,
        ]),
      ];
      relinka(
        "verbose",
        `Updated keywords: ${JSON.stringify(commonPkg.keywords)}`,
      );
    } else if (name) {
      const cliCommandName = name.startsWith("@")
        ? name.split("/").pop() || "cli"
        : name;
      relinka(
        "verbose",
        `Setting new CLI keywords, CLI command name: "${cliCommandName}"`,
      );
      commonPkg.keywords = ["cli", "command-line", cliCommandName];
      relinka("verbose", `Set keywords: ${JSON.stringify(commonPkg.keywords)}`);
    }
  } else {
    relinka("verbose", "coreIsCLI is false, skipping CLI-specific fields");
  }

  if (author) {
    const repoOwner = typeof author === "string" ? author : author.name;
    const repoName = name
      ? name.startsWith("@")
        ? name.split("/").pop() || name
        : name
      : "";
    Object.assign(commonPkg, {
      author,
      bugs: {
        email: "blefnk@gmail.com",
        url: `https://github.com/${repoOwner}/${repoName}/issues`,
      },
      keywords: [...new Set([repoOwner, ...(commonPkg.keywords || [])])],
      repository: {
        type: "git",
        url: `git+https://github.com/${repoOwner}/${repoName}.git`,
      },
    });
  } else if (keywords && keywords.length > 0 && !commonPkg.keywords) {
    commonPkg.keywords = keywords;
  }

  relinka("verbose", "Common package fields generated");
  return commonPkg;
}

/**
 * Gets dependencies for the main package based on the exclude mode and patterns.
 *
 * @returns A filtered record of dependencies
 */
async function regular_getPkgKeepDeps(
  originalDeps: Record<string, string> | undefined,
  outDirBin: string,
  isJsr: boolean,
  rmDepsMode: ExcludeMode,
  rmDepsPatterns: string[],
): Promise<Record<string, string>> {
  relinka("verbose", "Getting main package dependencies");
  if (!originalDeps) return {};

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

  relinka(
    "verbose",
    `Main package dependencies filtered, count: ${Object.keys(result).length}`,
  );
  return result;
}
