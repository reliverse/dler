// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export { DEFAULT_CONFIG_DLER, defineConfigDler } from "./constants.js";
export { getBiomeConfig } from "./rse/rse-impl/rse-biome.js";
export {
  PROJECT_ROOT,
  rseName,
  tsconfigJson,
  cliConfigJsonc,
  cliConfigJsoncTmp,
  cliConfigJsoncBak,
  cliConfigTs,
  cliConfigTsTmp,
  cliConfigTsBak,
  rseOrg,
  rseOrgBase,
  cliDomainRoot,
  cliDomainDocs,
  cliDomainEnv,
  homeDir,
  cliHomeDir,
  cliHomeTmp,
  cliHomeRepos,
  memoryPath,
  cliJsrPath,
  useLocalhost,
  DEFAULT_CLI_USERNAME,
  endTitle,
  UNKNOWN_VALUE,
  DEFAULT_DOMAIN,
  RSE_SCHEMA_DEV,
  RSE_SCHEMA_URL,
  FALLBACK_ENV_EXAMPLE_URL,
  CONFIG_CATEGORIES,
} from "./rse/rse-impl/rse-consts.js";
export type { RequiredProjectContent } from "./rse/rse-impl/rse-content.js";
export { getProjectContent } from "./rse/rse-impl/rse-content.js";
export { getOrCreateRseConfig } from "./rse/rse-impl/rse-core.js";
export { writeRseConfig, createRseConfig, generateRseConfig } from "./rse/rse-impl/rse-create.js";
export {
  getDefaultRseConfig,
  generateDefaultRulesForProject,
} from "./rse/rse-impl/rse-def-utils.js";
export { DEFAULT_CONFIG_RSE, PROJECT_FRAMEWORK_FILES } from "./rse/rse-impl/rse-default.js";
export { defineConfigRse } from "./rse/rse-impl/rse-define.js";
export {
  detectProjectFramework,
  getPackageJson,
  getPackageJsonSafe,
  detectProject,
  detectProjectsWithRseConfig,
  detectFeatures,
} from "./rse/rse-impl/rse-detect.js";
export { generateConfigFiles, generateProjectConfigs } from "./rse/rse-impl/rse-gen-cfg.js";
export { injectSectionComments } from "./rse/rse-impl/rse-comments.js";
export { migrateRseConfig } from "./rse/rse-impl/rse-migrate.js";
export { getRseConfigPath } from "./rse/rse-impl/rse-path.js";
export { askRseConfigType } from "./rse/rse-impl/rse-prompts.js";
export { readRseTs, readRseConfig } from "./rse/rse-impl/rse-read.js";
export {
  repairAndParseJSON,
  fixLineByLine,
  parseAndFixRseConfig,
} from "./rse/rse-impl/rse-repair.js";
export { rseSchema, generateJsonSchema, generateSchemaFile } from "./rse/rse-impl/rse-schema.js";
export type {
  RseConfig,
  ProjectCategory,
  ProjectSubcategory,
  ProjectFramework,
  ProjectArchitecture,
  RelinterConfirm,
  IterableError,
  DetectedProject,
  BiomeConfigResult,
  BaseConfig,
  BiomeConfig,
  DeploymentService,
  VSCodeSettings,
} from "./rse/rse-impl/rse-types.js";
export { loadrse, watchrse } from "./rse/rse-impl/rse-unstable.js";
export { updateRseConfig, mergeWithDefaults } from "./rse/rse-impl/rse-update.js";
export {
  cleanGitHubUrl,
  objectToCodeString,
  updateTsConfigInclude,
  getBackupAndTempPaths,
  atomicWriteFile,
} from "./rse/rse-impl/rse-utils.js";
export type {
  DlerConfig,
  BumpMode,
  BundlerName,
  NpmOutExt,
  LibConfig,
  Esbuild,
  transpileFormat,
  Sourcemap,
  transpileTarget,
} from "./types.js";
// AUTO-GENERATED AGGREGATOR END
