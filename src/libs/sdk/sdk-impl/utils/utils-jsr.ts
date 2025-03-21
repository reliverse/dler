import fs from "fs-extra";
import pMap from "p-map";
import path from "pathe";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

import { cliDomainDocs, CONCURRENCY_DEFAULT } from "./utils-consts.js";
import { relinka } from "./utils-logs.js";

/**
 * Generates a jsr.jsonc configuration file for JSR distributions.
 */
export async function createJsrJSONC(
  outDirRoot: string,
  isLib: boolean,
  projectName?: string,
): Promise<void> {
  relinka(
    "verbose",
    `Creating jsr.jsonc configuration (project: ${projectName}, isLib: ${isLib})`,
  );
  const originalPkg = await readPackageJSON();
  let { description, name } = originalPkg;
  const { author, license, version } = originalPkg;
  if (isLib) {
    name = projectName;
    description = "A helper lib for the Reliverse CLI";
  }
  const pkgHomepage = cliDomainDocs;
  const jsrConfig = {
    author,
    description,
    exports: "./bin/main.ts",
    homepage: pkgHomepage,
    license: license || "MIT",
    name,
    publish: {
      exclude: ["!.", "node_modules/**", ".env"],
    },
    version,
  };
  await fs.writeJSON(path.join(outDirRoot, "jsr.jsonc"), jsrConfig, {
    spaces: 2,
  });
  relinka("verbose", "Generated jsr.jsonc file");
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
