import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import { DEFAULT_CONFIG_DLER } from "~/app/config/default";
import { cliConfigJsonc, cliConfigTs, rseOrg, UNKNOWN_STRING } from "./constants";
import { ensureReltypesFile } from "./reltypes-utils";

// Supported configuration file types
export type ConfigKind = "ts" | "jsonc";

// Default configuration file type
const DEFAULT_CONFIG_KIND: ConfigKind = "ts";

export async function ensureReliverseConfig(
  isDev: boolean,
  configKind: ConfigKind = DEFAULT_CONFIG_KIND,
) {
  // Determine config filename based on configKind
  const configFilename = configKind === "ts" ? cliConfigTs : cliConfigJsonc;
  const configPath = path.resolve(process.cwd(), configFilename);
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
    const configContent = generateConfig(isDev, pkgDescription, configKind);
    await fs.outputFile(configPath, configContent, { encoding: "utf8" });
    relinka(
      "success",
      `${configKind === "ts" ? "TypeScript" : "JSONC"} config was created at ${configPath}`,
    );
    relinka("verbose", "Edit this file to customize build and publish settings");
    if (!isDev) {
      relinka("verbose", "Please note: commonPubPause is set to true by default");
      relinka("verbose", "When you're ready, run `rse pub` to build and publish");
    } else {
      relinka("verbose", "When you're ready, run `bun pub` to build and publish");
    }

    // Generate mod.ts with types/reliverse.schema.ts
    // TODO: finish implementation of this function
    /*
    Currently in non-reliverse projects output is:
    ```ts
    ensureConfigMod {
      tool: "reliverse",
      mode: "copy-internal",
      isDev: false,
    }
    ✖   Failed to copy internal schema: Internal schema file not found: bin/libs/cfg/cfg-reliverse.ts
    ✖   Error creating configuration file: Internal schema file not found: bin/libs/cfg/cfg-reliverse.ts
    ```
    */
    // await ensureConfigMod({ tool: "reliverse", mode: "copy-internal", isDev });
  } catch (error: unknown) {
    relinka(
      "error",
      `Error creating configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

export async function prepareReliverseEnvironment(
  isDev: boolean,
  configKind: ConfigKind = DEFAULT_CONFIG_KIND,
) {
  // 1. Ensure reliverse config exists
  await ensureReliverseConfig(isDev, configKind);

  const cwd = process.cwd();

  // 2. Handle .gitignore if .git directory exists
  const gitDir = path.resolve(cwd, ".git");
  if (await fs.pathExists(gitDir)) {
    await ensureGitignoreEntries(cwd);
  }

  // 3. Handle tsconfig.json
  // TODO: make sure we really need this
  // const tsconfigPath = path.resolve(cwd, "tsconfig.json");
  // if (await fs.pathExists(tsconfigPath)) {
  //   await ensureTsconfigIncludes(tsconfigPath);
  // }

  // 4. Generate reltypes.ts if it doesn't exist (only for TypeScript configs)
  if (configKind === "ts") {
    await ensureReltypesFile(cwd);
  }

  // 5. Handle package.json scripts
  // TODO: maybe this is not useful, because e.g. `"latest": "bun reliverse update"` triggers `"reliverse": "bun reliverse"`
  // TODO: instead of `@reliverse/reliverse` directly, so user may get infinite recursion
  // const packageJsonPath = path.resolve(cwd, "package.json");
  // if (await fs.pathExists(packageJsonPath)) {
  //   await ensurePackageJsonScript(cwd, packageJsonPath);
  // }
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

// async function ensureTsconfigIncludes(tsconfigPath: string) {
//   try {
//     const tsconfigContent = await fs.readFile(tsconfigPath, "utf8");
//     const tsconfig = JSON.parse(tsconfigContent) as {
//       include?: string[];
//       [key: string]: unknown;
//     };

//     if (!tsconfig.include) {
//       tsconfig.include = [];
//     }

//     const requiredInclude = "reliverse.ts";
//     const hasConfigInclude = tsconfig.include.includes(requiredInclude);

//     if (!hasConfigInclude) {
//       tsconfig.include.push(requiredInclude);
//       await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
//       relinka("success", `Added "reliverse.ts" to tsconfig.json includes`);
//     }
//   } catch (error) {
//     relinka(
//       "warn",
//       `Could not update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
//     );
//   }
// }

// Helper function to get libs object configuration
function getLibsObject(isDev: boolean) {
  return isDev
    ? {
        "@reliverse/reliverse-sdk": {
          libDeclarations: true,
          libDescription: "@reliverse/reliverse without cli",
          libDirName: "sdk",
          libMainFile: "sdk/sdk-mod.ts",
          libPkgKeepDeps: true,
          libTranspileMinify: true,
          libPubPause: false,
          libPubRegistry: "npm-jsr",
        },
        "~/app/types/mod": {
          libDeclarations: true,
          libDescription: "config for @reliverse/reliverse",
          libDirName: "cfg",
          libMainFile: "cfg/cfg-mod.ts",
          libPkgKeepDeps: true,
          libTranspileMinify: true,
          libPubPause: false,
          libPubRegistry: "npm-jsr",
        },
      }
    : {};
}

// Generate JSONC config file content
function generateJsoncConfig(isDev: boolean, pkgDescription?: string): string {
  const schemaUrl = `${rseOrg}/schema.json`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_DLER.commonVerbose);
  const registryValue = getValue(isDev, "npm-jsr", DEFAULT_CONFIG_DLER.commonPubRegistry);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_DLER.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "reliverse (prev. dler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_DLER.coreDescription,
  );
  const libsActModeValue = getValue(isDev, "main-and-libs", DEFAULT_CONFIG_DLER.libsActMode);

  return `// reliverse.jsonc - Reliverse Bundler Configuration
// Hover over a field to see more details
// @see https://github.com/reliverse/reliverse
// Schema: ${schemaUrl}
{
  "$schema": "${schemaUrl}",
  
  // Project configuration
  "projectName": ${UNKNOWN_STRING},
  "projectAuthor": ${UNKNOWN_STRING},
  "projectDescription": ${JSON.stringify(coreDescriptionValue)},
  "version": ${UNKNOWN_STRING},
  "projectLicense": ${UNKNOWN_STRING},
  "projectState": ${UNKNOWN_STRING},
  "projectRepository": ${UNKNOWN_STRING},
  "projectDomain": ${UNKNOWN_STRING},
  "projectCategory": ${UNKNOWN_STRING},
  "projectSubcategory": ${UNKNOWN_STRING},
  "projectTemplate": ${UNKNOWN_STRING},
  "projectTemplateDate": ${UNKNOWN_STRING},
  "projectArchitecture": ${UNKNOWN_STRING},
  "repoPrivacy": ${UNKNOWN_STRING},
  "projectGitService": ${UNKNOWN_STRING},
  "projectDeployService": ${UNKNOWN_STRING},
  "repoBranch": ${UNKNOWN_STRING},
  "projectFramework": ${UNKNOWN_STRING},
  "projectPackageManager": ${UNKNOWN_STRING},
  "projectRuntime": ${UNKNOWN_STRING},
  "preferredLibraries": {
    "stateManagement": ${UNKNOWN_STRING},
    "formManagement": ${UNKNOWN_STRING},
    "styling": ${UNKNOWN_STRING},
    "uiComponents": ${UNKNOWN_STRING},
    "testing": ${UNKNOWN_STRING},
    "authentication": ${UNKNOWN_STRING},
    "databaseLibrary": ${UNKNOWN_STRING},
    "databaseProvider": ${UNKNOWN_STRING},
    "api": ${UNKNOWN_STRING},
    "linting": ${UNKNOWN_STRING},
    "formatting": ${UNKNOWN_STRING},
    "payment": ${UNKNOWN_STRING},
    "analytics": ${UNKNOWN_STRING},
    "monitoring": ${UNKNOWN_STRING},
    "logging": ${UNKNOWN_STRING},
    "forms": ${UNKNOWN_STRING},
    "notifications": ${UNKNOWN_STRING},
    "search": ${UNKNOWN_STRING},
    "uploads": ${UNKNOWN_STRING},
    "validation": ${UNKNOWN_STRING},
    "documentation": ${UNKNOWN_STRING},
    "icons": ${UNKNOWN_STRING},
    "mail": ${UNKNOWN_STRING},
    "cache": ${UNKNOWN_STRING},
    "storage": ${UNKNOWN_STRING},
    "cdn": ${UNKNOWN_STRING},
    "cms": ${UNKNOWN_STRING},
    "i18n": ${UNKNOWN_STRING},
    "seo": ${UNKNOWN_STRING},
    "motion": ${UNKNOWN_STRING},
    "charts": ${UNKNOWN_STRING},
    "dates": ${UNKNOWN_STRING},
    "markdown": ${UNKNOWN_STRING},
    "security": ${UNKNOWN_STRING},
    "routing": ""
  },
  "monorepo": {
    "type": ${UNKNOWN_STRING},
    "packages": [],
    "sharedPackages": []
  },
  "ignoreDependencies": [],
  "customRules": {},
  "features": {
    "i18n": false,
    "analytics": false,
    "themeMode": ${UNKNOWN_STRING},
    "authentication": false,
    "api": false,
    "database": false,
    "testing": false,
    "docker": false,
    "ci": false,
    "commands": [],
    "webview": [],
    "language": [],
    "themes": []
  },
  "codeStyle": {
    "dontRemoveComments": false,
    "shouldAddComments": false,
    "typeOrInterface": ${UNKNOWN_STRING},
    "importOrRequire": ${UNKNOWN_STRING},
    "quoteMark": ${UNKNOWN_STRING},
    "semicolons": true,
    "lineWidth": 80,
    "indentStyle": ${UNKNOWN_STRING},
    "indentSize": 2,
    "importSymbol": ${UNKNOWN_STRING},
    "trailingComma": ${UNKNOWN_STRING},
    "bracketSpacing": true,
    "arrowParens": ${UNKNOWN_STRING},
    "tabWidth": 2,
    "jsToTs": false,
    "cjsToEsm": false,
    "modernize": {
      "replaceFs": false,
      "replacePath": false,
      "replaceHttp": false,
      "replaceProcess": false,
      "replaceConsole": false,
      "replaceEvents": false
    }
  },
  "multipleRepoCloneMode": false,
  "customUserFocusedRepos": [],
  "customDevsFocusedRepos": [],
  "hideRepoSuggestions": false,
  "customReposOnNewProject": false,
  "envComposerOpenBrowser": true,
  "skipPromptsUseAutoBehavior": false,
  "deployBehavior": ${UNKNOWN_STRING},
  "depsBehavior": ${UNKNOWN_STRING},
  "gitBehavior": ${UNKNOWN_STRING},
  "i18nBehavior": ${UNKNOWN_STRING},
  "scriptsBehavior": ${UNKNOWN_STRING},
  "existingRepoBehavior": ${UNKNOWN_STRING},
  "relinterConfirm": ${UNKNOWN_STRING},
  
  // Bump configuration
  "bumpDisable": ${DEFAULT_CONFIG_DLER.bumpDisable},
  "bumpFilter": ${JSON.stringify(getBumpFilter(isDev))},
  "bumpMode": "${DEFAULT_CONFIG_DLER.bumpMode}",
  "bumpSet": "${DEFAULT_CONFIG_DLER.bumpSet}",
  
  // Common configuration
  "commonPubPause": ${pausePublishValue},
  "commonPubRegistry": "${registryValue}",
  "commonVerbose": ${verboseValue},
  "displayBuildPubLogs": ${DEFAULT_CONFIG_DLER.displayBuildPubLogs},
  
  // Core configuration
  "coreBuildOutDir": "${DEFAULT_CONFIG_DLER.coreBuildOutDir}",
  "coreDeclarations": ${DEFAULT_CONFIG_DLER.coreDeclarations},
  "coreDescription": ${JSON.stringify(coreDescriptionValue)},
  "coreEntryFile": "${DEFAULT_CONFIG_DLER.coreEntryFile}",
  "coreEntrySrcDir": "${DEFAULT_CONFIG_DLER.coreEntrySrcDir}",
  "coreIsCLI": {
    "enabled": false,
    "scripts": {}
  },
  
  // JSR-only config
  "distJsrAllowDirty": ${DEFAULT_CONFIG_DLER.distJsrAllowDirty},
  "distJsrBuilder": "${DEFAULT_CONFIG_DLER.distJsrBuilder}",
  "distJsrDirName": "${DEFAULT_CONFIG_DLER.distJsrDirName}",
  "distJsrDryRun": ${DEFAULT_CONFIG_DLER.distJsrDryRun},
  "distJsrFailOnWarn": ${DEFAULT_CONFIG_DLER.distJsrFailOnWarn},
  "distJsrGenTsconfig": ${DEFAULT_CONFIG_DLER.distJsrGenTsconfig},
  "distJsrOutFilesExt": "${DEFAULT_CONFIG_DLER.distJsrOutFilesExt}",
  "distJsrSlowTypes": ${DEFAULT_CONFIG_DLER.distJsrSlowTypes},
  
  // NPM-only config
  "distNpmBuilder": "${DEFAULT_CONFIG_DLER.distNpmBuilder}",
  "distNpmDirName": "${DEFAULT_CONFIG_DLER.distNpmDirName}",
  "distNpmOutFilesExt": "${DEFAULT_CONFIG_DLER.distNpmOutFilesExt}",
  
  // Libraries Reliverse Plugin
  "libsActMode": "${libsActModeValue}",
  "libsDirDist": "${DEFAULT_CONFIG_DLER.libsDirDist}",
  "libsDirSrc": "${DEFAULT_CONFIG_DLER.libsDirSrc}",
  "libsList": ${JSON.stringify(getLibsObject(isDev), null, 2)},
  
  // Logger setup
  "logsFileName": "${DEFAULT_CONFIG_DLER.logsFileName}",
  "logsFreshFile": ${DEFAULT_CONFIG_DLER.logsFreshFile},
  
  // Dependency filtering
  "filterDepsPatterns": ${JSON.stringify(getFilterDepsPatterns(isDev), null, 2)},
  
  // Code quality tools
  "runBeforeBuild": [],
  "runAfterBuild": [],
  
  // Build hooks
  "hooksBeforeBuild": [],
  "hooksAfterBuild": [],
  
  // Post-build settings
  "postBuildSettings": {
    "deleteDistTmpAfterBuild": true
  },
  
  // Build setup
  "transpileFailOnWarn": ${DEFAULT_CONFIG_DLER.transpileFailOnWarn},
  "transpileEsbuild": "${DEFAULT_CONFIG_DLER.transpileEsbuild}",
  "transpileFormat": "${DEFAULT_CONFIG_DLER.transpileFormat}",
  "transpileMinify": ${DEFAULT_CONFIG_DLER.transpileMinify},
  "transpilePublicPath": "${DEFAULT_CONFIG_DLER.transpilePublicPath}",
  "transpileSourcemap": "${DEFAULT_CONFIG_DLER.transpileSourcemap}",
  "transpileSplitting": ${DEFAULT_CONFIG_DLER.transpileSplitting},
  "transpileStub": ${DEFAULT_CONFIG_DLER.transpileStub},
  "transpileTarget": "${DEFAULT_CONFIG_DLER.transpileTarget}",
  "transpileWatch": ${DEFAULT_CONFIG_DLER.transpileWatch},
  
  // Publish artifacts configuration
  "publishArtifacts": ${JSON.stringify(getPublishArtifacts(isDev), null, 2)},
  
  // Build extensions
  "buildPreExtensions": ["ts", "js"],
  "buildTemplatesDir": "templates",
  
  // Relinka Logger Configuration
  "relinka": {
    "verbose": false,
    "dirs": {
      "maxLogFiles": 5
    },
    "disableColors": false,
    "logFile": {
      "outputPath": "logs.log",
      "nameWithDate": "disable",
      "freshLogFile": true
    },
    "saveLogsToFile": true,
    "timestamp": {
      "enabled": false,
      "format": "HH:mm:ss"
    },
    "cleanupInterval": 10000,
    "bufferSize": 4096,
    "maxBufferAge": 5000,
    "levels": {
      "success": {
        "symbol": "✓",
        "fallbackSymbol": "[OK]",
        "color": "greenBright",
        "spacing": 3
      },
      "info": {
        "symbol": "i",
        "fallbackSymbol": "[i]",
        "color": "cyanBright",
        "spacing": 3
      },
      "error": {
        "symbol": "✖",
        "fallbackSymbol": "[ERR]",
        "color": "redBright",
        "spacing": 3
      },
      "warn": {
        "symbol": "⚠",
        "fallbackSymbol": "[WARN]",
        "color": "yellowBright",
        "spacing": 3
      },
      "fatal": {
        "symbol": "‼",
        "fallbackSymbol": "[FATAL]",
        "color": "redBright",
        "spacing": 3
      },
      "verbose": {
        "symbol": "✧",
        "fallbackSymbol": "[VERBOSE]",
        "color": "gray",
        "spacing": 3
      },
      "internal": {
        "symbol": "⚙",
        "fallbackSymbol": "[INTERNAL]",
        "color": "magentaBright",
        "spacing": 3
      },
      "log": {
        "symbol": "│",
        "fallbackSymbol": "|",
        "color": "dim",
        "spacing": 3
      },
      "message": {
        "symbol": "🞠",
        "fallbackSymbol": "[MSG]",
        "color": "cyan",
        "spacing": 3
      }
    }
  },
  
  // Remdn Configuration
  "remdn": {
    "title": "Directory Comparison",
    "output": "docs/files.html",
    "dirs": {
      "src": {},
      "dist-npm/bin": {},
      "dist-jsr/bin": {},
      "dist-libs/sdk/npm/bin": {}
    },
    "ext-map": {
      "ts": ["ts", "js-d.ts", "ts"]
    }
  }
}`;
}

// Generate the config file content
function generateConfig(
  isDev: boolean,
  pkgDescription?: string,
  configKind: ConfigKind = "ts",
): string {
  const importdefineConfigStatement = `import { defineConfig } from "./reltypes";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_DLER.commonVerbose);
  const coreIsCLI = getCoreIsCLI(isDev);
  const registryValue = getValue(isDev, "npm-jsr", DEFAULT_CONFIG_DLER.commonPubRegistry);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_DLER.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "reliverse (prev. dler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_DLER.coreDescription,
  );
  const libsActModeValue = getValue(isDev, "main-and-libs", DEFAULT_CONFIG_DLER.libsActMode);

  // ===================================================
  // Config template based on configKind
  // ===================================================

  if (configKind === "jsonc") {
    return generateJsoncConfig(isDev, pkgDescription);
  }

  // TypeScript config template
  const configTemplate = [
    importdefineConfigStatement,
    "",
    "/**",
    " * Reliverse Bundler Configuration",
    " * Hover over a field to see more details",
    " * @see https://github.com/reliverse/reliverse",
    " */",
    "export default defineConfig({",
    "  // Project configuration",
    `  projectName: ${UNKNOWN_STRING},`,
    `  projectAuthor: ${UNKNOWN_STRING},`,
    "  projectDescription: " + JSON.stringify(coreDescriptionValue) + ",",
    `  version: ${UNKNOWN_STRING},`,
    `  projectLicense: ${UNKNOWN_STRING},`,
    `  projectState: ${UNKNOWN_STRING},`,
    `  projectRepository: ${UNKNOWN_STRING},`,
    `  projectDomain: ${UNKNOWN_STRING},`,
    `  projectCategory: ${UNKNOWN_STRING},`,
    `  projectSubcategory: ${UNKNOWN_STRING},`,
    `  projectTemplate: ${UNKNOWN_STRING},`,
    `  projectTemplateDate: ${UNKNOWN_STRING},`,
    `  projectArchitecture: ${UNKNOWN_STRING},`,
    `  repoPrivacy: ${UNKNOWN_STRING},`,
    `  projectGitService: ${UNKNOWN_STRING},`,
    `  projectDeployService: ${UNKNOWN_STRING},`,
    `  repoBranch: ${UNKNOWN_STRING},`,
    `  projectFramework: ${UNKNOWN_STRING},`,
    `  projectPackageManager: ${UNKNOWN_STRING},`,
    `  projectRuntime: ${UNKNOWN_STRING},`,
    "  preferredLibraries: {",
    `    stateManagement: ${UNKNOWN_STRING},`,
    `    formManagement: ${UNKNOWN_STRING},`,
    `    styling: ${UNKNOWN_STRING},`,
    `    uiComponents: ${UNKNOWN_STRING},`,
    `    testing: ${UNKNOWN_STRING},`,
    `    authentication: ${UNKNOWN_STRING},`,
    `    databaseLibrary: ${UNKNOWN_STRING},`,
    `    databaseProvider: ${UNKNOWN_STRING},`,
    `    api: ${UNKNOWN_STRING},`,
    `    linting: ${UNKNOWN_STRING},`,
    `    formatting: ${UNKNOWN_STRING},`,
    `    payment: ${UNKNOWN_STRING},`,
    `    analytics: ${UNKNOWN_STRING},`,
    `    monitoring: ${UNKNOWN_STRING},`,
    `    logging: ${UNKNOWN_STRING},`,
    `    forms: ${UNKNOWN_STRING},`,
    `    notifications: ${UNKNOWN_STRING},`,
    `    search: ${UNKNOWN_STRING},`,
    `    uploads: ${UNKNOWN_STRING},`,
    `    validation: ${UNKNOWN_STRING},`,
    `    documentation: ${UNKNOWN_STRING},`,
    `    icons: ${UNKNOWN_STRING},`,
    `    mail: ${UNKNOWN_STRING},`,
    `    cache: ${UNKNOWN_STRING},`,
    `    storage: ${UNKNOWN_STRING},`,
    `    cdn: ${UNKNOWN_STRING},`,
    `    cms: ${UNKNOWN_STRING},`,
    `    i18n: ${UNKNOWN_STRING},`,
    `    seo: ${UNKNOWN_STRING},`,
    `    motion: ${UNKNOWN_STRING},`,
    `    charts: ${UNKNOWN_STRING},`,
    `    dates: ${UNKNOWN_STRING},`,
    `    markdown: ${UNKNOWN_STRING},`,
    `    security: ${UNKNOWN_STRING},`,
    `    routing: ${UNKNOWN_STRING},`,
    "  },",
    "  monorepo: {",
    `    type: ${UNKNOWN_STRING},`,
    "    packages: [],",
    "    sharedPackages: [],",
    "  },",
    "  ignoreDependencies: [],",
    "  customRules: {},",
    "  features: {",
    "    i18n: false,",
    "    analytics: false,",
    `    themeMode: ${UNKNOWN_STRING},`,
    "    authentication: false,",
    "    api: false,",
    "    database: false,",
    "    testing: false,",
    "    docker: false,",
    "    ci: false,",
    "    commands: [],",
    "    webview: [],",
    "    language: [],",
    "    themes: [],",
    "  },",
    "  codeStyle: {",
    "    dontRemoveComments: false,",
    "    shouldAddComments: false,",
    `    typeOrInterface: ${UNKNOWN_STRING},`,
    `    importOrRequire: ${UNKNOWN_STRING},`,
    `    quoteMark: ${UNKNOWN_STRING},`,
    "    semicolons: true,",
    "    lineWidth: 80,",
    `    indentStyle: ${UNKNOWN_STRING},`,
    "    indentSize: 2,",
    `    importSymbol: ${UNKNOWN_STRING},`,
    `    trailingComma: ${UNKNOWN_STRING},`,
    "    bracketSpacing: true,",
    `    arrowParens: ${UNKNOWN_STRING},`,
    "    tabWidth: 2,",
    "    jsToTs: false,",
    "    cjsToEsm: false,",
    "    modernize: {",
    "      replaceFs: false,",
    "      replacePath: false,",
    "      replaceHttp: false,",
    "      replaceProcess: false,",
    "      replaceConsole: false,",
    "      replaceEvents: false,",
    "    },",
    "  },",
    "  multipleRepoCloneMode: false,",
    "  customUserFocusedRepos: [],",
    "  customDevsFocusedRepos: [],",
    "  hideRepoSuggestions: false,",
    "  customReposOnNewProject: false,",
    "  envComposerOpenBrowser: true,",
    "  skipPromptsUseAutoBehavior: false,",
    `  deployBehavior: ${UNKNOWN_STRING},`,
    `  depsBehavior: ${UNKNOWN_STRING},`,
    `  gitBehavior: ${UNKNOWN_STRING},`,
    `  i18nBehavior: ${UNKNOWN_STRING},`,
    `  scriptsBehavior: ${UNKNOWN_STRING},`,
    `  existingRepoBehavior: ${UNKNOWN_STRING},`,
    `  relinterConfirm: ${UNKNOWN_STRING},`,
    "",
    "  // Bump configuration",
    "  bumpDisable: " + DEFAULT_CONFIG_DLER.bumpDisable + ",",
    "  bumpFilter: " + getBumpFilter(isDev) + ",",
    '  bumpMode: "' + DEFAULT_CONFIG_DLER.bumpMode + '",',
    '  bumpSet: "' + DEFAULT_CONFIG_DLER.bumpSet + '",',
    "",
    "  // Common configuration",
    "  commonPubPause: " + pausePublishValue + ",",
    '  commonPubRegistry: "' + registryValue + '",',
    "  commonVerbose: " + verboseValue + ",",
    "  displayBuildPubLogs: " + DEFAULT_CONFIG_DLER.displayBuildPubLogs + ",",
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
    "  // Libraries Reliverse Plugin",
    "  // Publish specific dirs as separate packages",
    "  // This feature is experimental at the moment",
    "  // Please commit your changes before using it",
    '  libsActMode: "' + libsActModeValue + '",',
    '  libsDirDist: "' + DEFAULT_CONFIG_DLER.libsDirDist + '",',
    '  libsDirSrc: "' + DEFAULT_CONFIG_DLER.libsDirSrc + '",',
    "  libsList: " + JSON.stringify(getLibsObject(isDev), null, 2) + ",",
    "",
    "  // @reliverse/relinka logger setup",
    '  logsFileName: "' + DEFAULT_CONFIG_DLER.logsFileName + '",',
    "  logsFreshFile: " + DEFAULT_CONFIG_DLER.logsFreshFile + ",",
    "",
    "  // Dependency filtering",
    "  // Global is always applied",
    "  filterDepsPatterns: " + getFilterDepsPatterns(isDev) + ",",
    "",
    "  // Code quality tools",
    "  // Available: tsc, eslint, biome, knip, reliverse-check",
    "  runBeforeBuild: [],",
    "  // Available: reliverse-check",
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
    "  // Relinka Logger Configuration",
    "  relinka: {",
    "    verbose: false,",
    "    dirs: {",
    "      maxLogFiles: 5,",
    "    },",
    "    disableColors: false,",
    "    logFile: {",
    '      outputPath: "logs.log",',
    '      nameWithDate: "disable",',
    "      freshLogFile: true,",
    "    },",
    "    saveLogsToFile: true,",
    "    timestamp: {",
    "      enabled: false,",
    '      format: "HH:mm:ss",',
    "    },",
    "    cleanupInterval: 10000,",
    "    bufferSize: 4096,",
    "    maxBufferAge: 5000,",
    "    levels: {",
    "      success: {",
    '        symbol: "✓",',
    '        fallbackSymbol: "[OK]",',
    '        color: "greenBright",',
    "        spacing: 3,",
    "      },",
    "      info: {",
    '        symbol: "i",',
    '        fallbackSymbol: "[i]",',
    '        color: "cyanBright",',
    "        spacing: 3,",
    "      },",
    "      error: {",
    '        symbol: "✖",',
    '        fallbackSymbol: "[ERR]",',
    '        color: "redBright",',
    "        spacing: 3,",
    "      },",
    "      warn: {",
    '        symbol: "⚠",',
    '        fallbackSymbol: "[WARN]",',
    '        color: "yellowBright",',
    "        spacing: 3,",
    "      },",
    "      fatal: {",
    '        symbol: "‼",',
    '        fallbackSymbol: "[FATAL]",',
    '        color: "redBright",',
    "        spacing: 3,",
    "      },",
    "      verbose: {",
    '        symbol: "✧",',
    '        fallbackSymbol: "[VERBOSE]",',
    '        color: "gray",',
    "        spacing: 3,",
    "      },",
    "      internal: {",
    '        symbol: "⚙",',
    '        fallbackSymbol: "[INTERNAL]",',
    '        color: "magentaBright",',
    "        spacing: 3,",
    "      },",
    "      log: {",
    '        symbol: "│",',
    '        fallbackSymbol: "|",',
    '        color: "dim",',
    "        spacing: 3,",
    "      },",
    "      message: {",
    '        symbol: "🞠",',
    '        fallbackSymbol: "[MSG]",',
    '        color: "cyan",',
    "        spacing: 3,",
    "      },",
    "    },",
    "  },",
    "",
    "  // Remdn Configuration",
    "  remdn: {",
    '    title: "Directory Comparison",',
    '    output: "docs/files.html",',
    "    dirs: {",
    "      src: {},",
    '      "dist-npm/bin": {},',
    '      "dist-jsr/bin": {},',
    '      "dist-libs/sdk/npm/bin": {},',
    "    },",
    '    "ext-map": {',
    '      ts: ["ts", "js-d.ts", "ts"],',
    "    },",
    "  },",
    "});",
  ].join("\n");
  return configTemplate;
}

function getCoreIsCLI(isDev: boolean): string {
  return isDev
    ? `coreIsCLI: { enabled: true, scripts: { reliverse: "reliverse.ts" } },`
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
    "reliverse.ts",
    "src-ts/app/config/info.ts",
  ]`
    : `["package.json", "reliverse.ts"]`;
}

function getPublishArtifacts(isDev: boolean): string {
  return isDev
    ? `{
    global: ["package.json", "README.md", "LICENSE", "LICENSES"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {
      "@reliverse/reliverse-sdk": {
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
      "@reliverse/reliverse",
      "!@reliverse/rse-sdk",
      "!@reliverse/reliverse-sdk",
    ],
    "dist-npm": [],
    "dist-jsr": ["+bun"],
    "dist-libs": {
      "@reliverse/reliverse-sdk": {
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
      "@reliverse/reliverse",
      "!@reliverse/rse-sdk",
      "!@reliverse/reliverse-sdk",
    ],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {},
  }`;
}
