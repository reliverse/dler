import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineTSConfig } from "pkg-types";

import { tsconfigJson } from "./utils-consts.js";

// ==============================
// tsconfig.json generation utils
// ==============================

/**
 * Creates a tsconfig.json file for the distribution.
 */
export async function createTSConfig(
  outDirRoot: string,
  allowImportingTsExtensions: boolean,
): Promise<void> {
  relinka(
    "verbose",
    `Creating tsconfig.json in ${outDirRoot} (allowImportingTsExtensions=${allowImportingTsExtensions})`,
  );
  const tsConfig = defineTSConfig({
    compilerOptions: {
      allowImportingTsExtensions,
      allowJs: true,
      esModuleInterop: true,
      exactOptionalPropertyTypes: false,
      isolatedModules: true,
      lib: ["ESNext"],
      module: "NodeNext",
      moduleDetection: "force",
      moduleResolution: "nodenext",
      noEmit: true,
      noFallthroughCasesInSwitch: false,
      noImplicitAny: false,
      noImplicitOverride: true,
      noImplicitReturns: false,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: false,
      transpileTarget: "ESNext",
      verbatimModuleSyntax: true,
    },
    exclude: ["**/node_modules"],
    include: ["./bin/**/*.ts"],
  });
  await fs.writeJSON(path.join(outDirRoot, tsconfigJson), tsConfig, {
    spaces: 2,
  });
  relinka("verbose", `Created tsconfig.json in ${outDirRoot}`);
}
