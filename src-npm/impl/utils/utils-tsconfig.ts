import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineTSConfig, writeTSConfig } from "pkg-types";

import { tsconfigJson } from "~/impl/config/constants";

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

/**
 * Creates a minimal tsconfig file for a new project. If `isDev` is true and
 * the project path contains "tests-runtime", the file is saved as "tsconfig.txt"
 * instead of "tsconfig.json".
 */
export async function createProjectTSConfig(
  projectPath: string,
  isLib: boolean,
  isDev: boolean,
): Promise<void> {
  const tsconfig = defineTSConfig({
    compilerOptions: {
      esModuleInterop: true,
      skipLibCheck: true,
      target: "es2022",
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: "force",
      isolatedModules: true,
      verbatimModuleSyntax: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      ...(isLib
        ? { lib: ["es2022"] }
        : {
            module: "preserve",
            noEmit: true,
            lib: ["es2022", "dom", "dom.iterable"],
          }),
    },
    ...(isLib ? { include: ["**/*.ts"] } : { include: ["**/*.ts", "**/*.tsx"] }),
    exclude: ["node_modules"],
  });

  // Determine file extension based on dev mode and tests-runtime path
  const useTxt = isDev && projectPath.includes("tests-runtime");
  const filename = useTxt ? "tsconfig.txt" : "tsconfig.json";

  const tsconfigPath = path.join(projectPath, filename);

  // If we're saving as tsconfig.txt, we can't use writeTSConfig from pkg-types directly
  // because it expects a .json path. We'll just write a JSON string ourselves.
  if (useTxt) {
    const rawContent = JSON.stringify(tsconfig, null, 2);
    await fs.writeFile(tsconfigPath, rawContent, "utf-8");
  } else {
    await writeTSConfig(tsconfigPath, tsconfig);
    const content = await fs.readFile(tsconfigPath, "utf-8");
    const formatted = JSON.stringify(JSON.parse(content), null, 2);
    await fs.writeFile(tsconfigPath, formatted, "utf-8");
  }

  relinka("verbose", `Created ${filename} with ${isLib ? "library" : "application"} configuration`);
}
