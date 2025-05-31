import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import type { DlerConfig, LibConfig } from "~/libs/sdk/sdk-types";

import { cliDomainDocs, CONCURRENCY_DEFAULT } from "./utils-consts";

/**
 * Generates a jsr.json configuration file for JSR distributions.
 */
export async function createJsrJSON(
  outDirRoot: string,
  isLib: boolean,
  libsList: Record<string, LibConfig>,
  config: DlerConfig,
  libName = "unknown-lib-name",
  pkgDescription = "unknown-lib-description",
): Promise<void> {
  relinka("verbose", `Creating jsr.json configuration (isLib: ${isLib})`);
  const originalPkg = await readPackageJSON();
  let { description, name } = originalPkg;
  const { author, license, version } = originalPkg;
  if (isLib) {
    name = libName;
    description = pkgDescription;

    // Check if libMainFile is defined
    if (!libsList[libName]?.libMainFile) {
      throw new Error(
        `libsList.${libName}.libMainFile is not defined for library ${libName}`,
      );
    }
  }
  const pkgHomepage = cliDomainDocs;
  const jsrConfig = {
    author,
    description,
    exports:
      isLib && libsList[libName]?.libMainFile
        ? `./bin/${path.basename(libsList[libName].libMainFile)}`
        : `./bin/${config.coreEntryFile}`,
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    publish: {
      exclude: ["!.", "node_modules/**", ".env"],
    },
    version,
  };

  // Get the JSR artifacts for this library
  const jsrArtifacts = isLib
    ? config.publishArtifacts?.["dist-libs"]?.[libName]?.jsr
    : config.publishArtifacts?.["dist-jsr"] || ["jsr.json"];

  // Determine the JSR config file extension
  const jsrConfigExt =
    jsrArtifacts
      ?.find((artifact) => artifact.startsWith("jsr.json"))
      ?.split(".")
      .pop() || "json";
  const jsrConfigPath = path.join(outDirRoot, `jsr.${jsrConfigExt}`);

  await fs.writeJSON(jsrConfigPath, jsrConfig, {
    spaces: 2,
  });
  relinka(
    "verbose",
    `Generated jsr.${jsrConfigExt} file in ${outDirRoot}/jsr.${jsrConfigExt}`,
  );
}

/**
 * Renames .tsx files by replacing the .tsx extension with -tsx.txt.
 */
export async function renameTsxFiles(dir: string): Promise<void> {
  relinka("verbose", `Renaming .tsx files in directory: ${dir}`);
  const files = await glob(["**/*.tsx"], {
    absolute: true,
    cwd: dir,
  });
  await pMap(
    files,
    async (filePath) => {
      const newPath = filePath.replace(/\.tsx$/, "-tsx.txt");
      await fs.rename(filePath, newPath);
      relinka("verbose", `Renamed: ${filePath} -> ${newPath}`);
    },
    { concurrency: CONCURRENCY_DEFAULT },
  );
  relinka("verbose", `Completed renaming .tsx files in ${dir}`);
}
