import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { definePackageJSON, type PackageJson, readPackageJSON } from "pkg-types";

import type { DlerConfig, NpmOutExt } from "~/libs/sdk/sdk-impl/config/types";

import { cliDomainDocs } from "~/libs/sdk/sdk-impl/utils/utils-consts";

import { filterDeps } from "./utils-deps";

/**
 * Creates a package.json for the main distribution.
 */
export async function regular_createPackageJSON(
  outDirRoot: string,
  isJsr: boolean,
  coreIsCLI: { enabled: boolean; scripts: Record<string, string> },
  unifiedBundlerOutExt: NpmOutExt,
  config: DlerConfig,
  coreDescription: string,
  coreBuildOutDir = "bin",
): Promise<void> {
  relinka("verbose", `Generating distribution package.json and tsconfig.json (isJsr=${isJsr})...`);
  const commonPkg = await regular_createCommonPackageFields(coreIsCLI, coreDescription);
  const originalPkg = await readPackageJSON();
  const packageName = originalPkg.name || "";

  relinka(
    "verbose",
    `Package name: "${packageName}", CLI enabled: ${coreIsCLI.enabled}, scripts: ${JSON.stringify(coreIsCLI.scripts)}`,
  );

  const outDirBin = path.join(outDirRoot, coreBuildOutDir);
  const outExt = unifiedBundlerOutExt || "js";

  if (isJsr) {
    // For JSR, we need to handle bin entries with .ts extension
    const binEntry = coreIsCLI.enabled
      ? Object.fromEntries(
          Object.entries(coreIsCLI.scripts).map(([name, script]) => [
            name,
            `${coreBuildOutDir}/${path.basename(script)}`,
          ]),
        )
      : undefined;

    if (coreIsCLI.enabled) {
      relinka("verbose", `Adding CLI bin entries for JSR: ${JSON.stringify(binEntry)}`);
    }

    const jsrPkg = definePackageJSON({
      ...commonPkg,
      bin: binEntry,
      dependencies: await regular_getPkgKeepDeps(originalPkg.dependencies, outDirBin, true, config),
      devDependencies: await filterDeps(originalPkg.devDependencies, true, outDirBin, true, config),
      exports: {
        ".": `./${coreBuildOutDir}/${config.coreEntryFile}`,
      },
      files: [
        ...new Set([
          coreBuildOutDir,
          ...(config.publishArtifacts?.global || ["package.json", "README.md", "LICENSE"]),
        ]),
      ],
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), jsrPkg, {
      spaces: 2,
    });

    if (coreIsCLI.enabled) {
      relinka(
        "verbose",
        `JSR package.json created with CLI bin entries: ${JSON.stringify(jsrPkg.bin)}`,
      );
    }
  } else {
    const binEntry = coreIsCLI.enabled
      ? Object.fromEntries(
          Object.entries(coreIsCLI.scripts).map(([name, script]) => [
            name,
            `${coreBuildOutDir}/${path.basename(script).replace(/\.ts$/, `.${outExt}`)}`,
          ]),
        )
      : undefined;

    if (coreIsCLI.enabled) {
      relinka("verbose", `Adding CLI bin entries for NPM: ${JSON.stringify(binEntry)}`);
    }

    const npmPkg = definePackageJSON({
      ...commonPkg,
      bin: binEntry,
      dependencies: await regular_getPkgKeepDeps(
        originalPkg.dependencies,
        outDirBin,
        false,
        config,
      ),
      devDependencies: await filterDeps(
        originalPkg.devDependencies,
        true,
        outDirBin,
        false,
        config,
      ),
      exports: {
        ".": `./${coreBuildOutDir}/${config.coreEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      },
      files: [
        ...new Set([
          coreBuildOutDir,
          ...(config.publishArtifacts?.global || ["package.json", "README.md", "LICENSE"]),
        ]),
      ],
      main: `./${coreBuildOutDir}/${config.coreEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      module: `./${coreBuildOutDir}/${config.coreEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      publishConfig: { access: "public" },
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), npmPkg, {
      spaces: 2,
    });

    if (coreIsCLI.enabled) {
      relinka(
        "verbose",
        `NPM package.json created with CLI bin entries: ${JSON.stringify(npmPkg.bin)}`,
      );
    }
  }
  relinka("verbose", `Created package.json in ${outDirRoot}`);
}

/**
 * Creates common package.json fields based on the original package.json.
 */
async function regular_createCommonPackageFields(
  coreIsCLI: { enabled: boolean; scripts: Record<string, string> },
  coreDescription: string,
): Promise<Partial<PackageJson>> {
  relinka("verbose", "Generating common package fields");
  const originalPkg = await readPackageJSON();
  const { author, description, keywords, license, name, version } = originalPkg;

  relinka("verbose", `Original package name: "${name}", version: "${version}"`);

  const pkgHomepage = cliDomainDocs;
  const commonPkg: Partial<PackageJson> = {
    dependencies: originalPkg.dependencies || {},
    description: coreDescription || description,
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    type: "module",
    version,
  };

  if (coreIsCLI.enabled) {
    relinka("verbose", "coreIsCLI is enabled, adding CLI-specific fields to common package fields");
    if (commonPkg.keywords) {
      const cliKeywords = Object.keys(coreIsCLI.scripts);
      relinka(
        "verbose",
        `Adding CLI keywords to existing keywords: ${JSON.stringify(cliKeywords)}`,
      );
      commonPkg.keywords = [
        ...new Set(["cli", ...cliKeywords, "command-line", ...commonPkg.keywords]),
      ];
      relinka("verbose", `Updated keywords: ${JSON.stringify(commonPkg.keywords)}`);
    } else if (name) {
      const cliKeywords = Object.keys(coreIsCLI.scripts);
      relinka("verbose", `Setting new CLI keywords: ${JSON.stringify(cliKeywords)}`);
      commonPkg.keywords = ["cli", "command-line", ...cliKeywords];
      relinka("verbose", `Set keywords: ${JSON.stringify(commonPkg.keywords)}`);
    }
  } else {
    relinka("verbose", "coreIsCLI is false, skipping CLI-specific fields");
  }

  if (author) {
    const repoOwner = typeof author === "string" ? author : author.name;
    const repoName = name ? (name.startsWith("@") ? name.split("/").pop() || name : name) : "";
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
  config: DlerConfig,
): Promise<Record<string, string>> {
  if (!originalDeps) {
    return {};
  }

  return filterDeps(originalDeps, false, outDirBin, isJsr, config);
}
