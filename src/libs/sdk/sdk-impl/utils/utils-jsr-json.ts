import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import pMap from "p-map";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import { cliDomainDocs, CONCURRENCY_DEFAULT } from "./utils-consts";

/**
 * Generates a jsr.json configuration file for JSR distributions.
 */
export async function createJsrJSON(
  outDirRoot: string,
  isLib: boolean,
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
  }
  const pkgHomepage = cliDomainDocs;
  const jsrConfig = {
    author,
    description,
    exports: "./bin/mod.ts",
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    publish: {
      exclude: ["!.", "node_modules/**", ".env"],
    },
    version,
  };
  await fs.writeJSON(path.join(outDirRoot, "jsr.json"), jsrConfig, {
    spaces: 2,
  });
  relinka("verbose", `Generated jsr.json file in ${outDirRoot}/jsr.json`);
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
