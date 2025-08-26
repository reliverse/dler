// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export { useORPC } from "./app/add/add-local/api/orpc.js";
export { useTRPC } from "./app/add/add-local/api/trpc.js";
export { useBetterAuth } from "./app/add/add-local/auth/better-auth.js";
export { useClerkAuth } from "./app/add/add-local/auth/clerk-auth.js";
export { useNextAuth } from "./app/add/add-local/auth/next-auth.js";
export { getPromptContent } from "./app/add/add-local/core/prompts.js";
export type { TemplateUpdateInfo } from "./app/add/add-local/core/templates.js";
export {
  checkForTemplateUpdate,
  getTemplateUpdateInfo,
  updateProjectTemplateDate,
} from "./app/add/add-local/core/templates.js";
export type { ShowMenuResult } from "./app/add/add-local/core/types.js";
export { useDrizzleORM } from "./app/add/add-local/db/drizzle.js";
export { usePrismaORM } from "./app/add/add-local/db/prisma.js";
export { useUploadthing } from "./app/add/add-local/files/uploadthing.js";
export { useReactHookForm } from "./app/add/add-local/form/react-hook-form.js";
export { useTanstackForm } from "./app/add/add-local/form/tanstack-form.js";
export { usePlasmoBrowserExtFramework } from "./app/add/add-local/fws/browser/plasmo.js";
export { useWxtBrowserExtFramework } from "./app/add/add-local/fws/browser/wxt.js";
export { useEslintConfig } from "./app/add/add-local/fws/configs/eslint-config.js";
export { useLynxNativeFramework } from "./app/add/add-local/fws/native/lynx.js";
export { useReactNativeFramework } from "./app/add/add-local/fws/native/react.js";
export { useEslintPlugin } from "./app/add/add-local/fws/plugins/eslint-plugin.js";
export { useVscodeExtFramework } from "./app/add/add-local/fws/vscode/vscode-ext.js";
export { useAstroWebFramework } from "./app/add/add-local/fws/web/astro.js";
export { useJStackWebFramework } from "./app/add/add-local/fws/web/jstack.js";
export { useNextJsWebFramework } from "./app/add/add-local/fws/web/next.js";
export { useTanstackStartWebFramework } from "./app/add/add-local/fws/web/start.js";
export { useViteWebFramework } from "./app/add/add-local/fws/web/vite.js";
export { useGtLibs } from "./app/add/add-local/i18n/gt-libs.js";
export { useLanguine } from "./app/add/add-local/i18n/languine.js";
export { useNextIntl } from "./app/add/add-local/i18n/next-intl.js";
export { useVercelAI } from "./app/add/add-local/llm/vercel.js";
export { useResendMail } from "./app/add/add-local/mail/resend.js";
export { usePolarPayments } from "./app/add/add-local/pay/polar.js";
export { useStripePayments } from "./app/add/add-local/pay/stripe.js";
export { useBiomeTool } from "./app/add/add-local/tool/biome.js";
export { useEslintTool } from "./app/add/add-local/tool/eslint.js";
export { useOxlintTool } from "./app/add/add-local/tool/oxlint.js";
export { use21stUI } from "./app/add/add-local/ui/21st.js";
export { useShadcnUI } from "./app/add/add-local/ui/shadcn.js";
export { useTailwindCSS } from "./app/add/add-local/ui/tailwind.js";
export {
  CACHE_ROOT_DIR,
  DEFAULT_BRANCH,
  getRepoCacheDir,
  RULE_FILE_EXTENSION,
  RULES_REPOS,
} from "./app/add/add-rule/add-rule-const.js";
export { handleDirectRules, showRulesMenu } from "./app/add/add-rule/add-rule-impl.js";
export type { RuleRepo, UnghRepoResponse } from "./app/add/add-rule/add-rule-types.js";
export {
  checkForRuleUpdates,
  checkRulesRepoUpdate,
  convertTsToMdc,
  downloadRules,
  handleRuleUpdates,
  hasCursorRulesDir,
  hasInstalledRules,
  installRules,
} from "./app/add/add-rule/add-rule-utils.js";
export { ensureOpenAIKey } from "./app/ai/ai-impl/ai-auth.js";
export { aiChat } from "./app/ai/ai-impl/ai-chat.js";
export {
  AGENT_NAMES,
  CIRCULAR_TRIGGERS,
  EXIT_KEYWORDS,
  MAX_TOKENS,
  MODEL,
  MODEL_NAME,
} from "./app/ai/ai-impl/ai-const.js";
export { aiAgenticTool } from "./app/ai/ai-impl/ai-tools.js";
export type { AIAgentOptions, AiSdkAgent, CircularTrigger } from "./app/ai/ai-impl/ai-types.js";
export { aiCodeCommand } from "./app/ai/ai-impl/code/code-mod.js";
export { handleMcpCommand } from "./app/ai/ai-impl/mcp/mcp-mod.js";
export type { LintSuggestion } from "./app/ai/ai-impl/relinter/relinter.js";
export {
  agentRelinter,
  collectLintableFiles,
  gatherLintSuggestions,
  writeSuggestionsToFile,
} from "./app/ai/ai-impl/relinter/relinter.js";
export { aiMenu } from "./app/ai/ai-menu.js";
export type { CommonIndexConfig, Import } from "./app/better/auth/(generators)/auth-config.js";
export { generateAuthConfig } from "./app/better/auth/(generators)/auth-config.js";
export {
  convertToSnakeCase,
  generateDrizzleSchema,
} from "./app/better/auth/(generators)/drizzle.js";
export { adapters, getGenerator } from "./app/better/auth/(generators)/index.js";
export { generateMigrations } from "./app/better/auth/(generators)/kysely.js";
export { generatePrismaSchema } from "./app/better/auth/(generators)/prisma.js";
export type { SchemaGenerator } from "./app/better/auth/(generators)/types.js";
export {
  addSvelteKitEnvModules,
  filterPrivateEnv,
  filterPublicEnv,
} from "./app/better/auth/(utils)/add-svelte-kit-env-modules.js";
export { checkPackageManagers } from "./app/better/auth/(utils)/check-package-managers.js";
export { formatMilliseconds } from "./app/better/auth/(utils)/format-ms.js";
export { generateSecretHash } from "./app/better/auth/(utils)/generate-secret.js";
export { getConfig, possiblePaths } from "./app/better/auth/(utils)/get-config.js";
export { getPackageInfo } from "./app/better/auth/(utils)/get-package-info.js";
export { getTsconfigInfo, stripJsonComments } from "./app/better/auth/(utils)/get-tsconfig-info.js";
export { configPath, schemaPath } from "./app/better/auth/consts.js";
export type { SupportedDatabases, SupportedPlugin } from "./app/better/auth/init/cmd.js";
export { init, supportedPlugins } from "./app/better/auth/init/cmd.js";
export { migrateAction } from "./app/better/auth/migrate/cmd.js";
export type { LibraryBuildOptions } from "./app/build/build-library.js";
export { library_buildLibrary } from "./app/build/build-library.js";
export { regular_buildJsrDist, regular_buildNpmDist } from "./app/build/build-regular.js";
export { dlerBuild } from "./app/build/impl.js";
export {
  libraries_build,
  libraries_publish,
  library_buildFlow,
  library_pubFlow,
} from "./app/build/library-flow.js";
export { dlerPostBuild, wrapper_CopyNonBuildFiles } from "./app/build/postbuild.js";
export {
  directoryExists,
  executeDlerHooks,
  getPackageManager,
  isCommandAvailable,
} from "./app/build/ppb-utils.js";
export { dlerPreBuild } from "./app/build/prebuild.js";
export { autoPreset, definePreset } from "./app/build/providers/auto.js";
export { unifiedBuild } from "./app/build/providers/build.js";
export type { BunBuildOptions } from "./app/build/providers/bun/single-file.js";
export {
  buildForTarget,
  cleanOutputDir,
  getOutputFileName,
  listAvailableTargets,
  parseTargets,
  validateInputFile,
} from "./app/build/providers/bun/single-file.js";
export { copyBuild } from "./app/build/providers/copy/copy-mod.js";
export { createLoader } from "./app/build/providers/mkdist/mkdist-impl/loader.js";
export { jsLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/js.js";
export {
  defaultLoaders,
  resolveLoader,
  resolveLoaders,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/loaders-mod.js";
export type { PostcssLoaderOptions } from "./app/build/providers/mkdist/mkdist-impl/loaders/postcss.js";
export { postcssLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/postcss.js";
export { sassLoader } from "./app/build/providers/mkdist/mkdist-impl/loaders/sass.js";
export type {
  DefaultBlockLoaderOptions,
  DefineVueLoaderOptions,
  VueBlock,
  VueBlockLoader,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export {
  fallbackVueLoader,
  vueLoader,
} from "./app/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export { mkdist } from "./app/build/providers/mkdist/mkdist-impl/make.js";
export type { DeclarationOutput } from "./app/build/providers/mkdist/mkdist-impl/utils/dts.js";
export {
  augmentWithDiagnostics,
  extractDeclarations,
  getDeclarations,
  normalizeCompilerOptions,
} from "./app/build/providers/mkdist/mkdist-impl/utils/dts.js";
export { copyFileWithStream } from "./app/build/providers/mkdist/mkdist-impl/utils/fs.js";
export { getVueDeclarations } from "./app/build/providers/mkdist/mkdist-impl/utils/vue-dts.js";
export { mkdistBuild } from "./app/build/providers/mkdist/mkdist-mod.js";
export { rollupBuild } from "./app/build/providers/rollup/build.js";
export { getRollupOptions } from "./app/build/providers/rollup/config.js";
export { cjsPlugin, fixCJSExportTypePlugin } from "./app/build/providers/rollup/plugins/cjs.js";
export { esbuild } from "./app/build/providers/rollup/plugins/esbuild.js";
export { JSONPlugin } from "./app/build/providers/rollup/plugins/json.js";
export { rawPlugin } from "./app/build/providers/rollup/plugins/raw.js";
export {
  getShebang,
  makeExecutable,
  removeShebangPlugin,
  shebangPlugin,
} from "./app/build/providers/rollup/plugins/shebang.js";
export { rollupStub } from "./app/build/providers/rollup/stub.js";
export {
  DEFAULT_EXTENSIONS,
  getChunkFilename,
  resolveAliases,
} from "./app/build/providers/rollup/utils.js";
export { rollupWatch } from "./app/build/providers/rollup/watch.js";
export { typesBuild } from "./app/build/providers/untyped/untyped-mod.js";
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
} from "./app/build/providers/utils.js";
export { validateDependencies, validatePackage } from "./app/build/providers/validate.js";
export { regular_buildFlow, regular_pubFlow } from "./app/build/regular-flow.js";
export { useFirecrawl } from "./app/clone/firecrawl/firecrawl-mod.js";
export { runCodemods } from "./app/cmod/cmod-impl.js";
export { getBiomeConfig } from "./app/config/biome.js";
export { injectSectionComments } from "./app/config/comments.js";
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
} from "./app/config/constants.js";
export type { RequiredProjectContent } from "./app/config/content.js";
export { getProjectContent } from "./app/config/content.js";
export { ensureConfigMod } from "./app/config/core.js";
export { getOrCreateRseConfig } from "./app/config/core-cfg.js";
export { createRseConfig, generateRseConfig, writeRseConfig } from "./app/config/create.js";
export { generateDefaultRulesForProject, getDefaultRseConfig } from "./app/config/def-utils.js";
export { PROJECT_FRAMEWORK_FILES } from "./app/config/default-cfg.js";
export {
  detectFeatures,
  detectProject,
  detectProjectFramework,
  detectProjectsWithRseConfig,
  getPackageJson,
  getPackageJsonSafe,
} from "./app/config/detect.js";
export { generateConfigFiles, generateProjectConfigs } from "./app/config/gen-cfg.js";
export { getConfigBunfig, getConfigDler } from "./app/config/load.js";
export { migrateRseConfig } from "./app/config/migrate.js";
export { getRseConfigPath } from "./app/config/path.js";
export type { ConfigKind } from "./app/config/prepare.js";
export { ensureReliverseConfig, prepareReliverseEnvironment } from "./app/config/prepare.js";
export { askRseConfigType } from "./app/config/prompts.js";
export { readRseConfig, readRseTs } from "./app/config/read.js";
export { generateReltypesContent } from "./app/config/reltypes-content.js";
export { checkIfRegenerationNeeded, ensureReltypesFile } from "./app/config/reltypes-utils.js";
export { fixLineByLine, parseAndFixRseConfig, repairAndParseJSON } from "./app/config/repair.js";
export { generateJsonSchema, generateSchemaFile, rseSchema } from "./app/config/schema.js";
export { loadrse, watchrse } from "./app/config/unstable.js";
export { mergeWithDefaults, updateRseConfig } from "./app/config/update.js";
export {
  atomicWriteFile,
  cleanGitHubUrl,
  getBackupAndTempPaths,
  objectToCodeString,
  updateTsConfigInclude,
} from "./app/config/utils.js";
export { resolveCrossLibs } from "./app/conv/cmd.js";
export { db } from "./app/db/client.js";
export { decrypt, encrypt } from "./app/db/config.js";
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
} from "./app/db/messages.js";
export { configKeysTable, userDataTable } from "./app/db/schema.js";
export { envArgImpl } from "./app/env/env-impl.js";
export { default } from "./app/get/cmd.js";
export {
  checkPowerShellVersion,
  installDlerStandalone,
  installFromGitHub,
} from "./app/get/get-impl/get-core.js";
export { showManualBuilderMenu } from "./app/init/init-utils/init-impl.js";
export {
  determineProjectStatus,
  handleExistingProject,
  handleIncompleteProject,
  handleNewProject,
  handleProjectSelectionMenu,
  initMinimalrseProject,
  showExistingProjectMenu,
} from "./app/init/init-utils/init-utils.js";
export { handleOpenProjectMenu } from "./app/init/init-utils/mm-deprecated/editor-menu.js";
export { COLUMN_TYPES } from "./app/init/mm-deprecated/drizzle/manageDrizzleConstants.js";
export { manageDrizzleSchema } from "./app/init/mm-deprecated/drizzle/manageDrizzleSchema.js";
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
} from "./app/init/mm-deprecated/drizzle/manageDrizzleSchemaUtils.js";
export { handleIntegrations } from "./app/init/mm-deprecated/editor-impl.js";
export {
  installIntegration,
  removeIntegration,
  updatePackageJson,
} from "./app/init/mm-deprecated/editor-mod.js";
export { INTEGRATION_CONFIGS } from "./app/init/mm-deprecated/feature-add.js";
export { REMOVAL_CONFIGS } from "./app/init/mm-deprecated/feature-rm.js";
export { manageShadcn } from "./app/init/mm-deprecated/shadcn/shadcn-mod.js";
export {
  handleDependencies,
  handleNextAction,
  handleNextActions,
  initializeProjectConfig,
  setupI18nSupport,
  shouldInstallDependencies,
  showSuccessAndNextSteps,
} from "./app/init/use-template/cp-impl.js";
export { createMobileProject, createWebProject } from "./app/init/use-template/cp-mod.js";
export { showCloneProjectMenu } from "./app/init/use-template/cp-modules/cli-main-modules/cli-menu-items/showCloneProjectMenu.js";
export { showAnykeyPrompt } from "./app/init/use-template/cp-modules/cli-main-modules/modules/showAnykeyPrompt.js";
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
} from "./app/init/use-template/cp-modules/compose-env-file/cef-impl.js";
export type {
  KeyType,
  KnownService,
} from "./app/init/use-template/cp-modules/compose-env-file/cef-keys.js";
export {
  dashboards,
  defaultValues,
  KNOWN_SERVICES,
  keyTypeSchema,
  keyVarsSchema,
  knownServiceSchema,
  serviceKeySchema,
} from "./app/init/use-template/cp-modules/compose-env-file/cef-keys.js";
export { composeEnvFile } from "./app/init/use-template/cp-modules/compose-env-file/cef-mod.js";
export {
  deployProject,
  selectDeploymentService,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/deploy.js";
export {
  configureGithubRepo,
  handleGitInit,
  promptGitDeploy,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/gdp-mod.js";
export {
  createCommit,
  handleGithubRepo,
  initGitDir,
  initializeGitRepo,
  pushGitCommits,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/git.js";
export {
  checkGithubRepoOwnership,
  createGithubRepo,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/github.js";
export { isSpecialDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/domainHelpers.js";
export { ensureDbInitialized } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/handlePkgJsonScripts.js";
export { promptForDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/helpers/promptForDomain.js";
export {
  isDirHasGit,
  setupGitRemote,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-git-github.js";
export {
  archiveExistingRepoContent,
  handleExistingRepoContent,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-private-repo.js";
export { handleExistingRepo } from "./app/init/use-template/cp-modules/git-deploy-prompts/utils-repo-exists.js";
export {
  getVercelEnvVar,
  withRateLimit,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-api.js";
export { checkVercelDeployment } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-check.js";
export type { ConfigurationOptions } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-config.js";
export {
  configureBranchProtection,
  configureResources,
  enableAnalytics,
  getConfigurationOptions,
  updateProject,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-config.js";
export {
  createVercelProject,
  prepareVercelProjectCreation,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-create.js";
export {
  createInitialVercelDeployment,
  monitorDeployment,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-deploy.js";
export { getVercelProjectDomain } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-domain.js";
export { addEnvVarsToVercelProject } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-env.js";
export type { VercelTeam } from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-team.js";
export {
  getPrimaryVercelTeam,
  getVercelTeams,
  verifyTeam,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-team.js";
export type {
  DeploymentLog,
  DeploymentLogType,
  DeploymentOptions,
  EnvVar,
  VercelDeploymentConfig,
  VercelFramework,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-types.js";
export {
  detectFramework,
  getEnvVars,
  saveVercelToken,
  verifyDomain,
} from "./app/init/use-template/cp-modules/git-deploy-prompts/vercel/vercel-utils.js";
export type {
  InjectionLocation,
  InjectionOptions,
  InjectionResult,
  SingleInjection,
} from "./app/inject/inject-impl-mod.js";
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
} from "./app/inject/inject-impl-mod.js";
export { auth, authCheck } from "./app/login/login-impl.js";
export { deleteMemory } from "./app/logout/logout-impl.js";
export type {
  ApplyMagicSpellsOptions,
  ApplyMagicSpellsResult,
  FileWithSpells,
} from "./app/magic/magic-apply.js";
export {
  applyMagicSpells,
  getAllAvailableRegistries,
  getFilesWithMagicSpells,
  processSingleOutputFile,
} from "./app/magic/magic-apply.js";
export type {
  SpellDirective,
  SpellEvaluationContext,
  SpellInfo,
  SpellOutcome,
} from "./app/magic/magic-spells.js";
export { evaluateMagicDirective, getAvailableSpells } from "./app/magic/magic-spells.js";
export { migrateAnythingToBun } from "./app/migrate/codemods/anything-bun.js";
export { commanderToRempts } from "./app/migrate/codemods/commander-rempts.js";
export { consoleToRelinka } from "./app/migrate/codemods/console-relinka.js";
export { migrateFsToRelifso } from "./app/migrate/codemods/fs-relifso.js";
export type {
  CatalogMergeResult,
  DependencyEntry,
  MigrationResult,
} from "./app/migrate/codemods/monorepo-catalog.js";
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
} from "./app/migrate/codemods/monorepo-catalog.js";
export {
  migrateModuleResolution,
  migrateToBundler,
  migrateToNodeNext,
} from "./app/migrate/codemods/nodenext-bundler.js";
export { migratePathToPathkit } from "./app/migrate/codemods/path-pathkit.js";
export { migrateReaddirToGlob } from "./app/migrate/codemods/readdir-glob.js";
export type { GenCfg, GenCfgJsonc } from "./app/mrse/mrse-impl.js";
export {
  downloadFileFromGitHub,
  ensureEnvCacheDir,
  getEnvCacheDir,
  getEnvCachePath,
  logVerbose,
  mrseVerbose,
} from "./app/mrse/mrse-impl.js";
export {
  escapeTemplateString,
  getFileMetadata,
  hashFile,
  readFileForTemplate,
  unescapeTemplateString,
  walkDir,
} from "./app/pack/cmd.js";
export type { DLER_TEMPLATE_NAMES } from "./app/providers/better-t-stack/better-t-stack-mod.js";
export {
  DLER_TEMPLATES,
  dlerTemplatesMap,
} from "./app/providers/better-t-stack/better-t-stack-mod.js";
export type {
  FileMetadata,
  Template,
  TemplatesFileContent,
} from "./app/providers/better-t-stack/better-t-stack-types.js";
export type { AvailableDependencies } from "./app/providers/better-t-stack/constants.js";
export {
  DEFAULT_CONFIG,
  dependencyVersionMap,
  PKG_ROOT,
} from "./app/providers/better-t-stack/constants.js";
export { setupMongoDBAtlas } from "./app/providers/better-t-stack/helpers/database-providers/mongodb-atlas-setup.js";
export { setupNeonPostgres } from "./app/providers/better-t-stack/helpers/database-providers/neon-setup.js";
export { setupPrismaPostgres } from "./app/providers/better-t-stack/helpers/database-providers/prisma-postgres-setup.js";
export { setupSupabase } from "./app/providers/better-t-stack/helpers/database-providers/supabase-setup.js";
export { setupTurso } from "./app/providers/better-t-stack/helpers/database-providers/turso-setup.js";
export { createProject } from "./app/providers/better-t-stack/helpers/project-generation/create-project.js";
export { createReadme } from "./app/providers/better-t-stack/helpers/project-generation/create-readme.js";
export type { EnvVariable } from "./app/providers/better-t-stack/helpers/project-generation/env-setup.js";
export {
  addEnvVariablesToFile,
  setupEnvironmentVariables,
} from "./app/providers/better-t-stack/helpers/project-generation/env-setup.js";
export { displayPostInstallInstructions } from "./app/providers/better-t-stack/helpers/project-generation/post-installation.js";
export {
  initializeGit,
  updatePackageConfigurations,
} from "./app/providers/better-t-stack/helpers/project-generation/project-config.js";
export {
  copyBaseTemplate,
  handleExtras,
  setupAddonsTemplate,
  setupAuthTemplate,
  setupBackendFramework,
  setupDbOrmTemplates,
  setupExamplesTemplate,
  setupFrontendTemplates,
} from "./app/providers/better-t-stack/helpers/project-generation/template-manager.js";
export { setupAddons } from "./app/providers/better-t-stack/helpers/setup/addons-setup.js";
export { setupApi } from "./app/providers/better-t-stack/helpers/setup/api-setup.js";
export {
  generateAuthSecret,
  setupAuth,
} from "./app/providers/better-t-stack/helpers/setup/auth-setup.js";
export { setupBackendDependencies } from "./app/providers/better-t-stack/helpers/setup/backend-setup.js";
export { setupDatabase } from "./app/providers/better-t-stack/helpers/setup/db-setup.js";
export { setupExamples } from "./app/providers/better-t-stack/helpers/setup/examples-setup.js";
export { setupRuntime } from "./app/providers/better-t-stack/helpers/setup/runtime-setup.js";
export { setupStarlight } from "./app/providers/better-t-stack/helpers/setup/starlight-setup.js";
export { setupTauri } from "./app/providers/better-t-stack/helpers/setup/tauri-setup.js";
export { DLER_TPL_ADDONS } from "./app/providers/better-t-stack/packed/addons.js";
export { DLER_TPL_API } from "./app/providers/better-t-stack/packed/api.js";
export { DLER_TPL_AUTH } from "./app/providers/better-t-stack/packed/auth.js";
export { DLER_TPL_BACKEND } from "./app/providers/better-t-stack/packed/backend.js";
export { DLER_TPL_BASE } from "./app/providers/better-t-stack/packed/base.js";
export { DLER_TPL_DB } from "./app/providers/better-t-stack/packed/db.js";
export { DLER_TPL_EXAMPLES } from "./app/providers/better-t-stack/packed/examples.js";
export { DLER_TPL_EXTRAS } from "./app/providers/better-t-stack/packed/extras.js";
export { DLER_TPL_FRONTEND } from "./app/providers/better-t-stack/packed/frontend.js";
export { DLER_TPL_RUNTIME } from "./app/providers/better-t-stack/packed/runtime.js";
export { getAddonsChoice } from "./app/providers/better-t-stack/prompts/addons.js";
export { getApiChoice } from "./app/providers/better-t-stack/prompts/api.js";
export { getAuthChoice } from "./app/providers/better-t-stack/prompts/auth.js";
export { getBackendFrameworkChoice } from "./app/providers/better-t-stack/prompts/backend.js";
export { gatherConfig } from "./app/providers/better-t-stack/prompts/config-prompts.js";
export { getDatabaseChoice } from "./app/providers/better-t-stack/prompts/database.js";
export { getDBSetupChoice } from "./app/providers/better-t-stack/prompts/database-setup.js";
export { getExamplesChoice } from "./app/providers/better-t-stack/prompts/examples.js";
export { getFrontendChoice } from "./app/providers/better-t-stack/prompts/frontend.js";
export { getGitChoice } from "./app/providers/better-t-stack/prompts/git.js";
export { getinstallChoice } from "./app/providers/better-t-stack/prompts/install.js";
export { getORMChoice } from "./app/providers/better-t-stack/prompts/orm.js";
export { getPackageManagerChoice } from "./app/providers/better-t-stack/prompts/package-manager.js";
export { getProjectName } from "./app/providers/better-t-stack/prompts/project-name.js";
export { getRuntimeChoice } from "./app/providers/better-t-stack/prompts/runtime.js";
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
} from "./app/providers/better-t-stack/types.js";
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
} from "./app/providers/better-t-stack/types.js";
export { addPackageDependency } from "./app/providers/better-t-stack/utils/add-package-deps.js";
export { trackProjectCreation } from "./app/providers/better-t-stack/utils/analytics.js";
export { commandExists } from "./app/providers/better-t-stack/utils/command-exists.js";
export { displayConfig } from "./app/providers/better-t-stack/utils/display-config.js";
export { generateReproducibleCommand } from "./app/providers/better-t-stack/utils/generate-reproducible-command.js";
export { getLatestCLIVersion } from "./app/providers/better-t-stack/utils/get-latest-cli-version.js";
export { getPackageExecutionCommand } from "./app/providers/better-t-stack/utils/get-package-execution-command.js";
export { openUrl } from "./app/providers/better-t-stack/utils/open-url.js";
export { renderTitle, TITLE_TEXT } from "./app/providers/better-t-stack/utils/render-title.js";
export type { SponsorEntry } from "./app/providers/better-t-stack/utils/sponsors.js";
export {
  displaySponsors,
  fetchSponsors,
  SPONSORS_JSON_URL,
} from "./app/providers/better-t-stack/utils/sponsors.js";
export { processTemplate } from "./app/providers/better-t-stack/utils/template-processor.js";
export {
  getProvidedFlags,
  processAndValidateFlags,
  validateConfigCompatibility,
} from "./app/providers/better-t-stack/validation.js";
export {
  showNewProjectMenu,
  showOpenProjectMenu,
} from "./app/providers/reliverse-stack/reliverse-stack-mod.js";
export type {
  BrowserRepoOption,
  VSCodeRepoOption,
} from "./app/providers/reliverse-stack/rs-impl.js";
export {
  configureBrowserExtension,
  configureVSCodeExtension,
  optionCreateBrowserExtension,
  optionCreateVSCodeExtension,
  optionCreateWebProject,
} from "./app/providers/reliverse-stack/rs-impl.js";
export { dlerPub } from "./app/pub/impl.js";
export { library_publishLibrary } from "./app/pub/pub-library.js";
export { regular_pubToJsr, regular_pubToNpm } from "./app/pub/pub-regular.js";
export type { ConfigRemdn } from "./app/remdn/cmd.js";
export { scanDirectories } from "./app/remdn/cmd.js";
export { checkDlerConfigHealth } from "./app/rules/reliverse/dler-config-health/dler-config-health.js";
export { checkFileExtensions } from "./app/rules/reliverse/file-extensions/file-extensions.js";
export { analyzeDependencies } from "./app/rules/reliverse/missing-deps/analyzer.js";
export { checkMissingDependencies } from "./app/rules/reliverse/missing-deps/deps-mod.js";
export type {
  DependencyResult,
  FinderOptions,
  MissingDepsFileType,
  PackageJson,
} from "./app/rules/reliverse/missing-deps/deps-types.js";
export {
  findSourceFiles,
  readFile,
  readPackageJson,
} from "./app/rules/reliverse/missing-deps/filesystem.js";
export { formatOutput } from "./app/rules/reliverse/missing-deps/formatter.js";
export {
  extractPackageNames,
  getBuiltinModules,
  getListedDependencies,
  normalizePackageName,
} from "./app/rules/reliverse/missing-deps/parser.js";
export { checkNoDynamicImports } from "./app/rules/reliverse/no-dynamic-imports/no-dynamic-imports.js";
export { checkNoIndexFiles } from "./app/rules/reliverse/no-index-files/no-index-files.js";
export { checkPackageJsonHealth } from "./app/rules/reliverse/package-json-health/package-json-health.js";
export { checkPathExtensions } from "./app/rules/reliverse/path-extensions/path-extensions.js";
export { checkSelfInclude } from "./app/rules/reliverse/self-include/self-include.js";
export { checkTsConfigHealth } from "./app/rules/reliverse/tsconfig-health/tsconfig-health.js";
export type { AllowedFileExtensionsType } from "./app/rules/rules-consts.js";
export {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_IMPORT_EXTENSIONS,
  STRICT_FILE_EXTENSIONS,
  STRICT_IMPORT_EXTENSIONS,
} from "./app/rules/rules-consts.js";
export { displayCheckResults } from "./app/rules/rules-mod.js";
export { getAllFiles, getLineNumber, shouldIgnoreFile } from "./app/rules/rules-utils.js";
export { getAllSourceFiles, splitLargeFileByLines, splitLargeFunctions } from "./app/split/impl.js";
export {
  downloadRepoOption,
  rmTestsRuntime,
  showDevToolsMenu,
} from "./app/toolbox/toolbox-impl.js";
export { openVercelTools } from "./app/toolbox/toolbox-vercel.js";
export type {
  BundleSource,
  IndentOptions,
  MagicStringOptions,
  OverwriteOptions,
  StringTransformer,
  TransformResult,
  UpdateOptions,
} from "./app/transform/transform-impl-mod.js";
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
} from "./app/transform/transform-impl-mod.js";
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
  BumpMode,
  BundlerName,
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
  DlerConfig,
  Esbuild,
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
  LibConfig,
  Loader,
  LoaderContext,
  LoaderResult,
  LoadFile,
  LogLevel,
  LogLevelConfig,
  LogLevelsConfig,
  MkdistBuildEntry,
  MkdistHooks,
  MkdistOptions,
  ModernReplacement,
  MonorepoType,
  NavItem,
  NavItemWithChildren,
  NavigationEntry,
  NpmOutExt,
  OutputFile,
  ParamsOmitReli,
  ParamsOmitSkipPN,
  PerfTimer,
  PrismaField,
  PrismaModel,
  ProjectArchitecture,
  ProjectCategory,
  ProjectConfigReturn,
  ProjectFramework,
  ProjectSelectionResult,
  ProjectSubcategory,
  RelinkaDirsConfig,
  RelinterConfirm,
  RemovalConfig,
  RollupBuildEntry,
  RollupBuildOptions,
  RollupHooks,
  RollupOptions,
  RseConfig,
  RulesCheckOptions,
  ShadcnConfig,
  Sourcemap,
  SubOption,
  TableSchema,
  Theme,
  transpileFormat,
  transpileTarget,
  UnifiedBuildConfig,
  UntypedBuildEntry,
  UntypedHooks,
  UntypedOutput,
  UntypedOutputs,
  VSCodeSettings,
} from "./app/types/mod.js";
export { DEFAULT_CONFIG_RELIVERSE, defineConfig } from "./app/types/mod.js";
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
} from "./app/update/impl.js";
export type {
  DependencyInfo,
  PackageCheckOptions,
  UpdateResult,
  UpgradeResult,
} from "./app/update/utils.js";
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
} from "./app/update/utils.js";
export type { UploadFile, UploadResult } from "./app/upload/providers/providers-mod.js";
export {
  readFilesFromPaths,
  uploadToProvider,
} from "./app/upload/providers/providers-mod.js";
export type { UploadedUCFile } from "./app/upload/providers/uploadcare.js";
export { uploadToUploadcare } from "./app/upload/providers/uploadcare.js";
export type { UploadedFile } from "./app/upload/providers/uploadthing.js";
export { uploadToUploadthing } from "./app/upload/providers/uploadthing.js";
export { formatBytes } from "./app/upload/upload-utils.js";
export { promptAggCommand } from "./app/utils/agg/agg-1.js";
export { useAggregator } from "./app/utils/agg/agg-2.js";
export {
  buildPathRelative,
  collectFiles,
  generateAggregatorLines,
  getNamedExports,
  guessStarImportIdentifier,
  printUsage,
} from "./app/utils/agg/agg-3.js";
export { fileExists, findMainEntryFile } from "./app/utils/agg/agg-4.js";
export { isAggregationDisabled } from "./app/utils/agg/agg-5.js";
export { BINARY_EXTS, BINARY_SET } from "./app/utils/b-exts.js";
export { experimental, recommended } from "./app/utils/badgeNotifiers.js";
export { isBinaryExt } from "./app/utils/binary.js";
export { convertCjsToEsm } from "./app/utils/codemods/convertCjsToEsm.js";
export {
  convertDatabaseProvider,
  convertPrismaToDrizzle,
} from "./app/utils/codemods/convertDatabase.js";
export { convertTypeDefinitions } from "./app/utils/codemods/convertDefinitions.js";
export { convertImportStyle } from "./app/utils/codemods/convertImportStyle.js";
export { convertJsToTs } from "./app/utils/codemods/convertJsToTs.js";
export { convertQuoteStyle } from "./app/utils/codemods/convertQuoteStyle.js";
export { convertRuntime } from "./app/utils/codemods/convertRuntime.js";
export { convertToMonorepo } from "./app/utils/codemods/convertToMonorepo.js";
export { removeComments } from "./app/utils/codemods/removeComments.js";
export { getUnusedDependencies } from "./app/utils/codemods/removeUnusedDeps.js";
export { replaceImportSymbol } from "./app/utils/codemods/replaceImportSymbol.js";
export { replaceWithModern } from "./app/utils/codemods/replaceWithModern.js";
export type { CommentMapping, CommentStyle, FileExtension } from "./app/utils/comments.js";
export { COMMENT_MAP, DEFAULT_COMMENT, getCommentPrefix } from "./app/utils/comments.js";
export { createPackageJSON } from "./app/utils/createPackageJSON.js";
export { decide } from "./app/utils/decideHelper.js";
export type {
  DetectionSource,
  DetectOptions,
  PkgManagerInfo,
} from "./app/utils/dependencies/getUserPkgManager.js";
export {
  getAllPkgManagers,
  getUserPkgManager,
} from "./app/utils/dependencies/getUserPkgManager.js";
export { setupI18nFiles } from "./app/utils/downloading/downloadI18nFiles.js";
export type { DownloadResult } from "./app/utils/downloading/downloadRepo.js";
export { downloadRepo } from "./app/utils/downloading/downloadRepo.js";
export { handleDownload } from "./app/utils/downloading/handleDownload.js";
export {
  hookChildProcess,
  notFoundError,
  verifyENOENT,
  verifyENOENTSync,
} from "./app/utils/exec/exec-enoent.js";
export type { EnvLike, EnvPathInfo } from "./app/utils/exec/exec-env.js";
export { computeEnv } from "./app/utils/exec/exec-env.js";
export { NonZeroExitError } from "./app/utils/exec/exec-error.js";
export { escapeArgument, escapeCommand } from "./app/utils/exec/exec-escape.js";
export type {
  KillSignal,
  Options,
  Output,
  OutputApi,
  PipeOptions,
  Result,
  XExec,
} from "./app/utils/exec/exec-mod.js";
export { ExecProcess, exec, x } from "./app/utils/exec/exec-mod.js";
export { parse } from "./app/utils/exec/exec-parse.js";
export { resolveCommand } from "./app/utils/exec/exec-resolve.js";
export { readShebang } from "./app/utils/exec/exec-shebang.js";
export { spawn, spawnSync } from "./app/utils/exec/exec-spawn.js";
export { combineStreams, waitForEvent } from "./app/utils/exec/exec-stream.js";
export type { ExecParseResult } from "./app/utils/exec/exec-types.js";
export { _parse } from "./app/utils/exec/exec-types.js";
export {
  detectBufferType,
  detectFileType,
  detectStreamType,
  getMimeType,
  isBinary,
} from "./app/utils/file-type.js";
export { finalizeBuild, finalizePub } from "./app/utils/finalize.js";
export { prepareCLIFiles, safeRename } from "./app/utils/fs-rename.js";
export { getEffectiveDir } from "./app/utils/getEffectiveDir.js";
export { pm, pmx } from "./app/utils/getPackageManager.js";
export { uninstallDependencies } from "./app/utils/handlers/dependencies.js";
export { handleCleanup } from "./app/utils/handlers/handleCleanup.js";
export { handleCodemods } from "./app/utils/handlers/handleCodemods.js";
export { isVSCodeInstalled } from "./app/utils/handlers/isAppInstalled.js";
export type { ScriptStatus } from "./app/utils/handlers/promptPackageJsonScripts.js";
export { promptPackageJsonScripts } from "./app/utils/handlers/promptPackageJsonScripts.js";
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
} from "./app/utils/handlers/shadcn.js";
export { hasOnlyRse } from "./app/utils/hasOnlyRseConfig.js";
export {
  CONTENT_CREATE_MODES,
  DEST_FILE_EXISTS_BEHAVIOURS,
  FILE_TYPES,
  INIT_BEHAVIOURS,
} from "./app/utils/init/init-const.js";
export {
  createFileFromScratch,
  escapeMarkdownCodeBlocks,
  initFile,
  initFiles,
} from "./app/utils/init/init-impl.js";
export { gitignoreTemplate, licenseTemplate, readmeTemplate } from "./app/utils/init/init-tmpl.js";
export type {
  DestFileExistsBehaviour,
  FileType,
  InitBehaviour,
  InitFileOptions,
  InitFileRequest,
  InitFileResult,
  ReinitUserConfig,
} from "./app/utils/init/init-types.js";
export type { InstanceGithub } from "./app/utils/instanceGithub.js";
export {
  ensureGithubToken,
  initGithubSDK,
  OctokitWithRest,
  octokitUserAgent,
} from "./app/utils/instanceGithub.js";
export type { InstanceVercel } from "./app/utils/instanceVercel.js";
export { askVercelToken, initVercelSDK } from "./app/utils/instanceVercel.js";
export { getMaxHeightSize, sleep } from "./app/utils/microHelpers.js";
export { hasConfigFiles, isMrseProject } from "./app/utils/mrseHelpers.js";
export { checkScriptExists } from "./app/utils/pkgJsonHelpers.js";
export {
  addDependency,
  addDevDependency,
  dedupeDependencies,
  ensureDependencyInstalled,
  installDependencies,
  removeDependency,
  runScript,
  updateDependencies,
} from "./app/utils/pm/pm-api.js";
export type { CatalogStructure } from "./app/utils/pm/pm-catalog.js";
export {
  addToCatalog,
  getCatalogReference,
  getCatalogStructure,
  isCatalogSupported,
  listCatalogs,
  removeFromCatalog,
  updateCatalogs,
} from "./app/utils/pm/pm-catalog.js";
export { detectPackageManager, packageManagers } from "./app/utils/pm/pm-detect.js";
export {
  latestVersion,
  PackageNotFoundError,
  pmPackageJson,
  VersionNotFoundError,
} from "./app/utils/pm/pm-meta.js";
export { findup, parsePackageManagerField } from "./app/utils/pm/pm-parse.js";
export type {
  DetectPackageManagerOptions,
  OperationOptions,
  PackageManager,
  PackageManagerName,
} from "./app/utils/pm/pm-types.js";
export {
  doesDependencyExist,
  executeCommand,
  getWorkspaceArgs,
  NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG,
  resolveOperationOptions,
} from "./app/utils/pm/pm-utils.js";
export type {
  CategoryFromSchema,
  CloneOrTemplateRepo,
  RepoFromSchema,
  RepoOption,
} from "./app/utils/projectRepository.js";
export {
  getRepoInfo,
  REPO_TEMPLATES,
  saveRepoToDevice,
  TEMP_BROWSER_TEMPLATE_OPTIONS,
  TEMP_FULLSTACK_WEBSITE_TEMPLATE_OPTIONS,
  TEMP_SEPARATED_WEBSITE_TEMPLATE_OPTIONS,
  TEMP_VSCODE_TEMPLATE_OPTIONS,
} from "./app/utils/projectRepository.js";
export { askAppOrLib } from "./app/utils/prompts/askAppOrLib.js";
export { askInstallDeps } from "./app/utils/prompts/askInstallDeps.js";
export { askOpenInIDE } from "./app/utils/prompts/askOpenInIDE.js";
export { askProjectName } from "./app/utils/prompts/askProjectName.js";
export { askUsernameFrontend } from "./app/utils/prompts/askUsernameFrontend.js";
export { askUsernameGithub } from "./app/utils/prompts/askUsernameGithub.js";
export { shouldInitGit } from "./app/utils/prompts/shouldInitGit.js";
export { getOrCreateReliverseMemory, updateReliverseMemory } from "./app/utils/reliverseMemory.js";
export type { ReplaceConfig } from "./app/utils/replacements/reps-impl.js";
export { extractRepoInfo, replaceStringsInFiles } from "./app/utils/replacements/reps-impl.js";
export type { Hardcoded, UrlPatterns } from "./app/utils/replacements/reps-keys.js";
export {
  CommonPatterns,
  HardcodedStrings,
  hardcodedSchema,
  urlPatternsSchema,
} from "./app/utils/replacements/reps-keys.js";
export { handleReplacements } from "./app/utils/replacements/reps-mod.js";
export { resolveAllCrossLibs } from "./app/utils/resolve-cross-libs.js";
export type {
  EncryptedDataMemory,
  ReliverseMemory,
  UserDataMemory,
} from "./app/utils/schemaMemory.js";
export { memorySchema } from "./app/utils/schemaMemory.js";
export type { RepoInfo, ReposConfig } from "./app/utils/schemaTemplate.js";
export {
  DEFAULT_REPOS_CONFIG,
  generateReposJsonSchema,
  repoInfoSchema,
  reposSchema,
  shouldRegenerateSchema,
} from "./app/utils/schemaTemplate.js";
export { createSpinner, SimpleSpinner } from "./app/utils/spinner.js";
export {
  getPkgName,
  getPkgVersion,
  readPackageJSON,
  showEndPrompt,
  showStartPrompt,
} from "./app/utils/startEndPrompts.js";
export {
  cd,
  getCurrentWorkingDirectory,
  handleError,
  pwd,
  rm,
} from "./app/utils/terminalHelpers.js";
export { setupDevModeIfNeeded } from "./app/utils/testsRuntime.js";
export { findTsconfigUp } from "./app/utils/tsconfigHelpers.js";
export {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
  renameEntryFile,
} from "./app/utils/utils-build.js";
export { removeDistFolders, removeLogInternalCalls } from "./app/utils/utils-clean.js";
export { filterDeps } from "./app/utils/utils-deps.js";
export { determineDistName } from "./app/utils/utils-determine.js";
export {
  formatError,
  handleDlerError,
  validateDevCwd,
  withWorkingDirectory,
} from "./app/utils/utils-error-cwd.js";
export {
  copyRootFile,
  deleteSpecificFiles,
  getDirectorySize,
  outDirBinFilesCount,
  readFileSafe,
  validateDirectory,
  writeFileSafe,
} from "./app/utils/utils-fs.js";
export { createJsrJSON, renameTsxFiles } from "./app/utils/utils-jsr-json.js";
export { extractPackageName } from "./app/utils/utils-misc.js";
export {
  library_createJsrConfig,
  library_createPackageJSON,
} from "./app/utils/utils-package-json-libraries.js";
export { regular_createPackageJSON } from "./app/utils/utils-package-json-regular.js";
export {
  createPerfTimer,
  getElapsedPerfTime,
  pausePerfTimer,
  resumePerfTimer,
} from "./app/utils/utils-perf.js";
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
} from "./app/utils/utils-security.js";
export { createProjectTSConfig, createTSConfig } from "./app/utils/utils-tsconfig.js";
// AUTO-GENERATED AGGREGATOR END
