export * from "@reliverse/pathkit";
export * from "@reliverse/relico";
export * from "@reliverse/relifso";
export * from "@reliverse/relinka";
export * from "@reliverse/rempts";
export * from "@reliverse/runtime";

// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export type { LibraryBuildOptions } from "./sdk-impl/build/build-library.js";
export { library_buildLibrary } from "./sdk-impl/build/build-library.js";
export { regular_buildJsrDist, regular_buildNpmDist } from "./sdk-impl/build/build-regular.js";
export { autoPreset, definePreset } from "./sdk-impl/build/providers/auto.js";
export { unifiedBuild } from "./sdk-impl/build/providers/build.js";
export type { BunBuildOptions } from "./sdk-impl/build/providers/bun/single-file.js";
export {
  buildForTarget,
  cleanOutputDir,
  getOutputFileName,
  listAvailableTargets,
  parseTargets,
  validateInputFile,
} from "./sdk-impl/build/providers/bun/single-file.js";
export { copyBuild } from "./sdk-impl/build/providers/copy/copy-mod.js";
export { createLoader } from "./sdk-impl/build/providers/mkdist/mkdist-impl/loader.js";
export { jsLoader } from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/js.js";
export {
  defaultLoaders,
  resolveLoader,
  resolveLoaders,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/loaders-mod.js";
export type { PostcssLoaderOptions } from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/postcss.js";
export { postcssLoader } from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/postcss.js";
export { sassLoader } from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/sass.js";
export type {
  DefaultBlockLoaderOptions,
  DefineVueLoaderOptions,
  VueBlock,
  VueBlockLoader,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export {
  fallbackVueLoader,
  vueLoader,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export { mkdist } from "./sdk-impl/build/providers/mkdist/mkdist-impl/make.js";
export type { DeclarationOutput } from "./sdk-impl/build/providers/mkdist/mkdist-impl/utils/dts.js";
export {
  augmentWithDiagnostics,
  extractDeclarations,
  getDeclarations,
  normalizeCompilerOptions,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/utils/dts.js";
export { copyFileWithStream } from "./sdk-impl/build/providers/mkdist/mkdist-impl/utils/fs.js";
export { getVueDeclarations } from "./sdk-impl/build/providers/mkdist/mkdist-impl/utils/vue-dts.js";
export { mkdistBuild } from "./sdk-impl/build/providers/mkdist/mkdist-mod.js";
export { rollupBuild } from "./sdk-impl/build/providers/rollup/build.js";
export { getRollupOptions } from "./sdk-impl/build/providers/rollup/config.js";
export {
  cjsPlugin,
  fixCJSExportTypePlugin,
} from "./sdk-impl/build/providers/rollup/plugins/cjs.js";
export { esbuild } from "./sdk-impl/build/providers/rollup/plugins/esbuild.js";
export { JSONPlugin } from "./sdk-impl/build/providers/rollup/plugins/json.js";
export { rawPlugin } from "./sdk-impl/build/providers/rollup/plugins/raw.js";
export {
  getShebang,
  makeExecutable,
  removeShebangPlugin,
  shebangPlugin,
} from "./sdk-impl/build/providers/rollup/plugins/shebang.js";
export { rollupStub } from "./sdk-impl/build/providers/rollup/stub.js";
export {
  DEFAULT_EXTENSIONS,
  getChunkFilename,
  resolveAliases,
} from "./sdk-impl/build/providers/rollup/utils.js";
export { rollupWatch } from "./sdk-impl/build/providers/rollup/watch.js";
export { typesBuild } from "./sdk-impl/build/providers/untyped/untyped-mod.js";
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
} from "./sdk-impl/build/providers/utils.js";
export { validateDependencies, validatePackage } from "./sdk-impl/build/providers/validate.js";
export type {
  InjectionLocation,
  InjectionOptions,
  InjectionResult,
  SingleInjection,
} from "./sdk-impl/cmds/inject/inject-impl-mod.js";
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
} from "./sdk-impl/cmds/inject/inject-impl-mod.js";
export type {
  BundleSource,
  IndentOptions,
  MagicStringOptions,
  OverwriteOptions,
  StringTransformer,
  TransformResult,
  UpdateOptions,
} from "./sdk-impl/cmds/transform/transform-impl-mod.js";
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
} from "./sdk-impl/cmds/transform/transform-impl-mod.js";
export { ensureConfigMod } from "./sdk-impl/config/core.js";
export { DEFAULT_CONFIG_DLER, defineConfig } from "./sdk-impl/config/default.js";
export { showEndPrompt, showStartPrompt } from "./sdk-impl/config/info.js";
export { getConfigBunfig, getConfigDler } from "./sdk-impl/config/load.js";
export { ensureDlerConfig, prepareDlerEnvironment } from "./sdk-impl/config/prepare.js";
export type {
  BumpMode,
  BundlerName,
  DlerConfig,
  Esbuild,
  LibConfig,
  LogLevel,
  LogLevelConfig,
  LogLevelsConfig,
  NpmOutExt,
  RelinkaConfig,
  RelinkaDirsConfig,
  Sourcemap,
  transpileFormat,
  transpileTarget,
} from "./sdk-impl/config/types.js";
export { IGNORE_PATTERNS } from "./sdk-impl/constants.js";
export {
  libraries_build,
  libraries_publish,
  library_buildFlow,
  library_pubFlow,
} from "./sdk-impl/library-flow.js";
export type {
  ApplyMagicSpellsOptions,
  ApplyMagicSpellsResult,
  FileWithSpells,
} from "./sdk-impl/magic/magic-apply.js";
export {
  applyMagicSpells,
  getAllAvailableRegistries,
  getFilesWithMagicSpells,
  processSingleOutputFile,
} from "./sdk-impl/magic/magic-apply.js";
export type {
  SpellDirective,
  SpellEvaluationContext,
  SpellInfo,
  SpellOutcome,
} from "./sdk-impl/magic/magic-spells.js";
export { evaluateMagicDirective, getAvailableSpells } from "./sdk-impl/magic/magic-spells.js";
export { library_publishLibrary } from "./sdk-impl/pub/pub-library.js";
export { regular_pubToJsr, regular_pubToNpm } from "./sdk-impl/pub/pub-regular.js";
export { regular_buildFlow, regular_pubFlow } from "./sdk-impl/regular-flow.js";
export { checkDlerConfigHealth } from "./sdk-impl/rules/reliverse/dler-config-health/dler-config-health.js";
export { checkFileExtensions } from "./sdk-impl/rules/reliverse/file-extensions/file-extensions.js";
export { analyzeDependencies } from "./sdk-impl/rules/reliverse/missing-deps/analyzer.js";
export { checkMissingDependencies } from "./sdk-impl/rules/reliverse/missing-deps/deps-mod.js";
export type {
  DependencyResult,
  FinderOptions,
  MissingDepsFileType,
  PackageJson,
} from "./sdk-impl/rules/reliverse/missing-deps/deps-types.js";
export {
  findSourceFiles,
  readFile,
  readPackageJson,
} from "./sdk-impl/rules/reliverse/missing-deps/filesystem.js";
export { formatOutput } from "./sdk-impl/rules/reliverse/missing-deps/formatter.js";
export {
  extractPackageNames,
  getBuiltinModules,
  getListedDependencies,
  normalizePackageName,
} from "./sdk-impl/rules/reliverse/missing-deps/parser.js";
export { checkNoDynamicImports } from "./sdk-impl/rules/reliverse/no-dynamic-imports/no-dynamic-imports.js";
export { checkNoIndexFiles } from "./sdk-impl/rules/reliverse/no-index-files/no-index-files.js";
export { checkPackageJsonHealth } from "./sdk-impl/rules/reliverse/package-json-health/package-json-health.js";
export { checkPathExtensions } from "./sdk-impl/rules/reliverse/path-extensions/path-extensions.js";
export { checkSelfInclude } from "./sdk-impl/rules/reliverse/self-include/self-include.js";
export { checkTsConfigHealth } from "./sdk-impl/rules/reliverse/tsconfig-health/tsconfig-health.js";
export type { AllowedFileExtensionsType } from "./sdk-impl/rules/rules-consts.js";
export {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_IMPORT_EXTENSIONS,
  STRICT_FILE_EXTENSIONS,
  STRICT_IMPORT_EXTENSIONS,
} from "./sdk-impl/rules/rules-consts.js";
export { displayCheckResults } from "./sdk-impl/rules/rules-mod.js";
export { getAllFiles, getLineNumber, shouldIgnoreFile } from "./sdk-impl/rules/rules-utils.js";
export type {
  BaseBuildEntry,
  BuildContext,
  BuildEntry,
  BuildHooks,
  BuildOptions,
  BuildPreset,
  CheckIssue,
  CheckResult,
  CopyBuildEntry,
  CopyHooks,
  CreateLoaderOptions,
  DirectoryType,
  DistDirs,
  DistDirsAll,
  EsbuildOptions,
  InputFile,
  Loader,
  LoaderContext,
  LoaderResult,
  LoadFile,
  MkdistBuildEntry,
  MkdistHooks,
  MkdistOptions,
  OutputFile,
  PerfTimer,
  RollupBuildEntry,
  RollupBuildOptions,
  RollupHooks,
  RollupOptions,
  RulesCheckOptions,
  UnifiedBuildConfig,
  UntypedBuildEntry,
  UntypedHooks,
  UntypedOutput,
  UntypedOutputs,
} from "./sdk-impl/sdk-types.js";
export { promptAggCommand } from "./sdk-impl/utils/agg/agg-1.js";
export { useAggregator } from "./sdk-impl/utils/agg/agg-2.js";
export {
  buildPathRelative,
  collectFiles,
  generateAggregatorLines,
  getNamedExports,
  guessStarImportIdentifier,
  printUsage,
} from "./sdk-impl/utils/agg/agg-3.js";
export { fileExists, findMainEntryFile } from "./sdk-impl/utils/agg/agg-4.js";
export { isAggregationDisabled } from "./sdk-impl/utils/agg/agg-5.js";
export { BINARY_EXTS, BINARY_SET } from "./sdk-impl/utils/b-exts.js";
export { isBinaryExt } from "./sdk-impl/utils/binary.js";
export type { CommentMapping, CommentStyle, FileExtension } from "./sdk-impl/utils/comments.js";
export { COMMENT_MAP, DEFAULT_COMMENT, getCommentPrefix } from "./sdk-impl/utils/comments.js";
export {
  hookChildProcess,
  notFoundError,
  verifyENOENT,
  verifyENOENTSync,
} from "./sdk-impl/utils/exec/exec-enoent.js";
export type { EnvLike, EnvPathInfo } from "./sdk-impl/utils/exec/exec-env.js";
export { computeEnv } from "./sdk-impl/utils/exec/exec-env.js";
export { NonZeroExitError } from "./sdk-impl/utils/exec/exec-error.js";
export { escapeArgument, escapeCommand } from "./sdk-impl/utils/exec/exec-escape.js";
export type {
  KillSignal,
  Options,
  Output,
  OutputApi,
  PipeOptions,
  Result,
  XExec,
} from "./sdk-impl/utils/exec/exec-mod.js";
export { ExecProcess, exec, x } from "./sdk-impl/utils/exec/exec-mod.js";
export { parse } from "./sdk-impl/utils/exec/exec-parse.js";
export { resolveCommand } from "./sdk-impl/utils/exec/exec-resolve.js";
export { readShebang } from "./sdk-impl/utils/exec/exec-shebang.js";
export { spawn, spawnSync } from "./sdk-impl/utils/exec/exec-spawn.js";
export { combineStreams, waitForEvent } from "./sdk-impl/utils/exec/exec-stream.js";
export type { ExecParseResult } from "./sdk-impl/utils/exec/exec-types.js";
export { _parse } from "./sdk-impl/utils/exec/exec-types.js";
export {
  detectBufferType,
  detectFileType,
  detectStreamType,
  getMimeType,
  isBinary,
} from "./sdk-impl/utils/file-type.js";
export { finalizeBuild, finalizePub } from "./sdk-impl/utils/finalize.js";
export { prepareCLIFiles, safeRename } from "./sdk-impl/utils/fs-rename.js";
export {
  CONTENT_CREATE_MODES,
  DEST_FILE_EXISTS_BEHAVIOURS,
  FILE_TYPES,
  INIT_BEHAVIOURS,
} from "./sdk-impl/utils/init/init-const.js";
export {
  createFileFromScratch,
  escapeMarkdownCodeBlocks,
  initFile,
  initFiles,
} from "./sdk-impl/utils/init/init-impl.js";
export {
  gitignoreTemplate,
  licenseTemplate,
  readmeTemplate,
} from "./sdk-impl/utils/init/init-tmpl.js";
export type {
  DestFileExistsBehaviour,
  FileType,
  InitBehaviour,
  InitFileOptions,
  InitFileRequest,
  InitFileResult,
  ReinitUserConfig,
} from "./sdk-impl/utils/init/init-types.js";
export {
  addDependency,
  addDevDependency,
  dedupeDependencies,
  ensureDependencyInstalled,
  installDependencies,
  removeDependency,
  runScript,
  updateDependencies,
} from "./sdk-impl/utils/pm/pm-api.js";
export { detectPackageManager, packageManagers } from "./sdk-impl/utils/pm/pm-detect.js";
export {
  latestVersion,
  PackageNotFoundError,
  pmPackageJson,
  VersionNotFoundError,
} from "./sdk-impl/utils/pm/pm-meta.js";
export { findup, parsePackageManagerField } from "./sdk-impl/utils/pm/pm-parse.js";
export type {
  DetectPackageManagerOptions,
  OperationOptions,
  PackageManager,
  PackageManagerName,
} from "./sdk-impl/utils/pm/pm-types.js";
export {
  doesDependencyExist,
  executeCommand,
  getWorkspaceArgs,
  NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG,
  resolveOperationOptions,
} from "./sdk-impl/utils/pm/pm-utils.js";
export { resolveAllCrossLibs } from "./sdk-impl/utils/resolve-cross-libs.js";
export { createSpinner, SimpleSpinner } from "./sdk-impl/utils/spinner.js";
export {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
  renameEntryFile,
} from "./sdk-impl/utils/utils-build.js";
export { removeDistFolders, removeLogInternalCalls } from "./sdk-impl/utils/utils-clean.js";
export {
  CONCURRENCY_DEFAULT,
  cliDomainDocs,
  PROJECT_ROOT,
  SHOW_VERBOSE,
  tsconfigJson,
  validExtensions,
} from "./sdk-impl/utils/utils-consts.js";
export { filterDeps } from "./sdk-impl/utils/utils-deps.js";
export { determineDistName } from "./sdk-impl/utils/utils-determine.js";
export {
  formatError,
  handleDlerError,
  validateDevCwd,
  withWorkingDirectory,
} from "./sdk-impl/utils/utils-error-cwd.js";
export {
  copyRootFile,
  deleteSpecificFiles,
  getDirectorySize,
  outDirBinFilesCount,
  readFileSafe,
  validateDirectory,
  writeFileSafe,
} from "./sdk-impl/utils/utils-fs.js";
export { createJsrJSON, renameTsxFiles } from "./sdk-impl/utils/utils-jsr-json.js";
export { extractPackageName } from "./sdk-impl/utils/utils-misc.js";
export {
  library_createJsrConfig,
  library_createPackageJSON,
} from "./sdk-impl/utils/utils-package-json-libraries.js";
export { regular_createPackageJSON } from "./sdk-impl/utils/utils-package-json-regular.js";
export {
  createPerfTimer,
  getElapsedPerfTime,
  pausePerfTimer,
  resumePerfTimer,
} from "./sdk-impl/utils/utils-perf.js";
export {
  ALLOWED_FILE_TYPES,
  checkFileSize,
  checkPermissions,
  handleError,
  sanitizeInput,
  setFileSizeLimits,
  validateContent,
  validateFileExists,
  validateFileType,
  validateMergeOperation,
  validatePath,
  validateTemplate,
} from "./sdk-impl/utils/utils-security.js";
export { createTSConfig } from "./sdk-impl/utils/utils-tsconfig.js";
// AUTO-GENERATED AGGREGATOR END
