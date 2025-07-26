// AUTO-GENERATED AGGREGATOR START (via `dler agg`)
export type { LibraryBuildOptions } from "./sdk-impl/build/build-library.js";
export { library_buildLibrary } from "./sdk-impl/build/build-library.js";
export { regular_buildJsrDist, regular_buildNpmDist } from "./sdk-impl/build/build-regular.js";
export { definePreset, autoPreset } from "./sdk-impl/build/providers/auto.js";
export { unifiedBuild } from "./sdk-impl/build/providers/build.js";
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
  DefineVueLoaderOptions,
  VueBlock,
  VueBlockLoader,
  DefaultBlockLoaderOptions,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export {
  fallbackVueLoader,
  vueLoader,
} from "./sdk-impl/build/providers/mkdist/mkdist-impl/loaders/vue.js";
export { mkdist } from "./sdk-impl/build/providers/mkdist/mkdist-impl/make.js";
export type { DeclarationOutput } from "./sdk-impl/build/providers/mkdist/mkdist-impl/utils/dts.js";
export {
  normalizeCompilerOptions,
  getDeclarations,
  extractDeclarations,
  augmentWithDiagnostics,
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
export {
  validateDependencies,
  validatePackage,
} from "./sdk-impl/build/providers/validate.js";
export type {
  InjectionLocation,
  SingleInjection,
  InjectionResult,
  InjectionOptions,
} from "./sdk-impl/cmds/inject/inject-impl-mod.js";
export {
  injectAtLocation,
  injectMultiple,
  createInjection,
  validateInjection,
  validateMultipleInjections,
  previewInjection,
  previewMultipleInjections,
  previewRevert,
  previewMultipleReverts,
} from "./sdk-impl/cmds/inject/inject-impl-mod.js";
export type {
  MagicStringOptions,
  UpdateOptions,
  OverwriteOptions,
  IndentOptions,
  StringTransformer,
  TransformResult,
  BundleSource,
} from "./sdk-impl/cmds/transform/transform-impl-mod.js";
export {
  createTransformerFromMagicString,
  createTransformer,
  update,
  overwrite,
  append,
  prepend,
  remove,
  replace,
  replaceAll,
  indent,
  trim,
  pipe,
  wrapWith,
  insertAt,
  slice,
  template,
  readAndTransform,
  transformAndWrite,
  transformMultiple,
  createBundle,
  compose,
} from "./sdk-impl/cmds/transform/transform-impl-mod.js";
export { DEFAULT_CONFIG_DLER, defineConfig } from "./sdk-impl/config/default.js";
export { showStartPrompt, showEndPrompt } from "./sdk-impl/config/info.js";
export { ensureDlerConfig } from "./sdk-impl/config/prepare.js";
export { getConfigDler } from "./sdk-impl/config/load.js";
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
} from "./sdk-impl/config/types.js";
export { IGNORE_PATTERNS } from "./sdk-impl/constants.js";
export {
  library_buildFlow,
  library_pubFlow,
  libraries_build,
  libraries_publish,
} from "./sdk-impl/library-flow.js";
export type {
  ApplyMagicSpellsOptions,
  ApplyMagicSpellsResult,
  FileWithSpells,
} from "./sdk-impl/magic/magic-apply.js";
export {
  applyMagicSpells,
  processSingleOutputFile,
  getAllAvailableRegistries,
  getFilesWithMagicSpells,
} from "./sdk-impl/magic/magic-apply.js";
export type {
  SpellEvaluationContext,
  SpellOutcome,
  SpellDirective,
  SpellInfo,
} from "./sdk-impl/magic/magic-spells.js";
export { getAvailableSpells, evaluateMagicDirective } from "./sdk-impl/magic/magic-spells.js";
export { library_publishLibrary } from "./sdk-impl/pub/pub-library.js";
export { regular_pubToJsr, regular_pubToNpm } from "./sdk-impl/pub/pub-regular.js";
export { regular_buildFlow, regular_pubFlow } from "./sdk-impl/regular-flow.js";
export { checkDlerConfigHealth } from "./sdk-impl/rules/reliverse/dler-config-health/dler-config-health.js";
export { checkFileExtensions } from "./sdk-impl/rules/reliverse/file-extensions/file-extensions.js";
export { analyzeDependencies } from "./sdk-impl/rules/reliverse/missing-deps/analyzer.js";
export { checkMissingDependencies } from "./sdk-impl/rules/reliverse/missing-deps/deps-mod.js";
export type {
  MissingDepsFileType,
  PackageJson,
  FinderOptions,
  DependencyResult,
} from "./sdk-impl/rules/reliverse/missing-deps/deps-types.js";
export {
  findSourceFiles,
  readFile,
  readPackageJson,
} from "./sdk-impl/rules/reliverse/missing-deps/filesystem.js";
export { formatOutput } from "./sdk-impl/rules/reliverse/missing-deps/formatter.js";
export {
  extractPackageNames,
  normalizePackageName,
  getListedDependencies,
  getBuiltinModules,
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
  STRICT_FILE_EXTENSIONS,
  ALLOWED_IMPORT_EXTENSIONS,
  STRICT_IMPORT_EXTENSIONS,
} from "./sdk-impl/rules/rules-consts.js";
export { displayCheckResults } from "./sdk-impl/rules/rules-mod.js";
export { shouldIgnoreFile, getAllFiles, getLineNumber } from "./sdk-impl/rules/rules-utils.js";
export type {
  DistDirs,
  DistDirsAll,
  CopyBuildEntry,
  CopyHooks,
  MkdistBuildEntry,
  MkdistHooks,
  RollupBuildEntry,
  EsbuildOptions,
  RollupBuildOptions,
  RollupHooks,
  RollupOptions,
  UntypedBuildEntry,
  UntypedHooks,
  UntypedOutput,
  UntypedOutputs,
  BaseBuildEntry,
  BuildContext,
  BuildEntry,
  BuildHooks,
  BuildOptions,
  BuildPreset,
  UnifiedBuildConfig,
  PerfTimer,
  DirectoryType,
  RulesCheckOptions,
  CheckIssue,
  CheckResult,
  InputFile,
  OutputFile,
  LoaderResult,
  LoadFile,
  LoaderContext,
  Loader,
  CreateLoaderOptions,
  MkdistOptions,
} from "./sdk-impl/sdk-types.js";
export { BINARY_EXTS, BINARY_SET } from "./sdk-impl/utils/b-exts.js";
export { isBinaryExt } from "./sdk-impl/utils/binary.js";
export type { CommentStyle, FileExtension, CommentMapping } from "./sdk-impl/utils/comments.js";
export { DEFAULT_COMMENT, COMMENT_MAP, getCommentPrefix } from "./sdk-impl/utils/comments.js";
export {
  notFoundError,
  hookChildProcess,
  verifyENOENT,
  verifyENOENTSync,
} from "./sdk-impl/utils/exec/exec-enoent.js";
export type { EnvLike, EnvPathInfo } from "./sdk-impl/utils/exec/exec-env.js";
export { computeEnv } from "./sdk-impl/utils/exec/exec-env.js";
export { NonZeroExitError } from "./sdk-impl/utils/exec/exec-error.js";
export { escapeCommand, escapeArgument } from "./sdk-impl/utils/exec/exec-escape.js";
export type {
  Output,
  PipeOptions,
  KillSignal,
  OutputApi,
  Result,
  Options,
  XExec,
} from "./sdk-impl/utils/exec/exec-mod.js";
export { ExecProcess, x, exec } from "./sdk-impl/utils/exec/exec-mod.js";
export { parse } from "./sdk-impl/utils/exec/exec-parse.js";
export { resolveCommand } from "./sdk-impl/utils/exec/exec-resolve.js";
export { readShebang } from "./sdk-impl/utils/exec/exec-shebang.js";
export { spawn, spawnSync } from "./sdk-impl/utils/exec/exec-spawn.js";
export { waitForEvent, combineStreams } from "./sdk-impl/utils/exec/exec-stream.js";
export type { ExecParseResult } from "./sdk-impl/utils/exec/exec-types.js";
export { _parse } from "./sdk-impl/utils/exec/exec-types.js";
export {
  detectFileType,
  detectBufferType,
  detectStreamType,
  isBinary,
  getMimeType,
} from "./sdk-impl/utils/file-type.js";
export { finalizeBuild, finalizePub } from "./sdk-impl/utils/finalize.js";
export { safeRename, prepareCLIFiles } from "./sdk-impl/utils/fs-rename.js";
export {
  FILE_TYPES,
  INIT_BEHAVIOURS,
  DEST_FILE_EXISTS_BEHAVIOURS,
  CONTENT_CREATE_MODES,
} from "./sdk-impl/utils/init/init-const.js";
export {
  createFileFromScratch,
  initFile,
  initFiles,
  escapeMarkdownCodeBlocks,
} from "./sdk-impl/utils/init/init-impl.js";
export {
  gitignoreTemplate,
  readmeTemplate,
  licenseTemplate,
} from "./sdk-impl/utils/init/init-tmpl.js";
export type {
  FileType,
  InitBehaviour,
  DestFileExistsBehaviour,
  ReinitUserConfig,
  InitFileRequest,
  InitFileOptions,
  InitFileResult,
} from "./sdk-impl/utils/init/init-types.js";
export {
  installDependencies,
  addDependency,
  addDevDependency,
  removeDependency,
  ensureDependencyInstalled,
  dedupeDependencies,
  updateDependencies,
  runScript,
} from "./sdk-impl/utils/pm/pm-api.js";
export { packageManagers, detectPackageManager } from "./sdk-impl/utils/pm/pm-detect.js";
export { findup, parsePackageManagerField } from "./sdk-impl/utils/pm/pm-parse.js";
export type {
  PackageManagerName,
  PackageManager,
  OperationOptions,
  DetectPackageManagerOptions,
} from "./sdk-impl/utils/pm/pm-types.js";
export {
  executeCommand,
  NO_PACKAGE_MANAGER_DETECTED_ERROR_MSG,
  resolveOperationOptions,
  getWorkspaceArgs,
  doesDependencyExist,
} from "./sdk-impl/utils/pm/pm-utils.js";
export { resolveCrossLibs, resolveAllCrossLibs } from "./sdk-impl/utils/resolve-cross-libs.js";
export { useAggregator } from "./sdk-impl/utils/tools-agg.js";
export { printUsage } from "./sdk-impl/utils/tools-impl.js";
export {
  getBunSourcemapOption,
  getUnifiedSourcemapOption,
  renameEntryFile,
} from "./sdk-impl/utils/utils-build.js";
export { removeDistFolders, removeLogInternalCalls } from "./sdk-impl/utils/utils-clean.js";
export {
  PROJECT_ROOT,
  CONCURRENCY_DEFAULT,
  tsconfigJson,
  cliDomainDocs,
  validExtensions,
  SHOW_VERBOSE,
} from "./sdk-impl/utils/utils-consts.js";
export { filterDeps } from "./sdk-impl/utils/utils-deps.js";
export { determineDistName } from "./sdk-impl/utils/utils-determine.js";
export {
  handleDlerError,
  withWorkingDirectory,
  validateDevCwd,
  formatError,
} from "./sdk-impl/utils/utils-error-cwd.js";
export {
  copyRootFile,
  getDirectorySize,
  outDirBinFilesCount,
  deleteSpecificFiles,
  readFileSafe,
  writeFileSafe,
  validateDirectory,
} from "./sdk-impl/utils/utils-fs.js";
export { createJsrJSON, renameTsxFiles } from "./sdk-impl/utils/utils-jsr-json.js";
export { extractPackageName } from "./sdk-impl/utils/utils-misc.js";
export {
  library_createPackageJSON,
  library_createJsrConfig,
} from "./sdk-impl/utils/utils-package-json-libraries.js";
export { regular_createPackageJSON } from "./sdk-impl/utils/utils-package-json-regular.js";
export {
  createPerfTimer,
  getElapsedPerfTime,
  pausePerfTimer,
  resumePerfTimer,
} from "./sdk-impl/utils/utils-perf.js";
export {
  setFileSizeLimits,
  ALLOWED_FILE_TYPES,
  validatePath,
  validateFileType,
  validateContent,
  sanitizeInput,
  checkPermissions,
  checkFileSize,
  handleError,
  validateTemplate,
  validateMergeOperation,
  validateFileExists,
} from "./sdk-impl/utils/utils-security.js";
export { createTSConfig } from "./sdk-impl/utils/utils-tsconfig.js";
// AUTO-GENERATED AGGREGATOR END
