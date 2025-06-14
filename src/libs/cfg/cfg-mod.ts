// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export { DEFAULT_CONFIG_DLER, defineConfigDler } from "./cfg-impl/cfg-consts.js";
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
} from "./cfg-impl/cfg-types.js";
export { getBiomeConfig } from "./cfg-impl/rse-config/rse-impl/rse-biome.js";
export { injectSectionComments } from "./cfg-impl/rse-config/rse-impl/rse-comments.js";
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
} from "./cfg-impl/rse-config/rse-impl/rse-consts.js";
export type { RequiredProjectContent } from "./cfg-impl/rse-config/rse-impl/rse-content.js";
export { getProjectContent } from "./cfg-impl/rse-config/rse-impl/rse-content.js";
export { getOrCreateRseConfig } from "./cfg-impl/rse-config/rse-impl/rse-core.js";
export {
  writeRseConfig,
  createRseConfig,
  generateRseConfig,
} from "./cfg-impl/rse-config/rse-impl/rse-create.js";
export {
  getDefaultRseConfig,
  generateDefaultRulesForProject,
} from "./cfg-impl/rse-config/rse-impl/rse-def-utils.js";
export {
  DEFAULT_CONFIG_RSE,
  PROJECT_FRAMEWORK_FILES,
} from "./cfg-impl/rse-config/rse-impl/rse-default.js";
export { defineConfigRse } from "./cfg-impl/rse-config/rse-impl/rse-define.js";
export {
  detectProjectFramework,
  getPackageJson,
  getPackageJsonSafe,
  detectProject,
  detectProjectsWithRseConfig,
  detectFeatures,
} from "./cfg-impl/rse-config/rse-impl/rse-detect.js";
export {
  generateConfigFiles,
  generateProjectConfigs,
} from "./cfg-impl/rse-config/rse-impl/rse-gen-cfg.js";
export { migrateRseConfig } from "./cfg-impl/rse-config/rse-impl/rse-migrate.js";
export { getRseConfigPath } from "./cfg-impl/rse-config/rse-impl/rse-path.js";
export { askRseConfigType } from "./cfg-impl/rse-config/rse-impl/rse-prompts.js";
export { readRseTs, readRseConfig } from "./cfg-impl/rse-config/rse-impl/rse-read.js";
export {
  repairAndParseJSON,
  fixLineByLine,
  parseAndFixRseConfig,
} from "./cfg-impl/rse-config/rse-impl/rse-repair.js";
export {
  rseSchema,
  generateJsonSchema,
  generateSchemaFile,
} from "./cfg-impl/rse-config/rse-impl/rse-schema.js";
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
} from "./cfg-impl/rse-config/rse-impl/rse-types.js";
export { loadrse, watchrse } from "./cfg-impl/rse-config/rse-impl/rse-unstable.js";
export { updateRseConfig, mergeWithDefaults } from "./cfg-impl/rse-config/rse-impl/rse-update.js";
export {
  cleanGitHubUrl,
  objectToCodeString,
  updateTsConfigInclude,
  getBackupAndTempPaths,
  atomicWriteFile,
} from "./cfg-impl/rse-config/rse-impl/rse-utils.js";
// AUTO-GENERATED AGGREGATOR END
