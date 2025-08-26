// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export { useORPC } from "./app/add/add-local/api/orpc";
export { useTRPC } from "./app/add/add-local/api/trpc";
export { useBetterAuth } from "./app/add/add-local/auth/better-auth";
export { useClerkAuth } from "./app/add/add-local/auth/clerk-auth";
export { useNextAuth } from "./app/add/add-local/auth/next-auth";
export { getPromptContent } from "./app/add/add-local/core/prompts";
export type { TemplateUpdateInfo } from "./app/add/add-local/core/templates";
export {
  checkForTemplateUpdate,
  getTemplateUpdateInfo,
  updateProjectTemplateDate,
} from "./app/add/add-local/core/templates";
export type { ShowMenuResult } from "./app/add/add-local/core/types";
export { useDrizzleORM } from "./app/add/add-local/db/drizzle";
export { usePrismaORM } from "./app/add/add-local/db/prisma";
export { useUploadthing } from "./app/add/add-local/files/uploadthing";
export { useReactHookForm } from "./app/add/add-local/form/react-hook-form";
export { useTanstackForm } from "./app/add/add-local/form/tanstack-form";
export { usePlasmoBrowserExtFramework } from "./app/add/add-local/fws/browser/plasmo";
export { useWxtBrowserExtFramework } from "./app/add/add-local/fws/browser/wxt";
export { useEslintConfig } from "./app/add/add-local/fws/configs/eslint-config";
export { useLynxNativeFramework } from "./app/add/add-local/fws/native/lynx";
export { useReactNativeFramework } from "./app/add/add-local/fws/native/react";
export { useEslintPlugin } from "./app/add/add-local/fws/plugins/eslint-plugin";
export { useVscodeExtFramework } from "./app/add/add-local/fws/vscode/vscode-ext";
export { useAstroWebFramework } from "./app/add/add-local/fws/web/astro";
export { useJStackWebFramework } from "./app/add/add-local/fws/web/jstack";
export { useNextJsWebFramework } from "./app/add/add-local/fws/web/next";
export { useTanstackStartWebFramework } from "./app/add/add-local/fws/web/start";
export { useViteWebFramework } from "./app/add/add-local/fws/web/vite";
export { useGtLibs } from "./app/add/add-local/i18n/gt-libs";
export { useLanguine } from "./app/add/add-local/i18n/languine";
export { useNextIntl } from "./app/add/add-local/i18n/next-intl";
export { useVercelAI } from "./app/add/add-local/llm/vercel";
export { useResendMail } from "./app/add/add-local/mail/resend";
export { usePolarPayments } from "./app/add/add-local/pay/polar";
export { useStripePayments } from "./app/add/add-local/pay/stripe";
export { useBiomeTool } from "./app/add/add-local/tool/biome";
export { useEslintTool } from "./app/add/add-local/tool/eslint";
export { useOxlintTool } from "./app/add/add-local/tool/oxlint";
export { use21stUI } from "./app/add/add-local/ui/21st";
export { useShadcnUI } from "./app/add/add-local/ui/shadcn";
export { useTailwindCSS } from "./app/add/add-local/ui/tailwind";
export {
  CACHE_ROOT_DIR,
  DEFAULT_BRANCH,
  getRepoCacheDir,
  RULE_FILE_EXTENSION,
  RULES_REPOS,
} from "./app/add/add-rule/add-rule-const";
export { handleDirectRules, showRulesMenu } from "./app/add/add-rule/add-rule-impl";
export type { RuleRepo, UnghRepoResponse } from "./app/add/add-rule/add-rule-types";
export {
  checkForRuleUpdates,
  checkRulesRepoUpdate,
  convertTsToMdc,
  downloadRules,
  handleRuleUpdates,
  hasCursorRulesDir,
  hasInstalledRules,
  installRules,
} from "./app/add/add-rule/add-rule-utils";
export { ensureOpenAIKey } from "./app/ai/ai-impl/ai-auth";
export { aiChat } from "./app/ai/ai-impl/ai-chat";
export {
  AGENT_NAMES,
  CIRCULAR_TRIGGERS,
  EXIT_KEYWORDS,
  MAX_TOKENS,
  MODEL,
  MODEL_NAME,
} from "./app/ai/ai-impl/ai-const";
export { aiAgenticTool } from "./app/ai/ai-impl/ai-tools";
export type { AIAgentOptions, AiSdkAgent, CircularTrigger } from "./app/ai/ai-impl/ai-types";
export { aiCodeCommand } from "./app/ai/ai-impl/code/code-mod";
export { handleMcpCommand } from "./app/ai/ai-impl/mcp/mcp-mod";
export type { LintSuggestion } from "./app/ai/ai-impl/relinter/relinter";
export {
  agentRelinter,
  collectLintableFiles,
  gatherLintSuggestions,
  writeSuggestionsToFile,
} from "./app/ai/ai-impl/relinter/relinter";
export { aiMenu } from "./app/ai/ai-menu";
export type { CommonIndexConfig, Import } from "./app/better/auth/(generators)/auth-config";
export { generateAuthConfig } from "./app/better/auth/(generators)/auth-config";
export {
  convertToSnakeCase,
  generateDrizzleSchema,
} from "./app/better/auth/(generators)/drizzle";
export { adapters, getGenerator } from "./app/better/auth/(generators)/index";
export { generateMigrations } from "./app/better/auth/(generators)/kysely";
export { generatePrismaSchema } from "./app/better/auth/(generators)/prisma";
export type { SchemaGenerator } from "./app/better/auth/(generators)/types";
export {
  addSvelteKitEnvModules,
  filterPrivateEnv,
  filterPublicEnv,
} from "./app/better/auth/(utils)/add-svelte-kit-env-modules";
export { checkPackageManagers } from "./app/better/auth/(utils)/check-package-managers";
export { formatMilliseconds } from "./app/better/auth/(utils)/format-ms";
export { generateSecretHash } from "./app/better/auth/(utils)/generate-secret";
export { getConfig, possiblePaths } from "./app/better/auth/(utils)/get-config";
export { getPackageInfo } from "./app/better/auth/(utils)/get-package-info";
export { getTsconfigInfo, stripJsonComments } from "./app/better/auth/(utils)/get-tsconfig-info";
export { configPath, schemaPath } from "./app/better/auth/consts";
export type { SupportedDatabases, SupportedPlugin } from "./app/better/auth/init/cmd";
export { init, supportedPlugins } from "./app/better/auth/init/cmd";
export { migrateAction } from "./app/better/auth/migrate/cmd";
export type { LibraryBuildOptions } from "./app/build/build-library";
export { library_buildLibrary } from "./app/build/build-library";
export { regular_buildJsrDist, regular_buildNpmDist } from "./app/build/build-regular";
export { dlerBuild } from "./app/build/impl";
export {
  libraries_build,
  libraries_publish,
  library_buildFlow,
  library_pubFlow,
} from "./app/build/library-flow";
export { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./app/build/postbuild";
export {
  directoryExists,
  executeDlerHooks,
  getPackageManager,
  isCommandAvailable,
} from "./app/build/ppb-utils";
export { dlerPreBuild } from "./app/build/prebuild";
export { autoPreset, definePreset } from "./app/build/providers/auto";
export { unifiedBuild } from "./app/build/providers/build";
export type { BunBuildOptions } from "./app/build/providers/bun/single-file";
export {
  buildForTarget,
  cleanOutputDir,
  getOutputFileName,
  listAvailableTargets,
  parseTargets,
  validateInputFile,
} from "./app/build/providers/bun/single-file";
export { copyBuild } from "./app/build/providers/copy/copy-mod";
export { createLoader } from "./app/build/providers/mkdist/mkdist-impl/loader";
export { jsLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/js";
export {
  defaultLoaders,
  resolveLoader,
  resolveLoaders,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/loaders-mod";
export type { PostcssLoaderOptions } from "./app/build/providers/mkdist/mkdist-impl/loaders/postcss";
export { postcssLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/postcss";
export { sassLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/sass";
export type {
  DefaultBlockLoaderOptions,
  DefineVueLoaderOptions,
  VueBlock,
  VueBlockLoader,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/vue";
export {
  fallbackVueLoader,
  vueLoader,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/vue";
export { mkdist } from "./app/build/providers/mkdist/mkdist-impl/make";
export type { DeclarationOutput } from "./app/build/providers/mkdist/mkdist-impl/utils/dts";
export {
  augmentWithDiagnostics,
  extractDeclarations,
  getDeclarations,
  normalizeCompilerOptions,
} from "./app/build/providers/mkdist/mkdist-impl/utils/dts";
export { copyFileWithStream } from "./app/build/providers/mkdist/mkdist-impl/utils/fs";
export { getVueDeclarations } from "./app/build/providers/mkdist/mkdist-impl/utils/vue-dts";
export { mkdistBuild } from "./app/build/providers/mkdist/mkdist-mod";
export { rollupBuild } from "./app/build/providers/rollup/build";
export { getRollupOptions } from "./app/build/providers/rollup/config";
export { cjsPlugin, fixCJSExportTypePlugin } from "./app/build/providers/rollup/plugins/cjs";
export { esbuild } from "./app/build/providers/rollup/plugins/esbuild";
export { JSONPlugin } from "./app/build/providers/rollup/plugins/json";
export { rawPlugin } from "./app/build/providers/rollup/plugins/raw";
export {
  getShebang,
  makeExecutable,
  removeShebangPlugin,
  shebangPlugin,
} from "./app/build/providers/rollup/plugins/shebang";
export { rollupStub } from "./app/build/providers/rollup/stub";
export {
  DEFAULT_EXTENSIONS,
  getChunkFilename,
  resolveAliases,
} from "./app/build/providers/rollup/utils";
export { rollupWatch } from "./app/build/providers/rollup/watch";
export { typesBuild } from "./app/build/providers/untyped/untyped-mod";
export {
  arrayIncludes,
  dumpObject,
  extractExportFilenames,
  getpkg,
  inferPkgExternals,
  listRecursively,
  removeExtension,
  resolvePreset,
  rmdir,
  symlink,
  warn,
  withTrailingSlash,
} from "./app/build/providers/utils";
export { validateDependencies, validatePackage } from "./app/build/providers/validate";
export { regular_buildFlow, regular_pubFlow } from "./app/build/regular-flow";
export { useFirecrawl } from "./app/clone/firecrawl/firecrawl-mod";
export { runCodemods } from "./app/cmod/cmod-impl";
export { getBiomeConfig } from "./app/config/biome";
export { injectSectionComments } from "./app/config/comments";
export {
  CONCURRENCY_DEFAULT,
  CONFIG_CATEGORIES,
  cliConfigJsonc,
  cliConfigJsoncBak,
  cliConfigJsoncTmp,
  cliConfigTs,
  cliConfigTsBak,
  cliConfigTsTmp,
  cliDomainDocs,
  cliDomainEnv,
  cliDomainRoot,
  cliHomeDir,
  cliHomeRepos,
  cliHomeTmp,
  cliJsrPath,
  cliName,
  cliVersion,
  DEFAULT_CLI_USERNAME,
  DEFAULT_DOMAIN,
  dlerName,
  endTitle,
  FALLBACK_ENV_EXAMPLE_URL,
  homeDir,
  IGNORE_PATTERNS,
  memoryPath,
  PROJECT_ROOT,
  RSE_SCHEMA_DEV,
  RSE_SCHEMA_URL,
  rseName,
  rseOrg,
  rseOrgBase,
  SHOW_VERBOSE,
  tsconfigJson,
  UNKNOWN_STRING,
  UNKNOWN_VALUE,
  useLocalhost,
  validExtensions,
} from "./app/config/constants";
export type { RequiredProjectContent } from "./app/config/content";
export { getProjectContent } from "./app/config/content";
export { ensureConfigMod } from "./app/config/core";
export { getOrCreateReliverseConfig } from "./app/config/core-cfg";
export {
  createReliverseConfig,
  generateReliverseConfig,
  writeReliverseConfig,
} from "./app/config/create";
export {
  generateDefaultRulesForProject,
  getDefaultReliverseConfig,
} from "./app/config/def-utils";
export {
  detectFeatures,
  detectProject,
  detectProjectFramework,
  detectProjectsWithReliverseConfig,
  getPackageJson,
  getPackageJsonSafe,
  PROJECT_FRAMEWORK_FILES,
} from "./app/config/detect";
export { generateConfigFiles, generateProjectConfigs } from "./app/config/gen-cfg";
export { getConfigBunfig, getConfigDler } from "./app/config/load";
export { migrateReliverseConfig } from "./app/config/migrate";
export { getReliverseConfigPath } from "./app/config/path";
export type { ConfigKind } from "./app/config/prepare";
export { ensureReliverseConfig, prepareReliverseEnvironment } from "./app/config/prepare";
export { readReliverseConfig, readRseTs } from "./app/config/read";
export {
  fixLineByLine,
  parseAndFixReliverseConfig,
  repairAndParseJSON,
} from "./app/config/repair";
export { loadrse, watchrse } from "./app/config/unstable";
export { mergeWithDefaults, updateReliverseConfig } from "./app/config/update";
export {
  atomicWriteFile,
  cleanGitHubUrl,
  getBackupAndTempPaths,
  objectToCodeString,
  updateTsConfigInclude,
} from "./app/config/utils";
export { resolveCrossLibs } from "./app/conv/cmd";
export { db } from "./app/db/client";
export { decrypt, encrypt } from "./app/db/config";
export {
  ad,
  getRandomAd,
  getRandomMessage,
  getWelcomeTitle,
  premium,
  randomAdContent,
  randomInitialMessage,
  randomProjectCategoryTitle,
  randomProjectFrameworkTitle,
  randomWebsiteDetailsTitle,
  randomWebsiteSubcategoryTitle,
  randomWelcomeMessages,
  randomWelcomeTitle,
} from "./app/db/messages";
export { configKeysTable, userDataTable } from "./app/db/schema";
export { envArgImpl } from "./app/env/env-impl";
export { default } from "./app/get/cmd";
export {
  checkPowerShellVersion,
  installDlerStandalone,
  installFromGitHub,
} from "./app/get/get-impl/get-core";
export { showManualBuilderMenu } from "./app/init/init-utils/init-impl";
export {
  determineProjectStatus,
  handleExistingProject,
  handleIncompleteProject,
  handleNewProject,
  handleProjectSelectionMenu,
  initMinimalrseProject,
  showExistingProjectMenu,
} from "./app/init/init-utils/init-utils";
export { handleOpenProjectMenu } from "./app/init/init-utils/mm-deprecated/editor-menu";
export { COLUMN_TYPES } from "./app/init/mm-deprecated/drizzle/manageDrizzleConstants";
export { manageDrizzleSchema } from "./app/init/mm-deprecated/drizzle/manageDrizzleSchema";
export {
  addColumnToTable,
  addNewTable,
  appendTableToSchema,
  detectDatabaseProvider,
  generateTableFile,
  getAvailableTables,
  manageRelations,
  removeFromSchemaIndex,
  removeTable,
  removeTableFromSchema,
  renameTable,
  renameTableInSchema,
  setupDrizzle,
  updateSchemaIndex,
  updateTableNameInIndex,
} from "./app/init/mm-deprecated/drizzle/manageDrizzleSchemaUtils";
export { handleIntegrations } from "./app/init/mm-deprecated/editor-impl";
export {
  installIntegration,
  removeIntegration,
  updatePackageJson,
} from "./app/init/mm-deprecated/editor-mod";
export { INTEGRATION_CONFIGS } from "./app/init/mm-deprecated/feature-add";
export { REMOVAL_CONFIGS } from "./app/init/mm-deprecated/feature-rm";
export { manageShadcn } from "./app/init/mm-deprecated/shadcn/shadcn-mod";
export {
  handleDependencies,
  handleNextAction,
  handleNextActions,
  initializeProjectConfig,
  setupI18nSupport,
  shouldInstallDependencies,
  showSuccessAndNextSteps,
} from "./app/init/use-template/cp-impl";
export { createMobileProject, createWebProject } from "./app/init/use-template/cp-mod";
export { showCloneProjectMenu } from "./app/init/use-template/cp-modules/cli-main-modules/cli-menu-items/showCloneProjectMenu";
export { showAnykeyPrompt } from "./app/init/use-template/cp-modules/cli-main-modules/modules/showAnykeyPrompt";
export {
  copyFromExisting,
  ensureEnvExists,
  ensureExampleExists,
  fetchEnvExampleContent,
  getEnvPath,
  getLastEnvFilePath,
  getMissingKeys,
  promptAndSetMissingValues,
  saveLastEnvFilePath,
} from "./app/init/use-template/cp-modules/compose-env-file/cef-impl";
export type {
  KeyType,
  KnownService,
} from "./app/init/use-template/cp-modules/compose-env-file/cef-keys";
export {
  dashboards,
  defaultValues,
  KNOWN_SERVICES,
  keyTypeSchema,
  keyVarsSchema,
  knownServiceSchema,
  serviceKeySchema,
} from "./app/init/use-template/cp-modules/compose-env-file/cef-keys";
export { composeEnvFile } from "./app/init/use-template/cp-modules/compose-env-file/cef-mod";
export {
  deployProject,
  selectDeploymentService,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/deploy";
export {
  configureGithubRepo,
  handleGitInit,
  promptGitDeploy,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/gdp-mod";
export {
  createCommit,
  handleGithubRepo,
  initGitDir,
  initializeGitRepo,
  pushGitCommits,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/git";
export {
  checkGithubRepoOwnership,
  createGithubRepo,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/github";
export { isSpecialDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/domainHelpers";
export { ensureDbInitialized } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/handlePkgJsonScripts";
export { promptForDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/promptForDomain";
export {
  isDirHasGit,
  setupGitRemote,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-git-github";
export {
  archiveExistingRepoContent,
  handleExistingRepoContent,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-private-repo";
export { handleExistingRepo } from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-repo-exists";
export {
  getVercelEnvVar,
  withRateLimit,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-api";
export { checkVercelDeployment } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-check";
export type { ConfigurationOptions } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-config";
export {
  configureBranchProtection,
  configureResources,
  enableAnalytics,
  getConfigurationOptions,
  updateProject,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-config";
export {
  createVercelProject,
  prepareVercelProjectCreation,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-create";
export {
  createInitialVercelDeployment,
  monitorDeployment,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-deploy";
export { getVercelProjectDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-domain";
export { addEnvVarsToVercelProject } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-env";
export type { VercelTeam } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-team";
export {
  getPrimaryVercelTeam,
  getVercelTeams,
  verifyTeam,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-team";
export type {
  DeploymentLog,
  DeploymentLogType,
  DeploymentOptions,
  EnvVar,
  VercelDeploymentConfig,
  VercelFramework,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-types";
export {
  detectFramework,
  getEnvVars,
  saveVercelToken,
  verifyDomain,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-utils";
export type {
  InjectionLocation,
  InjectionOptions,
  InjectionResult,
  SingleInjection,
} from "./app/inject/inject-impl-mod";
export {
  createInjection,
  injectAtLocation,
  injectMultiple,
  previewInjection,
  previewMultipleInjections,
  previewMultipleReverts,
  previewRevert,
  validateInjection,
  validateMultipleInjections,
} from "./app/inject/inject-impl-mod";
export { auth, authCheck } from "./app/login/login-impl";
export { deleteMemory } from "./app/logout/logout-impl";
export type {
  ApplyMagicSpellsOptions,
  ApplyMagicSpellsResult,
  FileWithSpells,
} from "./app/magic/magic-apply";
export {
  applyMagicSpells,
  getAllAvailableRegistries,
  getFilesWithMagicSpells,
  processSingleOutputFile,
} from "./app/magic/magic-apply";
export type {
  SpellDirective,
  SpellEvaluationContext,
  SpellInfo,
  SpellOutcome,
} from "./app/magic/magic-spells";
export { evaluateMagicDirective, getAvailableSpells } from "./app/magic/magic-spells";
export { migrateAnythingToBun } from "./app/migrate/codemods/anything-bun";
export { commanderToRempts } from "./app/migrate/codemods/commander-rempts";
export { consoleToRelinka } from "./app/migrate/codemods/console-relinka";
export { migrateFsToRelifso } from "./app/migrate/codemods/fs-relifso";
export type {
  CatalogMergeResult,
  DependencyEntry,
  MigrationResult,
} from "./app/migrate/codemods/monorepo-catalog";
export {
  displayMigrationResults,
  extractDependencies,
  mergeToCatalog,
  migrateFromCatalog,
  migrateToCatalog,
  removeCatalogFromRoot,
  replaceDependenciesWithCatalogRefs,
  restoreCatalogReferences,
  shouldSkipDependency,
  updateRootWithCatalog,
} from "./app/migrate/codemods/monorepo-catalog";
export {
  migrateModuleResolution,
  migrateToBundler,
  migrateToNodeNext,
} from "./app/migrate/codemods/nodenext-bundler";
export { migratePathToPathkit } from "./app/migrate/codemods/path-pathkit";
export { migrateReaddirToGlob } from "./app/migrate/codemods/readdir-glob";
export type { GenCfg, GenCfgJsonc } from "./app/mrse/mrse-impl";
export {
  downloadFileFromGitHub,
  ensureEnvCacheDir,
  getEnvCacheDir,
  getEnvCachePath,
  logVerbose,
  mrseVerbose,
} from "./app/mrse/mrse-impl";
export {
  escapeTemplateString,
  getFileMetadata,
  hashFile,
  readFileForTemplate,
  unescapeTemplateString,
  walkDir,
} from "./app/pack/cmd";
export type { DLER_TEMPLATE_NAMES } from "./app/providers/better-t-stack/better-t-stack-mod";
export {
  DLER_TEMPLATES,
  dlerTemplatesMap,
} from "./app/providers/better-t-stack/better-t-stack-mod";
export type {
  FileMetadata,
  Template,
  TemplatesFileContent,
} from "./app/providers/better-t-stack/better-t-stack-types";
export type { AvailableDependencies } from "./app/providers/better-t-stack/constants";
export {
  DEFAULT_CONFIG,
  dependencyVersionMap,
  PKG_ROOT,
} from "./app/providers/better-t-stack/constants";
export { setupMongoDBAtlas } from "./app/providers/better-t-stack/helpers/database-providers/mongodb-atlas-setup";
export { setupNeonPostgres } from "./app/providers/better-t-stack/helpers/database-providers/neon-setup";
export { setupPrismaPostgres } from "./app/providers/better-t-stack/helpers/database-providers/prisma-postgres-setup";
export { setupSupabase } from "./app/providers/better-t-stack/helpers/database-providers/supabase-setup";
export { setupTurso } from "./app/providers/better-t-stack/helpers/database-providers/turso-setup";
export { createProject } from "./app/providers/better-t-stack/helpers/project-generation/create-project";
export { createReadme } from "./app/providers/better-t-stack/helpers/project-generation/create-readme";
export type { EnvVariable } from "./app/providers/better-t-stack/helpers/project-generation/env-setup";
export {
  addEnvVariablesToFile,
  setupEnvironmentVariables,
} from "./app/providers/better-t-stack/helpers/project-generation/env-setup";
export { displayPostInstallInstructions } from "./app/providers/better-t-stack/helpers/project-generation/post-installation";
export {
  initializeGit,
  updatePackageConfigurations,
} from "./app/providers/better-t-stack/helpers/project-generation/project-config";
export {
  copyBaseTemplate,
  handleExtras,
  setupAddonsTemplate,
  setupAuthTemplate,
  setupBackendFramework,
  setupDbOrmTemplates,
  setupExamplesTemplate,
  setupFrontendTemplates,
} from "./app/providers/better-t-stack/helpers/project-generation/template-manager";
export { setupAddons } from "./app/providers/better-t-stack/helpers/setup/addons-setup";
export { setupApi } from "./app/providers/better-t-stack/helpers/setup/api-setup";
export {
  generateAuthSecret,
  setupAuth,
} from "./app/providers/better-t-stack/helpers/setup/auth-setup";
export { setupBackendDependencies } from "./app/providers/better-t-stack/helpers/setup/backend-setup";
export { setupDatabase } from "./app/providers/better-t-stack/helpers/setup/db-setup";
export { setupExamples } from "./app/providers/better-t-stack/helpers/setup/examples-setup";
export { setupRuntime } from "./app/providers/better-t-stack/helpers/setup/runtime-setup";
export { setupStarlight } from "./app/providers/better-t-stack/helpers/setup/starlight-setup";
export { setupTauri } from "./app/providers/better-t-stack/helpers/setup/tauri-setup";
export { DLER_TPL_ADDONS } from "./app/providers/better-t-stack/packed/addons";
export { DLER_TPL_API } from "./app/providers/better-t-stack/packed/api";
export { DLER_TPL_AUTH } from "./app/providers/better-t-stack/packed/auth";
export { DLER_TPL_BACKEND } from "./app/providers/better-t-stack/packed/backend";
export { DLER_TPL_BASE } from "./app/providers/better-t-stack/packed/base";
export { DLER_TPL_DB } from "./app/providers/better-t-stack/packed/db";
export { DLER_TPL_EXAMPLES } from "./app/providers/better-t-stack/packed/examples";
export { DLER_TPL_EXTRAS } from "./app/providers/better-t-stack/packed/extras";
export { DLER_TPL_FRONTEND } from "./app/providers/better-t-stack/packed/frontend";
export { DLER_TPL_RUNTIME } from "./app/providers/better-t-stack/packed/runtime";
export { getAddonsChoice } from "./app/providers/better-t-stack/prompts/addons";
export { getApiChoice } from "./app/providers/better-t-stack/prompts/api";
export { getAuthChoice } from "./app/providers/better-t-stack/prompts/auth";
export { getBackendFrameworkChoice } from "./app/providers/better-t-stack/prompts/backend";
export { gatherConfig } from "./app/providers/better-t-stack/prompts/config-prompts";
export { getDatabaseChoice } from "./app/providers/better-t-stack/prompts/database";
export { getDBSetupChoice } from "./app/providers/better-t-stack/prompts/database-setup";
export { getExamplesChoice } from "./app/providers/better-t-stack/prompts/examples";
export { getFrontendChoice } from "./app/providers/better-t-stack/prompts/frontend";
export { getGitChoice } from "./app/providers/better-t-stack/prompts/git";
export { getinstallChoice } from "./app/providers/better-t-stack/prompts/install";
export { getORMChoice } from "./app/providers/better-t-stack/prompts/orm";
export { getPackageManagerChoice } from "./app/providers/better-t-stack/prompts/package-manager";
export { getProjectName } from "./app/providers/better-t-stack/prompts/project-name";
export { getRuntimeChoice } from "./app/providers/better-t-stack/prompts/runtime";
export type {
  Addons,
  API,
  AvailablePackageManagers,
  Backend,
  CLIInput,
  CreateInput,
  Database,
  DatabaseSetup,
  Examples,
  Frontend,
  ORM,
  ProjectConfig,
  ProjectName,
  Runtime,
} from "./app/providers/better-t-stack/types";
export {
  AddonsSchema,
  APISchema,
  BackendSchema,
  DatabaseSchema,
  DatabaseSetupSchema,
  ExamplesSchema,
  FrontendSchema,
  ORMSchema,
  PackageManagerSchema,
  ProjectNameSchema,
  RuntimeSchema,
} from "./app/providers/better-t-stack/types";
export { addPackageDependency } from "./app/providers/better-t-stack/utils/add-package-deps";
export { trackProjectCreation } from "./app/providers/better-t-stack/utils/analytics";
export { commandExists } from "./app/providers/better-t-stack/utils/command-exists";
export { displayConfig } from "./app/providers/better-t-stack/utils/display-config";
export { generateReproducibleCommand } from "./app/providers/better-t-stack/utils/generate-reproducible-command";
export { getLatestCLIVersion } from "./app/providers/better-t-stack/utils/get-latest-cli-version";
export { getPackageExecutionCommand } from "./app/providers/better-t-stack/utils/get-package-execution-command";
export { openUrl } from "./app/providers/better-t-stack/utils/open-url";
export { renderTitle, TITLE_TEXT } from "./app/providers/better-t-stack/utils/render-title";
export type { SponsorEntry } from "./app/providers/better-t-stack/utils/sponsors";
export {
  displaySponsors,
  fetchSponsors,
  SPONSORS_JSON_URL,
} from "./app/providers/better-t-stack/utils/sponsors";
export { processTemplate } from "./app/providers/better-t-stack/utils/template-processor";
export {
  getProvidedFlags,
  processAndValidateFlags,
  validateConfigCompatibility,
} from "./app/providers/better-t-stack/validation";
export {
  showNewProjectMenu,
  showOpenProjectMenu,
} from "./app/providers/reliverse-stack/reliverse-stack-mod";
export type {
  BrowserRepoOption,
  VSCodeRepoOption,
} from "./app/providers/reliverse-stack/rs-impl";
export {
  configureBrowserExtension,
  configureVSCodeExtension,
  optionCreateBrowserExtension,
  optionCreateVSCodeExtension,
  optionCreateWebProject,
} from "./app/providers/reliverse-stack/rs-impl";
export { dlerPub } from "./app/pub/impl";
export { library_publishLibrary } from "./app/pub/pub-library";
export { regular_pubToJsr, regular_pubToNpm } from "./app/pub/pub-regular";
export type { ConfigRemdn } from "./app/remdn/cmd";
export { scanDirectories } from "./app/remdn/cmd";
export { checkReliverseConfigHealth } from "./app/rules/reliverse/dler-config-health/dler-config-health";
export { checkFileExtensions } from "./app/rules/reliverse/file-extensions/file-extensions";
export { analyzeDependencies } from "./app/rules/reliverse/missing-deps/analyzer";
export { checkMissingDependencies } from "./app/rules/reliverse/missing-deps/deps-mod";
export type {
  DependencyResult,
  FinderOptions,
  MissingDepsFileType,
  PackageJson,
} from "./app/rules/reliverse/missing-deps/deps-types";
export {
  findSourceFiles,
  readFile,
  readPackageJson,
} from "./app/rules/reliverse/missing-deps/filesystem";
export { formatOutput } from "./app/rules/reliverse/missing-deps/formatter";
export {
  extractPackageNames,
  getBuiltinModules,
  getListedDependencies,
  normalizePackageName,
} from "./app/rules/reliverse/missing-deps/parser";
export { checkNoDynamicImports } from "./app/rules/reliverse/no-dynamic-imports/no-dynamic-imports";
export { checkNoIndexFiles } from "./app/rules/reliverse/no-index-files/no-index-files";
export { checkPackageJsonHealth } from "./app/rules/reliverse/package-json-health/package-json-health";
export { checkPathExtensions } from "./app/rules/reliverse/path-extensions/path-extensions";
export { checkSelfInclude } from "./app/rules/reliverse/self-include/self-include";
export { checkTsConfigHealth } from "./app/rules/reliverse/tsconfig-health/tsconfig-health";
export type { AllowedFileExtensionsType } from "./app/rules/rules-consts";
export {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_IMPORT_EXTENSIONS,
  STRICT_FILE_EXTENSIONS,
  STRICT_IMPORT_EXTENSIONS,
} from "./app/rules/rules-consts";
export { displayCheckResults } from "./app/rules/rules-mod";
export { getAllFiles, getLineNumber, shouldIgnoreFile } from "./app/rules/rules-utils";
export { generateReltypesContent } from "./app/schema/gen";
export type {
  BumpMode,
  BundlerName,
  Esbuild,
  LibConfig,
  LogLevel,
  LogLevelConfig,
  LogLevelsConfig,
  NpmOutExt,
  ProjectArchitecture,
  ProjectCategory,
  ProjectFramework,
  ProjectSubcategory,
  RelinkaDirsConfig,
  RelinterConfirm,
  ReliverseConfig,
  Sourcemap,
  TranspileFormat,
  TranspileTarget,
} from "./app/schema/mod";
export { DEFAULT_CONFIG_RELIVERSE, defineConfig } from "./app/schema/mod";
export { checkIfRegenerationNeeded, ensureReltypesFile } from "./app/schema/utils";
export { getAllSourceFiles, splitLargeFileByLines, splitLargeFunctions } from "./app/split/impl";
export {
  downloadRepoOption,
  rmTestsRuntime,
} from "./app/toolbox/toolbox-impl";
export { openVercelTools } from "./app/toolbox/toolbox-vercel";
export type {
  BundleSource,
  IndentOptions,
  MagicStringOptions,
  OverwriteOptions,
  StringTransformer,
  TransformResult,
  UpdateOptions,
} from "./app/transform/transform-impl-mod";
export {
  append,
  compose,
  createBundle,
  createTransformer,
  createTransformerFromMagicString,
  indent,
  insertAt,
  overwrite,
  pipe,
  prepend,
  readAndTransform,
  remove,
  replace,
  replaceAll,
  slice,
  template,
  transformAndWrite,
  transformMultiple,
  trim,
  update,
  wrapWith,
} from "./app/transform/transform-impl-mod";
export type {
  AppParams,
  BaseBuildEntry,
  BaseConfig,
  Behavior,
  BiomeConfig,
  BiomeConfigResult,
  BuildContext,
  BuildEntry,
  BuildHooks,
  BuildOptions,
  BuildPreset,
  CamelCase,
  CheckIssue,
  CheckResult,
  ColumnType,
  CopyBuildEntry,
  CopyHooks,
  CreateLoaderOptions,
  DatabasePostgresProvider,
  DatabaseProvider,
  DeploymentService,
  DetectedProject,
  DirectoryType,
  DistDirs,
  DistDirsAll,
  EsbuildOptions,
  GitModParams,
  HyphenatedStringToCamelCase,
  IconName,
  InputFile,
  IntegrationCategory,
  IntegrationConfig,
  IntegrationOption,
  IntegrationOptions,
  IterableError,
  Loader,
  LoaderContext,
  LoaderResult,
  LoadFile,
  MkdistBuildEntry,
  MkdistHooks,
  MkdistOptions,
  ModernReplacement,
  MonorepoType,
  NavItem,
  NavItemWithChildren,
  NavigationEntry,
  OutputFile,
  ParamsOmitReli,
  ParamsOmitSkipPN,
  PerfTimer,
  PrismaField,
  PrismaModel,
  ProjectConfigReturn,
  ProjectSelectionResult,
  RemovalConfig,
  RollupBuildEntry,
  RollupBuildOptions,
  RollupHooks,
  RollupOptions,
  RulesCheckOptions,
  ShadcnConfig,
  SubOption,
  TableSchema,
  Theme,
  UnifiedBuildConfig,
  UntypedBuildEntry,
  UntypedHooks,
  UntypedOutput,
  UntypedOutputs,
  VSCodeSettings,
} from "./app/types/mod";
export {
  checkPackageUpdates,
  displayUpdateSummary,
  getEffectiveLinker,
  handleCatalogOnlyUpdate,
  handleInstallation,
  handleInteractiveSelection,
  handleRecursiveUpdates,
  handleToolUpgrades,
  handleWorkspaceUpdates,
  prepareUpdateCandidates,
  updateRootPackageJson,
  validatePackageJson,
  validateUpdateArgs,
} from "./app/update/impl";
export type {
  DependencyInfo,
  PackageCheckOptions,
  UpdateResult,
  UpgradeResult,
} from "./app/update/utils";
export {
  applyVersionUpdate,
  CACHE_TTL,
  checkPackageUpdate,
  collectTargetDependencies,
  displayUpdateResults,
  fetchVersionFromRegistry,
  findAllPackageJsons,
  findWorkspacePackageJsons,
  getGlobalPackages,
  getLatestVersion,
  getPmOptions,
  handleGlobalUpdates,
  isCatalogReference,
  isMonorepo,
  isNonSemverSpecifier,
  isNpmAlias,
  isSemverCompatible,
  isWorkspaceDependency,
  prepareDependenciesForUpdate,
  runInstallCommand,
  runInstallCommandWithFilter,
  updateGlobalPackage,
  updatePackageJsonFile,
  updateWorkspacePackages,
  upgradeBun,
  upgradeDlerGlobal,
  upgradeDlerLocal,
  upgradeGit,
  upgradeNode,
  upgradeNpm,
  upgradePnpm,
  upgradeYarn,
  versionCache,
} from "./app/update/utils";
export type { UploadFile, UploadResult } from "./app/upload/providers/providers-mod";
export {
  readFilesFromPaths,
  uploadToProvider,
} from "./app/upload/providers/providers-mod";
export type { UploadedUCFile } from "./app/upload/providers/uploadcare";
export { uploadToUploadcare } from "./app/upload/providers/uploadcare";
export type { UploadedFile } from "./app/upload/providers/uploadthing";
export { uploadToUploadthing } from "./app/upload/providers/uploadthing";
export { formatBytes } from "./app/upload/upload-utils";
export { promptAggCommand } from "./app/utils/agg/agg-1";
export { useAggregator } from "./app/utils/agg/agg-2";
export {
  buildPathRelative,
  collectFiles,
  generateAggregatorLines,
  getNamedExports,
  guessStarImportIdentifier,
  printUsage,
} from "./app/utils/agg/agg-3";
export { fileExists, findMainEntryFile } from "./app/utils/agg/agg-4";
export { isAggregationDisabled } from "./app/utils/agg/agg-5";
export { BINARY_EXTS, BINARY_SET } from "./app/utils/b-exts";
export { experimental, recommended } from "./app/utils/badgeNotifiers";
export { isBinaryExt } from "./app/utils/binary";
export { convertCjsToEsm } from "./app/utils/codemods/convertCjsToEsm";
export {
  convertDatabaseProvider,
  convertPrismaToDrizzle,
} from "./app/utils/codemods/convertDatabase";
export { convertTypeDefinitions } from "./app/utils/codemods/convertDefinitions";
export { convertImportStyle } from "./app/utils/codemods/convertImportStyle";
export { convertJsToTs } from "./app/utils/codemods/convertJsToTs";
export { convertQuoteStyle } from "./app/utils/codemods/convertQuoteStyle";
export { convertRuntime } from "./app/utils/codemods/convertRuntime";
export { convertToMonorepo } from "./app/utils/codemods/convertToMonorepo";
export { removeComments } from "./app/utils/codemods/removeComments";
export { getUnusedDependencies } from "./app/utils/codemods/removeUnusedDeps";
export { replaceImportSymbol } from "./app/utils/codemods/replaceImportSymbol";
export { replaceWithModern } from "./app/utils/codemods/replaceWithModern";
export type { CommentMapping, CommentStyle, FileExtension } from "./app/utils/comments";
export { COMMENT_MAP, DEFAULT_COMMENT, getCommentPrefix } from "./app/utils/comments";
export { commonEndActions, commonStartActions } from "./app/utils/common";
export { createPackageJSON } from "./app/utils/createPackageJSON";
export { decide } from "./app/utils/decideHelper";
export type {
  DetectionSource,
  DetectOptions,
  PkgManagerInfo,
} from "./app/utils/dependencies/getUserPkgManager";
export {
  getAllPkgManagers,
  getUserPkgManager,
} from "./app/utils/dependencies/getUserPkgManager";
export { setupI18nFiles } from "./app/utils/downloading/downloadI18nFiles";
export type { DownloadResult } from "./app/utils/downloading/downloadRepo";
export { downloadRepo } from "./app/utils/downloading/downloadRepo";
export { handleDownload } from "./app/utils/downloading/handleDownload";
export {
  hookChildProcess,
  notFoundError,
  verifyENOENT,
  verifyENOENTSync,
} from "./app/utils/exec/exec-enoent";
export type { EnvLike, EnvPathInfo } from "./app/utils/exec/exec-env";
export { computeEnv } from "./app/utils/exec/exec-env";
export { NonZeroExitError } from "./app/utils/exec/exec-error";
export { escapeArgument, escapeCommand } from "./app/utils/exec/exec-escape";
export type {
  KillSignal,
  Options,
  Output,
  OutputApi,
  PipeOptions,
  Result,
  XExec,
} from "./app/utils/exec/exec-mod";
export { ExecProcess, exec, x } from "./app/utils/exec/exec-mod";
export { parse } from "./app/utils/exec/exec-parse";
export { resolveCommand } from "./app/utils/exec/exec-resolve";
export { readShebang } from "./app/utils/exec/exec-shebang";
export { spawn, spawnSync } from "./app/utils/exec/exec-spawn";
export { combineStreams, waitForEvent } from "./app/utils/exec/exec-stream";
export type { ExecParseResult } from "./app/utils/exec/exec-types";
export { _parse } from "./app/utils/exec/exec-types";
export {
  detectBufferType,
  detectFileType,
  detectStreamType,
  getMimeType,
  isBinary,
} from "./app/utils/file-type";
export { finalizeBuild, finalizePub } from "./app/utils/finalize";
export { prepareCLIFiles, safeRename } from "./app/utils/fs-rename";
export { getEffectiveDir } from "./app/utils/getEffectiveDir";
export { pm, pmx } from "./app/utils/getPackageManager";
export { uninstallDependencies } from "./app/utils/handlers/dependencies";
export { handleCleanup } from "./app/utils/handlers/handleCleanup";
export { handleCodemods } from "./app/utils/handlers/handleCodemods";
export { isVSCodeInstalled } from "./app/utils/handlers/isAppInstalled";
export type { ScriptStatus } from "./app/utils/handlers/promptPackageJsonScripts";
export { promptPackageJsonScripts } from "./app/utils/handlers/promptPackageJsonScripts";
export {
  AVAILABLE_COMPONENTS,
  applyTheme,
  getInstalledComponents,
  installComponent,
  readShadcnConfig,
  removeComponent,
  selectChartsPrompt,
  selectSidebarPrompt,
  THEMES,
  updateComponent,
} from "./app/utils/handlers/shadcn";
export { hasOnlyRse } from "./app/utils/hasOnlyReliverseConfig";
export {
  CONTENT_CREATE_MODES,
  DEST_FILE_EXISTS_BEHAVIOURS,
  FILE_TYPES,
  INIT_BEHAVIOURS,
} from "./app/utils/init/init-const";
export {
  createFileFromScratch,
  escapeMarkdownCodeBlocks,
  initFile,
  initFiles,
} from "./app/utils/init/init-impl";
export { gitignoreTemplate, licenseTemplate, readmeTemplate } from "./app/utils/init/init-tmpl";
export type {
  DestFileExistsBehaviour,
  FileType,
  InitBehaviour,
  InitFileOptions,
  InitFileRequest,
  InitFileResult,
  ReinitUserConfig,
} from "./app/utils/init/init-types";
export type { InstanceGithub } from "./app/utils/instanceGithub";
export {
  ensureGithubToken,
  initGithubSDK,
  OctokitWithRest,
  octokitUserAgent,
} from "./app/utils/instanceGithub";
export type { InstanceVercel } from "./app/utils/instanceVercel";
export { askVercelToken, initVercelSDK } from "./app/utils/instanceVercel";
export { getMaxHeightSize, sleep } from "./app/utils/microHelpers";
export { hasConfigFiles, isMrseProject } from "./app/utils/mrseHelpers";
export { checkScriptExists } from "./app/utils/pkgJsonHelpers";
export {
  addDependency,
  addDevDependency,
  dedupeDependencies,
  ensureDependencyInstalled,
  installDependencies,
  removeDependency,
  runScript,
  updateDependencies,
} from "./app/utils/pm/pm-api";
export type { CatalogStructure } from "./app/utils/pm/pm-catalog";
export {
  addToCatalog,
  getCatalogReference,
  getCatalogStructure,
  isCatalogSupported,
  listCatalogs,
  removeFromCatalog,
  updateCatalogs,
} from "./app/utils/pm/pm-catalog";
export { detectPackageManager, packageManagers } from "./app/utils/pm/pm-detect";
export {
  latestVersion,
  PackageNotFoundError,
  pmPackageJson,
  VersionNotFoundError,
} from "./app/utils/pm/pm-meta";
export { findup, parsePackageManagerField } from "./app/utils/pm/pm-parse";
export type {
  DetectPackageManagerOptions,
  OperationOptions,
  PackageManager,
  PackageManagerName,
} from "./app/utils/pm/pm-types";
export {
  doesDependencyExist,
  executeCommand,
  getWorkspaceArgs,
  NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG,
  resolveOperationOptions,
} from "./app/utils/pm/pm-utils";
export type {
  CategoryFromSchema,
  CloneOrTemplateRepo,
  RepoFromSchema,
  RepoOption,
} from "./app/utils/projectRepository";
export {
  getRepoInfo,
  REPO_TEMPLATES,
  saveRepoToDevice,
  TEMP_BROWSER_TEMPLATE_OPTIONS,
  TEMP_FULLSTACK_WEBSITE_TEMPLATE_OPTIONS,
  TEMP_SEPARATED_WEBSITE_TEMPLATE_OPTIONS,
  TEMP_VSCODE_TEMPLATE_OPTIONS,
} from "./app/utils/projectRepository";
export { askAppOrLib } from "./app/utils/prompts/askAppOrLib";
export { askInstallDeps } from "./app/utils/prompts/askInstallDeps";
export { askOpenInIDE } from "./app/utils/prompts/askOpenInIDE";
export { askProjectName } from "./app/utils/prompts/askProjectName";
export { askUsernameFrontend } from "./app/utils/prompts/askUsernameFrontend";
export { askUsernameGithub } from "./app/utils/prompts/askUsernameGithub";
export { shouldInitGit } from "./app/utils/prompts/shouldInitGit";
export { getOrCreateReliverseMemory, updateReliverseMemory } from "./app/utils/reliverseMemory";
export type { ReplaceConfig } from "./app/utils/replacements/reps-impl";
export { extractRepoInfo, replaceStringsInFiles } from "./app/utils/replacements/reps-impl";
export type { Hardcoded, UrlPatterns } from "./app/utils/replacements/reps-keys";
export {
  CommonPatterns,
  HardcodedStrings,
  hardcodedSchema,
  urlPatternsSchema,
} from "./app/utils/replacements/reps-keys";
export { handleReplacements } from "./app/utils/replacements/reps-mod";
export { resolveAllCrossLibs } from "./app/utils/resolve-cross-libs";
export type {
  EncryptedDataMemory,
  ReliverseMemory,
  UserDataMemory,
} from "./app/utils/schemaMemory";
export { memorySchema } from "./app/utils/schemaMemory";
export type { RepoInfo, ReposConfig } from "./app/utils/schemaTemplate";
export {
  DEFAULT_REPOS_CONFIG,
  generateReposJsonSchema,
  repoInfoSchema,
  reposSchema,
  shouldRegenerateSchema,
} from "./app/utils/schemaTemplate";
export { createSpinner, SimpleSpinner } from "./app/utils/spinner";
export {
  getPkgName,
  getPkgVersion,
  readPackageJSON,
  showEndPrompt,
  showStartPrompt,
} from "./app/utils/startEndPrompts";
export {
  cd,
  getCurrentWorkingDirectory,
  handleError,
  pwd,
  rm,
} from "./app/utils/terminalHelpers";
export { setupDevModeIfNeeded } from "./app/utils/testsRuntime";
export { findTsconfigUp } from "./app/utils/tsconfigHelpers";
export {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
  renameEntryFile,
} from "./app/utils/utils-build";
export { removeDistFolders, removeLogInternalCalls } from "./app/utils/utils-clean";
export { filterDeps } from "./app/utils/utils-deps";
export { determineDistName } from "./app/utils/utils-determine";
export {
  formatError,
  handleDlerError,
  validateDevCwd,
  withWorkingDirectory,
} from "./app/utils/utils-error-cwd";
export {
  copyRootFile,
  deleteSpecificFiles,
  getDirectorySize,
  outDirBinFilesCount,
  readFileSafe,
  validateDirectory,
  writeFileSafe,
} from "./app/utils/utils-fs";
export { createJsrJSON, renameTsxFiles } from "./app/utils/utils-jsr-json";
export { extractPackageName } from "./app/utils/utils-misc";
export {
  library_createJsrConfig,
  library_createPackageJSON,
} from "./app/utils/utils-package-json-libraries";
export { regular_createPackageJSON } from "./app/utils/utils-package-json-regular";
export {
  createPerfTimer,
  getElapsedPerfTime,
  pausePerfTimer,
  resumePerfTimer,
} from "./app/utils/utils-perf";
export {
  ALLOWED_FILE_TYPES,
  checkFileSize,
  checkPermissions,
  handleCtxError,
  sanitizeInput,
  setFileSizeLimits,
  validateContent,
  validateFileExists,
  validateFileType,
  validateMergeOperation,
  validatePath,
  validateTemplate,
} from "./app/utils/utils-security";
export { createProjectTSConfig, createTSConfig } from "./app/utils/utils-tsconfig";
// AUTO-GENERATED AGGREGATOR END
