import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { definePackageJSON, type PackageJson, readPackageJSON } from "pkg-types";
import { cliDomainDocs } from "~/impl/config/constants";
import type { NpmOutExt, ReliverseConfig } from "~/impl/schema/mod";

import { filterDeps } from "./utils-deps";

/**
 * Creates a package.json for the main distribution.
 */
export async function regular_createPackageJSON(
  outDirRoot: string,
  isJsr: boolean,
  commonIsCLI: { enabled: boolean; scripts: Record<string, string> },
  unifiedBundlerOutExt: NpmOutExt,
  config: ReliverseConfig,
  commonDescription: string,
  commonBuildOutDir = "bin",
): Promise<void> {
  relinka("verbose", `Generating distribution package.json and tsconfig.json (isJsr=${isJsr})...`);
  const commonPkg = await regular_createCommonPackageFields(commonIsCLI, commonDescription);
  const originalPkg = await readPackageJSON();
  const packageName = originalPkg.name || "";

  relinka(
    "verbose",
    `Package name: "${packageName}", CLI enabled: ${commonIsCLI.enabled}, scripts: ${JSON.stringify(commonIsCLI.scripts)}`,
  );

  // In workspaceDirectOutput + JSR, the bin folder is `${commonBuildOutDir}-jsr`.
  const outDirBin = path.join(
    outDirRoot,
    isJsr && config.isWorkspacePackage ? `${commonBuildOutDir}-jsr` : commonBuildOutDir,
  );
  const outExt = unifiedBundlerOutExt || "js";

  // If we're writing directly into a workspace package directory, avoid
  // overwriting an existing package.json. In that case, skip creating it.
  if (config.isWorkspacePackage) {
    const pkgPath = path.join(outDirRoot, "package.json");
    if (await fs.pathExists(pkgPath)) {
      relinka(
        "verbose",
        `workspaceDirectOutput is enabled and package.json exists at ${pkgPath}. Skipping generation.`,
      );
      return;
    }
  }

  if (isJsr) {
    const jsrDirName = config.isWorkspacePackage ? `${commonBuildOutDir}-jsr` : commonBuildOutDir;
    // For JSR, we need to handle bin entries with .ts extension
    const binEntry = commonIsCLI.enabled
      ? Object.fromEntries(
          Object.entries(commonIsCLI.scripts).map(([name, script]) => [
            name,
            `${jsrDirName}/${path.basename(script)}`,
          ]),
        )
      : undefined;

    if (commonIsCLI.enabled) {
      relinka("verbose", `Adding CLI bin entries for JSR: ${JSON.stringify(binEntry)}`);
    }

    const jsrPkg = definePackageJSON({
      ...commonPkg,
      bin: binEntry,
      dependencies: await regular_getPkgKeepDeps(originalPkg.dependencies, outDirBin, true, config),
      devDependencies: await filterDeps(originalPkg.devDependencies, true, outDirBin, true, config),
      exports: {
        ".": `./${jsrDirName}/${config.commonEntryFile}`,
      },
      files: [
        ...new Set([
          jsrDirName,
          ...(config.publishArtifacts?.global || ["package.json", "README.md", "LICENSE"]),
        ]),
      ],
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), jsrPkg, {
      spaces: 2,
    });

    if (commonIsCLI.enabled) {
      relinka(
        "verbose",
        `JSR package.json created with CLI bin entries: ${JSON.stringify(jsrPkg.bin)}`,
      );
    }
  } else {
    const binEntry = commonIsCLI.enabled
      ? Object.fromEntries(
          Object.entries(commonIsCLI.scripts).map(([name, script]) => [
            name,
            `${commonBuildOutDir}/${path.basename(script).replace(/\.ts$/, `.${outExt}`)}`,
          ]),
        )
      : undefined;

    if (commonIsCLI.enabled) {
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
        ".": `./${commonBuildOutDir}/${config.commonEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      },
      files: [
        ...new Set([
          commonBuildOutDir,
          ...(config.publishArtifacts?.global || ["package.json", "README.md", "LICENSE"]),
        ]),
      ],
      main: `./${commonBuildOutDir}/${config.commonEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      module: `./${commonBuildOutDir}/${config.commonEntryFile.replace(/\.ts$/, `.${outExt}`)}`,
      publishConfig: { access: "public" },
    });
    await fs.writeJSON(path.join(outDirRoot, "package.json"), npmPkg, {
      spaces: 2,
    });

    if (commonIsCLI.enabled) {
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
  commonIsCLI: { enabled: boolean; scripts: Record<string, string> },
  commonDescription: string,
): Promise<Partial<PackageJson>> {
  relinka("verbose", "Generating common package fields");
  const originalPkg = await readPackageJSON();
  const { author, description, keywords, license, name, version } = originalPkg;

  relinka("verbose", `Original package name: "${name}", version: "${version}"`);

  const pkgHomepage = cliDomainDocs;
  const commonPkg: Partial<PackageJson> = {
    dependencies: originalPkg.dependencies || {},
    description: commonDescription || description,
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    type: "module",
    version,
  };

  if (commonIsCLI.enabled) {
    relinka(
      "verbose",
      "commonIsCLI is enabled, adding CLI-specific fields to common package fields",
    );
    if (commonPkg.keywords) {
      const cliKeywords = Object.keys(commonIsCLI.scripts);
      relinka(
        "verbose",
        `Adding CLI keywords to existing keywords: ${JSON.stringify(cliKeywords)}`,
      );
      commonPkg.keywords = [
        ...new Set(["cli", ...cliKeywords, "command-line", ...commonPkg.keywords]),
      ];
      relinka("verbose", `Updated keywords: ${JSON.stringify(commonPkg.keywords)}`);
    } else if (name) {
      const cliKeywords = Object.keys(commonIsCLI.scripts);
      relinka("verbose", `Setting new CLI keywords: ${JSON.stringify(cliKeywords)}`);
      commonPkg.keywords = ["cli", "command-line", ...cliKeywords];
      relinka("verbose", `Set keywords: ${JSON.stringify(commonPkg.keywords)}`);
    }
  } else {
    relinka("verbose", "commonIsCLI is false, skipping CLI-specific fields");
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
  config: ReliverseConfig,
): Promise<Record<string, string>> {
  if (!originalDeps) {
    return {};
  }

  return filterDeps(originalDeps, false, outDirBin, isJsr, config);
}
