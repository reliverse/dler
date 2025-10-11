import path from "@reliverse/pathkit";
import fs, { ensuredir } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

import { DEFAULT_CONFIG_RELIVERSE } from "~/impl/schema/mod";
import { ensureReltypesFile } from "../schema/utils";
import { cliConfigJsonc, cliConfigTs, rseOrg, UNKNOWN_STRING } from "./constants";

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
    // Read package.json details using pkg-types
    let pkgDescription: string | undefined;
    let hasDlerDep = false;
    try {
      const pkg = await readPackageJSON();
      if (pkg && typeof pkg.description === "string" && pkg.description.trim()) {
        pkgDescription = pkg.description.trim();
      }
      const deps = (pkg as { dependencies?: Record<string, string> }).dependencies;
      const devDeps = (pkg as { devDependencies?: Record<string, string> }).devDependencies;
      hasDlerDep = Boolean(
        (deps && "@reliverse/dler" in deps) || (devDeps && "@reliverse/dler" in devDeps),
      );
    } catch {
      // ignore, fallback to default
    }
    // Generate and write the config file
    const configContent = generateConfig(isDev, pkgDescription, configKind, hasDlerDep);
    await fs.outputFile(configPath, configContent, { encoding: "utf8" });
    relinka(
      "success",
      `${configKind === "ts" ? "TypeScript" : "JSONC"} config was created at ${configPath}`,
    );
    relinka("verbose", "Edit this file to customize different project settings");
  } catch (error: unknown) {
    relinka(
      "error",
      `Error creating configuration file: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

export async function prepareReliverseEnvironment(
  cwd: string,
  isDev: boolean,
  configKind: ConfigKind = DEFAULT_CONFIG_KIND,
) {
  // 0. Ensure cwd exists
  if (!(await fs.pathExists(cwd))) {
    await ensuredir(cwd);
  }

  // 1. Ensure reliverse config exists
  await ensureReliverseConfig(isDev, configKind);

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

  // 4. Generate reltypes.ts conditionally. If package.json exists and contains
  //    @reliverse/dler or is named @reliverse/dler, we skip reltypes.ts generation.
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

function getCoreEntrySrcDir(isDev: boolean): string {
  return isDev ? "src" : "src";
}

// Generate JSONC config file content
function generateJsoncConfig(isDev: boolean, pkgDescription?: string): string {
  const schemaUrl = `${rseOrg}/schema.json`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_RELIVERSE.commonVerbose);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_RELIVERSE.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "reliverse (prev. dler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_RELIVERSE.coreDescription,
  );
  const libsActModeValue = getValue(isDev, "main-and-libs", DEFAULT_CONFIG_RELIVERSE.libsActMode);

  return `// @reliverse/* libraries & rse configuration
// Hover over the fields to learn more details
// @see https://docs.reliverse.org/libraries
// Schema: ${schemaUrl}
{
  "$schema": "${schemaUrl}",
  
  // Project configuration
  "projectName": ${UNKNOWN_STRING},
  "projectAuthor": ${UNKNOWN_STRING},
  "projectDescription": ${JSON.stringify(coreDescriptionValue)},
  "version": ${UNKNOWN_STRING},
  "projectLicense": ${UNKNOWN_STRING},
  "projectState": "created",
  "projectRepository": ${UNKNOWN_STRING},
  "projectDomain": ${UNKNOWN_STRING},
  "projectCategory": ${UNKNOWN_STRING},
  "projectSubcategory": ${UNKNOWN_STRING},
  "projectTemplate": ${UNKNOWN_STRING},
  "projectTemplateDate": ${UNKNOWN_STRING},
  "projectArchitecture": ${UNKNOWN_STRING},
  "repoPrivacy": ${UNKNOWN_STRING},
  "projectGitService": "github",
  "projectDeployService": "none",
  "repoBranch": ${UNKNOWN_STRING},
  "projectFramework": ${UNKNOWN_STRING},
  "projectPackageManager": "bun",
  "projectRuntime": "node",
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
    "type": "none",
    "packages": [],
    "sharedPackages": []
  },
  "ignoreDependencies": [],
  "customRules": {},
  "features": {
    "i18n": false,
    "analytics": false,
    "themeMode": "light",
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
    "typeOrInterface": "mixed",
    "importOrRequire": "import",
    "quoteMark": "double",
    "semicolons": true,
    "lineWidth": 80,
    "indentStyle": "space",
    "indentSize": 2,
    "importSymbol": ${UNKNOWN_STRING},
    "trailingCommas": "all",
    "bracketSpacing": true,
    "arrowParens": "always",
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
  "bumpDisable": ${DEFAULT_CONFIG_RELIVERSE.bumpDisable},
  "bumpFilter": ${JSON.stringify(getBumpFilter(isDev))},
  "bumpMode": "${DEFAULT_CONFIG_RELIVERSE.bumpMode}",
  "bumpSet": "${DEFAULT_CONFIG_RELIVERSE.bumpSet}",
  
  // Common configuration
  "commonPubPause": ${pausePublishValue},
  "commonPubRegistry": "npm",
  "commonVerbose": ${verboseValue},
  "displayBuildPubLogs": ${DEFAULT_CONFIG_RELIVERSE.displayBuildPubLogs},
  
  // Core configuration
  "coreBuildOutDir": "${DEFAULT_CONFIG_RELIVERSE.coreBuildOutDir}",
  "coreDeclarations": ${DEFAULT_CONFIG_RELIVERSE.coreDeclarations},
  "coreDescription": ${JSON.stringify(coreDescriptionValue)},
  "coreEntryFile": "${DEFAULT_CONFIG_RELIVERSE.coreEntryFile}",
  "coreEntrySrcDir": "${getCoreEntrySrcDir(isDev)}",
  "coreIsCLI": {
    "enabled": false,
    "scripts": {}
  },
  
  // JSR-only config
  "distJsrAllowDirty": ${DEFAULT_CONFIG_RELIVERSE.distJsrAllowDirty},
  "distJsrBuilder": "${DEFAULT_CONFIG_RELIVERSE.distJsrBuilder}",
  "distJsrDirName": "${DEFAULT_CONFIG_RELIVERSE.distJsrDirName}",
  "distJsrDryRun": ${DEFAULT_CONFIG_RELIVERSE.distJsrDryRun},
  "distJsrFailOnWarn": ${DEFAULT_CONFIG_RELIVERSE.distJsrFailOnWarn},
  "distJsrGenTsconfig": ${DEFAULT_CONFIG_RELIVERSE.distJsrGenTsconfig},
  "distJsrOutFilesExt": "${DEFAULT_CONFIG_RELIVERSE.distJsrOutFilesExt}",
  "distJsrSlowTypes": ${DEFAULT_CONFIG_RELIVERSE.distJsrSlowTypes},
  
  // NPM-only config
  "distNpmBuilder": "${DEFAULT_CONFIG_RELIVERSE.distNpmBuilder}",
  "distNpmDirName": "${DEFAULT_CONFIG_RELIVERSE.distNpmDirName}",
  "distNpmOutFilesExt": "${DEFAULT_CONFIG_RELIVERSE.distNpmOutFilesExt}",
  
  // Binary Build Configuration
  "binaryBuildEnabled": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildEnabled},
  "binaryBuildInputFile": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildInputFile ? `"${DEFAULT_CONFIG_RELIVERSE.binaryBuildInputFile}"` : "undefined"},
  "binaryBuildTargets": "${DEFAULT_CONFIG_RELIVERSE.binaryBuildTargets}",
  "binaryBuildOutDir": "${DEFAULT_CONFIG_RELIVERSE.binaryBuildOutDir}",
  "binaryBuildMinify": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildMinify},
  "binaryBuildSourcemap": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildSourcemap},
  "binaryBuildBytecode": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildBytecode},
  "binaryBuildClean": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildClean},
  "binaryBuildWindowsIcon": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsIcon ? `"${DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsIcon}"` : "undefined"},
  "binaryBuildWindowsHideConsole": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsHideConsole},
  "binaryBuildAssetNaming": "${DEFAULT_CONFIG_RELIVERSE.binaryBuildAssetNaming}",
  "binaryBuildParallel": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildParallel},
  "binaryBuildExternal": ${JSON.stringify(DEFAULT_CONFIG_RELIVERSE.binaryBuildExternal)},
  "binaryBuildNoCompile": ${DEFAULT_CONFIG_RELIVERSE.binaryBuildNoCompile},
  
  // Libraries Reliverse Plugin
  "libsActMode": "${libsActModeValue}",
  "libsDirDist": "${DEFAULT_CONFIG_RELIVERSE.libsDirDist}",
  "libsDirSrc": "${DEFAULT_CONFIG_RELIVERSE.libsDirSrc}",
  "libsList": {},
  
  // Logger setup
  "logsFileName": "${DEFAULT_CONFIG_RELIVERSE.logsFileName}",
  "logsFreshFile": ${DEFAULT_CONFIG_RELIVERSE.logsFreshFile},
  
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
  "transpileFailOnWarn": ${DEFAULT_CONFIG_RELIVERSE.transpileFailOnWarn},
  "transpileEsbuild": "${DEFAULT_CONFIG_RELIVERSE.transpileEsbuild}",
  "transpileFormat": "${DEFAULT_CONFIG_RELIVERSE.transpileFormat}",
  "transpileMinify": ${DEFAULT_CONFIG_RELIVERSE.transpileMinify},
  "transpilePublicPath": "${DEFAULT_CONFIG_RELIVERSE.transpilePublicPath}",
  "transpileSourcemap": "${DEFAULT_CONFIG_RELIVERSE.transpileSourcemap}",
  "transpileSplitting": ${DEFAULT_CONFIG_RELIVERSE.transpileSplitting},
  "transpileStub": ${DEFAULT_CONFIG_RELIVERSE.transpileStub},
  "transpileTarget": "${DEFAULT_CONFIG_RELIVERSE.transpileTarget}",
  "transpileWatch": ${DEFAULT_CONFIG_RELIVERSE.transpileWatch},
  
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
    "cleanupInterval": 10_000,
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
  usePackageImport = false,
): string {
  const importdefineConfigStatement = usePackageImport
    ? `import { defineConfig } from "@reliverse/dler";`
    : `import { defineConfig } from "./reltypes";`;
  const verboseValue = getValue(isDev, true, DEFAULT_CONFIG_RELIVERSE.commonVerbose);
  const coreIsCLI = getCoreIsCLI(isDev);
  const pausePublishValue = getValue(isDev, false, DEFAULT_CONFIG_RELIVERSE.commonPubPause);
  const coreDescriptionValue = getValue(
    isDev,
    "reliverse (prev. dler) is a flexible, unified, and fully automated bundler for TypeScript and JavaScript projects, as well as an NPM and JSR publishing tool.",
    pkgDescription || DEFAULT_CONFIG_RELIVERSE.coreDescription,
  );

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
    " * @reliverse/* libraries & rse configuration",
    " * Hover over the fields to learn more details",
    " * @see https://docs.reliverse.org/libraries",
    " */",
    "export default defineConfig({",
    "  // Project configuration",
    `  projectName: ${UNKNOWN_STRING},`,
    `  projectAuthor: ${UNKNOWN_STRING},`,
    "  projectDescription: " + JSON.stringify(coreDescriptionValue) + ",",
    `  version: ${UNKNOWN_STRING},`,
    `  projectLicense: ${UNKNOWN_STRING},`,
    `  projectState: "created",`,
    `  projectRepository: ${UNKNOWN_STRING},`,
    `  projectDomain: ${UNKNOWN_STRING},`,
    `  projectCategory: ${UNKNOWN_STRING},`,
    `  projectSubcategory: ${UNKNOWN_STRING},`,
    `  projectTemplate: ${UNKNOWN_STRING},`,
    `  projectTemplateDate: ${UNKNOWN_STRING},`,
    `  projectArchitecture: ${UNKNOWN_STRING},`,
    `  repoPrivacy: ${UNKNOWN_STRING},`,
    `  projectGitService: "github",`,
    `  projectDeployService: "none",`,
    `  repoBranch: ${UNKNOWN_STRING},`,
    `  projectFramework: ${UNKNOWN_STRING},`,
    `  projectPackageManager: "bun",`,
    `  projectRuntime: "node",`,
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
    `    type: "none",`,
    "    packages: [],",
    "    sharedPackages: [],",
    "  },",
    "  ignoreDependencies: [],",
    "  customRules: {},",
    "  features: {",
    "    i18n: false,",
    "    analytics: false,",
    `    themeMode: "light",`,
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
    `    typeOrInterface: "mixed",`,
    `    importOrRequire: "import",`,
    `    quoteMark: "double",`,
    "    semicolons: true,",
    "    lineWidth: 80,",
    `    indentStyle: "space",`,
    "    indentSize: 2,",
    `    importSymbol: ${UNKNOWN_STRING},`,
    `    trailingCommas: "all",`,
    "    bracketSpacing: true,",
    `    arrowParens: "always",`,
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
    `  deployBehavior: "prompt",`,
    `  depsBehavior: "prompt",`,
    `  gitBehavior: "prompt",`,
    `  i18nBehavior: "prompt",`,
    `  scriptsBehavior: "prompt",`,
    `  existingRepoBehavior: "prompt",`,
    `  relinterConfirm: "promptEachFile",`,
    "",
    "  // Bump configuration",
    "  bumpDisable: " + DEFAULT_CONFIG_RELIVERSE.bumpDisable + ",",
    "  bumpFilter: " + getBumpFilter(isDev) + ",",
    '  bumpMode: "' + DEFAULT_CONFIG_RELIVERSE.bumpMode + '",',
    '  bumpSet: "' + DEFAULT_CONFIG_RELIVERSE.bumpSet + '",',
    "",
    "  // Common configuration",
    "  commonPubPause: " + pausePublishValue + ",",
    `  commonPubRegistry: "npm",`,
    "  commonVerbose: " + verboseValue + ",",
    "  displayBuildPubLogs: " + DEFAULT_CONFIG_RELIVERSE.displayBuildPubLogs + ",",
    "",
    "  // Core configuration",
    '  coreBuildOutDir: "' + DEFAULT_CONFIG_RELIVERSE.coreBuildOutDir + '",',
    "  coreDeclarations: " + DEFAULT_CONFIG_RELIVERSE.coreDeclarations + ",",
    "  coreDescription: " + JSON.stringify(coreDescriptionValue) + ",",
    '  coreEntryFile: "' + DEFAULT_CONFIG_RELIVERSE.coreEntryFile + '",',
    '  coreEntrySrcDir: "' + DEFAULT_CONFIG_RELIVERSE.coreEntrySrcDir + '",',
    "  " + coreIsCLI,
    "",
    "  // JSR-only config",
    "  distJsrAllowDirty: " + DEFAULT_CONFIG_RELIVERSE.distJsrAllowDirty + ",",
    '  distJsrBuilder: "' + DEFAULT_CONFIG_RELIVERSE.distJsrBuilder + '",',
    '  distJsrDirName: "' + DEFAULT_CONFIG_RELIVERSE.distJsrDirName + '",',
    "  distJsrDryRun: " + DEFAULT_CONFIG_RELIVERSE.distJsrDryRun + ",",
    "  distJsrFailOnWarn: " + DEFAULT_CONFIG_RELIVERSE.distJsrFailOnWarn + ",",
    "  distJsrGenTsconfig: " + DEFAULT_CONFIG_RELIVERSE.distJsrGenTsconfig + ",",
    '  distJsrOutFilesExt: "' + DEFAULT_CONFIG_RELIVERSE.distJsrOutFilesExt + '",',
    "  distJsrSlowTypes: " + DEFAULT_CONFIG_RELIVERSE.distJsrSlowTypes + ",",
    "",
    "  // NPM-only config",
    '  distNpmBuilder: "' + DEFAULT_CONFIG_RELIVERSE.distNpmBuilder + '",',
    '  distNpmDirName: "' + DEFAULT_CONFIG_RELIVERSE.distNpmDirName + '",',
    '  distNpmOutFilesExt: "' + DEFAULT_CONFIG_RELIVERSE.distNpmOutFilesExt + '",',
    "",
    "  // Binary Build Configuration",
    "  binaryBuildEnabled: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildEnabled + ",",
    "  binaryBuildInputFile: " +
      (DEFAULT_CONFIG_RELIVERSE.binaryBuildInputFile
        ? `"${DEFAULT_CONFIG_RELIVERSE.binaryBuildInputFile}"`
        : "undefined") +
      ",",
    "  binaryBuildTargets: " + JSON.stringify(DEFAULT_CONFIG_RELIVERSE.binaryBuildTargets) + ",",
    '  binaryBuildOutDir: "' + DEFAULT_CONFIG_RELIVERSE.binaryBuildOutDir + '",',
    "  binaryBuildMinify: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildMinify + ",",
    "  binaryBuildSourcemap: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildSourcemap + ",",
    "  binaryBuildBytecode: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildBytecode + ",",
    "  binaryBuildClean: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildClean + ",",
    "  binaryBuildWindowsIcon: " +
      (DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsIcon
        ? `"${DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsIcon}"`
        : "undefined") +
      ",",
    "  binaryBuildWindowsHideConsole: " +
      DEFAULT_CONFIG_RELIVERSE.binaryBuildWindowsHideConsole +
      ",",
    "  binaryBuildAssetNaming: " +
      JSON.stringify(DEFAULT_CONFIG_RELIVERSE.binaryBuildAssetNaming) +
      ",",
    "  binaryBuildParallel: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildParallel + ",",
    "  binaryBuildExternal: " + JSON.stringify(DEFAULT_CONFIG_RELIVERSE.binaryBuildExternal) + ",",
    "  binaryBuildNoCompile: " + DEFAULT_CONFIG_RELIVERSE.binaryBuildNoCompile + ",",
    "",
    "  // Libraries Reliverse Plugin",
    "  // Publish specific dirs as separate packages",
    "  // This feature is experimental at the moment",
    "  // Please commit your changes before using it",
    '  libsActMode: "main-project-only",',
    '  libsDirDist: "' + DEFAULT_CONFIG_RELIVERSE.libsDirDist + '",',
    '  libsDirSrc: "' + DEFAULT_CONFIG_RELIVERSE.libsDirSrc + '",',
    "  libsList: {},",
    "",
    "  // @reliverse/relinka logger setup",
    '  logsFileName: "' + DEFAULT_CONFIG_RELIVERSE.logsFileName + '",',
    "  logsFreshFile: " + DEFAULT_CONFIG_RELIVERSE.logsFreshFile + ",",
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
    '  transpileEsbuild: "' + DEFAULT_CONFIG_RELIVERSE.transpileEsbuild + '",',
    "  // transpileExternals: [],",
    "  transpileFailOnWarn: " + DEFAULT_CONFIG_RELIVERSE.transpileFailOnWarn + ",",
    '  transpileFormat: "' + DEFAULT_CONFIG_RELIVERSE.transpileFormat + '",',
    "  transpileMinify: " + DEFAULT_CONFIG_RELIVERSE.transpileMinify + ",",
    "  // transpileParallel: false,",
    '  transpilePublicPath: "' + DEFAULT_CONFIG_RELIVERSE.transpilePublicPath + '",',
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
    '  transpileSourcemap: "' + DEFAULT_CONFIG_RELIVERSE.transpileSourcemap + '",',
    "  transpileSplitting: " + DEFAULT_CONFIG_RELIVERSE.transpileSplitting + ",",
    "  transpileStub: " + DEFAULT_CONFIG_RELIVERSE.transpileStub + ",",
    "  // transpileStubOptions: { jiti: {} },",
    '  transpileTarget: "' + DEFAULT_CONFIG_RELIVERSE.transpileTarget + '",',
    "  transpileWatch: " + DEFAULT_CONFIG_RELIVERSE.transpileWatch + ",",
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
    "    cleanupInterval: 10_000,",
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
    ? `coreIsCLI: { enabled: true, scripts: { rse: "rse.ts" } },`
    : `coreIsCLI: { enabled: false, scripts: {} },`;
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
    "src/rse.ts",
  ]`
    : `["package.json", "reliverse.ts"]`;
}

function getPublishArtifacts(isDev: boolean): string {
  return isDev
    ? `{
    global: ["package.json", "README.md", "LICENSE", "LICENSES"],
    "dist-jsr": [],
    "dist-npm": [],
    "dist-libs": {},
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
    ],
    "dist-npm": [],
    "dist-jsr": [],
    "dist-libs": {},
  }`;
}
