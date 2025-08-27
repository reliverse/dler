import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";
import { CONCURRENCY_DEFAULT, cliDomainDocs } from "~/impl/config/constants";
import type { LibConfig, ReliverseConfig } from "~/impl/schema/mod";

/**
 * Generates a jsr.json configuration file for JSR distributions.
 */
export async function createJsrJSON(
  outDirRoot: string,
  isLib: boolean,
  libsList: Record<string, LibConfig>,
  config: ReliverseConfig,
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
      throw new Error(`libsList.${libName}.libMainFile is not defined for library ${libName}`);
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
  relinka("verbose", `Generated jsr.${jsrConfigExt} file in ${outDirRoot}/jsr.${jsrConfigExt}`);
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

  // Track processed files to detect conflicts
  const processedPaths = new Set<string>();

  await pMap(
    files,
    async (filePath) => {
      const newPath = filePath.replace(/\.tsx$/, "-tsx.txt");

      // Check for path conflicts
      if (processedPaths.has(newPath)) {
        throw new Error(`Path conflict detected: ${newPath} would be created multiple times`);
      }

      // Check if target file already exists
      if (await fs.pathExists(newPath)) {
        throw new Error(`Target file already exists: ${newPath}`);
      }

      try {
        await fs.rename(filePath, newPath);
        processedPaths.add(newPath);
        relinka("verbose", `Renamed: ${filePath} -> ${newPath}`);

        // Verify the rename was successful
        if (await fs.pathExists(filePath)) {
          throw new Error(`Source file still exists after rename: ${filePath}`);
        }
        if (!(await fs.pathExists(newPath))) {
          throw new Error(`Target file not found after rename: ${newPath}`);
        }
      } catch (error) {
        throw new Error(`Failed to rename ${filePath} to ${newPath}: ${error}`);
      }
    },
    { concurrency: CONCURRENCY_DEFAULT },
  );
  relinka("verbose", `Completed renaming .tsx files in ${dir}`);
}
