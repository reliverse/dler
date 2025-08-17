import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import { DEFAULT_CONFIG_DLER } from "~/libs/sdk/sdk-impl/config/default";

// Supported configuration filename
const CONFIG_FILENAME = ".config/dler.ts";

export async function ensureDlerConfig(isDev: boolean) {
  // Check if the config file already exists
  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const configExists = await fs.pathExists(configPath);

  // If it exists, no need to do anything.
  if (configExists) return;

  // If it doesn't exist, create it.
  try {
    // Read package.json description using pkg-types
    let pkgDescription: string | undefined;
    try {
      const pkg = await readPackageJSON();
      if (pkg && typeof pkg.description === "string" && pkg.description.trim()) {
        pkgDescription = pkg.description.trim();
      }
    } catch {
      // ignore, fallback to default
    }
    // Generate and write the config file
    const configContent = generateConfig(isDev, pkgDescription);
    await fs.outputFile(configPath, configContent, { encoding: "utf8" });
    relinka("success", `Config was created at ${configPath}`);
    relinka("verbose", "Edit this file to customize build and publish settings");
    if (!isDev) {
      relinka("verbose", "Please note: commonPubPause is set to true by default");
      relinka("verbose", "When you're ready, run `dler pub` to build and publish");
    } else {
      relinka("verbose", "When you're ready, run `bun pub` to build and publish");
    }

    // Generate .config/mod.ts with .config/types/dler.schema.ts
    // TODO: finish implementation of this function
    /*
    Currently in non-dler projects output is:
    ```ts
    ensureConfigMod {
      tool: "dler",
      mode: "copy-internal",
      isDev: false,
    }
    ✖   Failed to copy internal schema: Internal schema file not found: bin/libs/cfg/cfg-dler.ts
    ✖   Error creating configuration file: Internal schema file not found: bin/libs/cfg/cfg-dler.ts
    ```
    */
    // await ensureConfigMod({ tool: "dler", mode: "copy-internal", isDev });

    process.exit(0);
  } catch (error: unknown) {
    relinka(
      "error",
      `Error creating configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

export async function prepareDlerEnvironment(isDev: boolean) {
  // 1. Ensure dler config exists
  await ensureDlerConfig(isDev);

  const cwd = process.cwd();

  // 2. Handle .gitignore if .git directory exists
  const gitDir = path.resolve(cwd, ".git");
  if (await fs.pathExists(gitDir)) {
    await ensureGitignoreEntries(cwd);
  }

  // 3. Handle tsconfig.json
  const tsconfigPath = path.resolve(cwd, "tsconfig.json");
  if (await fs.pathExists(tsconfigPath)) {
    await ensureTsconfigIncludes(tsconfigPath);
  }

  // 4. Handle package.json scripts
  // TODO: maybe this is not useful, because e.g. `"latest": "bun dler update"` triggers `"dler": "bun dler"`
  // TODO: instead of `@reliverse/dler` directly, so user may get infinite recursion
  // const packageJsonPath = path.resolve(cwd, "package.json");
  // if (await fs.pathExists(packageJsonPath)) {
  //   await ensurePackageJsonScript(cwd, packageJsonPath);
  // }
}

async function ensureGitignoreEntries(cwd: string) {
  const gitignorePath = path.resolve(cwd, ".gitignore");

  let gitignoreContent = "";
  if (await fs.pathExists(gitignorePath)) {
    gitignoreContent = await fs.readFile(gitignorePath, "utf8");
  }

  const requiredEntries = ["dist", "dist*", "logs"];
  const lines = gitignoreContent.split("\n");
  let modified = false;

  for (const entry of requiredEntries) {
    const hasEntry = lines.some((line) => {
      const trimmedLine = line.trim();
      return (
        trimmedLine === entry ||
        (entry === "dist*" && (trimmedLine === "dist*" || trimmedLine.startsWith("dist")))
      );
    });

    if (!hasEntry) {
      if (gitignoreContent && !gitignoreContent.endsWith("\n")) {
        gitignoreContent += "\n";
      }
      gitignoreContent += entry + "\n";
      modified = true;
    }
  }

  if (modified) {
    await fs.writeFile(gitignorePath, gitignoreContent, "utf8");
    relinka("success", `Updated .gitignore with required entries`);
  }
}

async function ensureTsconfigIncludes(tsconfigPath: string) {
  try {
    const tsconfigContent = await fs.readFile(tsconfigPath, "utf8");
    const tsconfig = JSON.parse(tsconfigContent) as {
      include?: string[];
      [key: string]: unknown;
    };

    if (!tsconfig.include) {
      tsconfig.include = [];
    }

    // const requiredInclude = ".config/**/*.ts";
    // const hasConfigInclude = tsconfig.include.includes(requiredInclude);

    // if (!hasConfigInclude) {
    //   tsconfig.include.push(requiredInclude);
    //   await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
    //   relinka("success", `Added ".config/**/*.ts" to tsconfig.json includes`);
    // }
  } catch (error) {
    relinka(
      "warn",
      `Could not update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/* async function ensurePackageJsonScript(cwd: string, packageJsonPath: string) {
  try {
    const pkg = await readPackageJSON(packageJsonPath);

    // Check if @reliverse/dler is in dependencies or devDependencies
    const hasDlerDep =
      (pkg.dependencies && "@reliverse/dler" in pkg.dependencies) ||
      (pkg.devDependencies && "@reliverse/dler" in pkg.devDependencies);

    if (!hasDlerDep) {
      return; // No dler dependency, skip script setup
    }

    // Check if scripts.dler already exists
    if (pkg.scripts && pkg.scripts.dler) {
      return; // Script already exists
    }

    // Detect package manager
    const packageManager = await detectPackageManager(cwd);
    const pmCommand = packageManager?.command || "bun";

    // Add the dler script
    const updatedPkg = {
      ...pkg,
      scripts: {
        ...pkg.scripts,
        dler: `${pmCommand} dler`,
      },
    };

    await writePackageJSON(packageJsonPath, updatedPkg);
    relinka("success", `Added "dler": "${pmCommand} dler" script to package.json`);
  } catch (error) {
    relinka(
      "warn",
      `Could not update package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} */

function getCoreIsCLI(isDev: boolean): string {
  return isDev
    ? `coreIsCLI: { enabled: true, scripts: { dler: "dler.ts" } },`
    : `// coreIsCLI: {
  // enabled: false,
  // scripts: { mycli: "mycli.ts" },
  // },`;
}

// Helper to choose a value based on the environment
function getValue<T>(isDev: boolean, devValue: T, prodValue: T): T {
  return isDev ? devValue : prodValue;
}

function getBumpFilter(isDev: boolean): string {
  return isDev
    ? `[
    "package.json",
    ".config/rse.ts",
    "src/libs/sdk/sdk-impl/config/info.ts",
  ]`
    : `["package.json", ".config/rse.ts"]`;
}

function getPublishArtifacts(isDev: boolean): string {
  return isDev
    ? `{
    global: ["package.json", "README.md", "LICENSE", "LICENSES"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: [],
        npm: [],
      },
    },
  }`
    : `{
    global: ["package.json", "README.md", "LICENSE"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {},
  }`;
}

function getFilterDepsPatterns(isDev: boolean): string {
  return isDev
    ? `{
    global: [
      "@types",
      "biome",
      "eslint",
      "knip",
      "prettier",
      "typescript",
      "@reliverse/rse",
      "@reliverse/dler",
      "!@reliverse/rse-sdk",
      "!@reliverse/dler-sdk",
    ],
    "dist-npm": [],
    "dist-jsr": ["+bun"],
    "dist-libs": {
      "@reliverse/dler-sdk": {
        jsr: ["+bun"],
        npm: [],
      },
    },
  }`
    : `{
    global: [
      "@types",
      "biome",
      "eslint",
      "knip",
      "prettier",
      "typescript",
      "@reliverse/rse",
      "@reliverse/dler",
      "!@reliverse/rse-sdk",
      "!@reliverse/dler-sdk",
    ],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {},
  }`;
}

// Generate the config file content
function generateConfig(isDev: boolean, pkgDescription?: string): string {
  const importdefineConfigStatement = isDev
    ? `import { defineConfig } from "~/libs/cfg/cfg-impl/cfg-consts";`
    : `import { defineConfig } from "@reliverse/cfg";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_DLER.commonVerbose);
  const coreIsCLI = getCoreIsCLI(isDev);
  const registryValue = getValue(isDev, "npm-jsr", DEFAULT_CONFIG_DLER.commonPubRegistry);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_DLER.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "dler (prev. relidler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_DLER.coreDescription,
  );
  const libsActModeValue = getValue(isDev, "main-and-libs", DEFAULT_CONFIG_DLER.libsActMode);
  const libsObject = isDev
    ? `{
  "@reliverse/dler-sdk": {
    libDeclarations: true,
    libDescription: "@reliverse/dler without cli",
    libDirName: "sdk",
    libMainFile: "sdk/sdk-mod.ts",
    libPkgKeepDeps: true,
    libTranspileMinify: true,
    libPubPause: false,
    libPubRegistry: "npm-jsr",
  },
  "@reliverse/cfg": {
    libDeclarations: true,
    libDescription: "config for @reliverse/dler",
    libDirName: "cfg",
    libMainFile: "cfg/cfg-mod.ts",
    libPkgKeepDeps: true,
    libTranspileMinify: true,
    libPubPause: false,
    libPubRegistry: "npm-jsr",
  },
}`
    : `{
  // "@acme/cli-libName": {
  //   libDeclarations: true,
  //   libDescription: "@acme/cli defineConfigAcme",
  //   libDirName: "libName",
  //   libMainFile: "libName/libName-mod.ts",
  //   libPkgKeepDeps: true,
  //   libTranspileMinify: true,
  //   libPubPause: false,
  //   libPubRegistry: "npm",
  // },
}`;

  // ===================================================
  // .config/dler.ts default config template
  // ===================================================
  const configTemplate = [
    importdefineConfigStatement,
    "",
    "/**",
    " * Reliverse Bundler Configuration",
    " * Hover over a field to see more details",
    " * @see https://github.com/reliverse/dler",
    " */",
    "export default defineConfig({",
    "  // Bump configuration",
    "  bumpDisable: " + DEFAULT_CONFIG_DLER.bumpDisable + ",",
    "  bumpFilter: " + getBumpFilter(isDev) + ",",
    '  bumpMode: "' + DEFAULT_CONFIG_DLER.bumpMode + '",',
    "",
    "  // Common configuration",
    "  commonPubPause: " + pausePublishValue + ",",
    '  commonPubRegistry: "' + registryValue + '",',
    "  commonVerbose: " + verboseValue + ",",
    "",
    "  // Core configuration",
    '  coreBuildOutDir: "' + DEFAULT_CONFIG_DLER.coreBuildOutDir + '",',
    "  coreDeclarations: " + DEFAULT_CONFIG_DLER.coreDeclarations + ",",
    "  coreDescription: " + JSON.stringify(coreDescriptionValue) + ",",
    '  coreEntryFile: "' + DEFAULT_CONFIG_DLER.coreEntryFile + '",',
    '  coreEntrySrcDir: "' + DEFAULT_CONFIG_DLER.coreEntrySrcDir + '",',
    "  " + coreIsCLI,
    "",
    "  // JSR-only config",
    "  distJsrAllowDirty: " + DEFAULT_CONFIG_DLER.distJsrAllowDirty + ",",
    '  distJsrBuilder: "' + DEFAULT_CONFIG_DLER.distJsrBuilder + '",',
    '  distJsrDirName: "' + DEFAULT_CONFIG_DLER.distJsrDirName + '",',
    "  distJsrDryRun: " + DEFAULT_CONFIG_DLER.distJsrDryRun + ",",
    "  distJsrFailOnWarn: " + DEFAULT_CONFIG_DLER.distJsrFailOnWarn + ",",
    "  distJsrGenTsconfig: " + DEFAULT_CONFIG_DLER.distJsrGenTsconfig + ",",
    '  distJsrOutFilesExt: "' + DEFAULT_CONFIG_DLER.distJsrOutFilesExt + '",',
    "  distJsrSlowTypes: " + DEFAULT_CONFIG_DLER.distJsrSlowTypes + ",",
    "",
    "  // NPM-only config",
    '  distNpmBuilder: "' + DEFAULT_CONFIG_DLER.distNpmBuilder + '",',
    '  distNpmDirName: "' + DEFAULT_CONFIG_DLER.distNpmDirName + '",',
    '  distNpmOutFilesExt: "' + DEFAULT_CONFIG_DLER.distNpmOutFilesExt + '",',
    "",
    "  // Libraries Dler Plugin",
    "  // Publish specific dirs as separate packages",
    "  // This feature is experimental at the moment",
    "  // Please commit your changes before using it",
    '  libsActMode: "' + libsActModeValue + '",',
    '  libsDirDist: "' + DEFAULT_CONFIG_DLER.libsDirDist + '",',
    '  libsDirSrc: "' + DEFAULT_CONFIG_DLER.libsDirSrc + '",',
    "  libsList: " + libsObject + ",",
    "",
    "  // @reliverse/relinka logger setup",
    '  logsFileName: "' + DEFAULT_CONFIG_DLER.logsFileName + '",',
    "  logsFreshFile: " + DEFAULT_CONFIG_DLER.logsFreshFile + ",",
    "",
    "  // Specifies what resources to send to npm and jsr registries.",
    '  // coreBuildOutDir (e.g. "bin") dir is automatically included.',
    "  // The following is also included if publishArtifacts is {}:",
    '  // - global: ["package.json", "README.md", "LICENSE"]',
    '  // - dist-jsr,dist-libs/jsr: ["jsr.json"]',
    "  publishArtifacts: " + getPublishArtifacts(isDev) + ",",
    "",
    "  // Files with these extensions will be built",
    "  // Any other files will be copied as-is to dist",
    '  buildPreExtensions: ["ts", "js"],',
    "  // If you need to exclude some ts/js files from being built,",
    "  // you can store them in the dirs with buildTemplatesDir name",
    '  buildTemplatesDir: "templates",',
    "",
    "  // Dependency filtering",
    "  // Global is always applied",
    "  filterDepsPatterns: " + getFilterDepsPatterns(isDev) + ",",
    "",
    "  // Code quality tools",
    "  // Available: tsc, eslint, biome, knip, dler-check",
    "  runBeforeBuild: [],",
    "  // Available: dler-check",
    "  runAfterBuild: [],",
    "",
    "  // Build hooks",
    "  hooksBeforeBuild: [",
    "    // async () => {",
    "    //   await someAsyncOperation();",
    "    // }",
    "  ],",
    "  hooksAfterBuild: [",
    "    // async () => {",
    "    //   await someAsyncOperation();",
    "    // }",
    "  ],",
    "",
    "  postBuildSettings: {",
    "    deleteDistTmpAfterBuild: true,",
    "  },",
    "",
    "  // Build setup",
    "  // transpileAlias: {},",
    "  // transpileClean: true,",
    "  // transpileEntries: [],",
    '  transpileEsbuild: "' + DEFAULT_CONFIG_DLER.transpileEsbuild + '",',
    "  // transpileExternals: [],",
    "  transpileFailOnWarn: " + DEFAULT_CONFIG_DLER.transpileFailOnWarn + ",",
    '  transpileFormat: "' + DEFAULT_CONFIG_DLER.transpileFormat + '",',
    "  transpileMinify: " + DEFAULT_CONFIG_DLER.transpileMinify + ",",
    "  // transpileParallel: false,",
    '  transpilePublicPath: "' + DEFAULT_CONFIG_DLER.transpilePublicPath + '",',
    "  // transpileReplace: {},",
    "  // transpileRollup: {",
    "  //   alias: {},",
    "  //   commonjs: {},",
    "  //   dts: {},",
    "  //   esbuild: {},",
    "  //   json: {},",
    "  //   replace: {},",
    "  //   resolve: {},",
    "  // },",
    "  // transpileShowOutLog: false,",
    '  transpileSourcemap: "' + DEFAULT_CONFIG_DLER.transpileSourcemap + '",',
    "  transpileSplitting: " + DEFAULT_CONFIG_DLER.transpileSplitting + ",",
    "  transpileStub: " + DEFAULT_CONFIG_DLER.transpileStub + ",",
    "  // transpileStubOptions: { jiti: {} },",
    '  transpileTarget: "' + DEFAULT_CONFIG_DLER.transpileTarget + '",',
    "  transpileWatch: " + DEFAULT_CONFIG_DLER.transpileWatch + ",",
    "  // transpileWatchOptions: undefined,",
    "});",
  ].join("\n");
  return configTemplate;
}
