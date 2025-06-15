# Directory Comparison

**Table of Contents**:

- [Directory Comparison](#directory-comparison)
  - [src](#src)
  - [app](#app)
  - [app/agg](#appagg)
  - [app/build](#appbuild)
  - [app/check](#appcheck)
  - [app/conv](#appconv)
  - [app/copy](#appcopy)
  - [app/init](#appinit)
  - [app/inject](#appinject)
  - [app/libs](#applibs)
  - [app/magic](#appmagic)
  - [app/merge](#appmerge)
  - [app/migrate](#appmigrate)
  - [app/migrate/codemods](#appmigratecodemods)
  - [app/mkdist](#appmkdist)
  - [app/pack](#apppack)
  - [app/pub](#apppub)
  - [app/remdn](#appremdn)
  - [app/rempts](#apprempts)
  - [app/rename](#apprename)
  - [app/split](#appsplit)
  - [app/transform](#apptransform)
  - [app/unpack](#appunpack)
  - [libs](#libs)
  - [libs/cfg](#libscfg)
  - [libs/cfg/cfg-impl](#libscfgcfg-impl)
  - [libs/cfg/cfg-impl/rse-config](#libscfgcfg-implrse-config)
  - [libs/cfg/cfg-impl/rse-config/rse-impl](#libscfgcfg-implrse-configrse-impl)
  - [libs/sdk](#libssdk)
  - [libs/sdk/sdk-impl](#libssdksdk-impl)
  - [libs/sdk/sdk-impl/build](#libssdksdk-implbuild)
  - [libs/sdk/sdk-impl/build/bundlers](#libssdksdk-implbuildbundlers)
  - [libs/sdk/sdk-impl/build/bundlers/unified](#libssdksdk-implbuildbundlersunified)
  - [libs/sdk/sdk-impl/build/bundlers/unified/copy](#libssdksdk-implbuildbundlersunifiedcopy)
  - [libs/sdk/sdk-impl/build/bundlers/unified/mkdist](#libssdksdk-implbuildbundlersunifiedmkdist)
  - [libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl](#libssdksdk-implbuildbundlersunifiedmkdistmkdist-impl)
  - [libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loaders](#libssdksdk-implbuildbundlersunifiedmkdistmkdist-implloaders)
  - [libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/utils](#libssdksdk-implbuildbundlersunifiedmkdistmkdist-implutils)
  - [libs/sdk/sdk-impl/build/bundlers/unified/rollup](#libssdksdk-implbuildbundlersunifiedrollup)
  - [libs/sdk/sdk-impl/build/bundlers/unified/rollup/plugins](#libssdksdk-implbuildbundlersunifiedrollupplugins)
  - [libs/sdk/sdk-impl/build/bundlers/unified/untyped](#libssdksdk-implbuildbundlersunifieduntyped)
  - [libs/sdk/sdk-impl/cmds](#libssdksdk-implcmds)
  - [libs/sdk/sdk-impl/cmds/inject](#libssdksdk-implcmdsinject)
  - [libs/sdk/sdk-impl/cmds/transform](#libssdksdk-implcmdstransform)
  - [libs/sdk/sdk-impl/config](#libssdksdk-implconfig)
  - [libs/sdk/sdk-impl/magic](#libssdksdk-implmagic)
  - [libs/sdk/sdk-impl/pub](#libssdksdk-implpub)
  - [libs/sdk/sdk-impl/rules](#libssdksdk-implrules)
  - [libs/sdk/sdk-impl/rules/reliverse](#libssdksdk-implrulesreliverse)
  - [libs/sdk/sdk-impl/rules/reliverse/dler-config-health](#libssdksdk-implrulesreliversedler-config-health)
  - [libs/sdk/sdk-impl/rules/reliverse/file-extensions](#libssdksdk-implrulesreliversefile-extensions)
  - [libs/sdk/sdk-impl/rules/reliverse/missing-deps](#libssdksdk-implrulesreliversemissing-deps)
  - [libs/sdk/sdk-impl/rules/reliverse/no-dynamic-imports](#libssdksdk-implrulesreliverseno-dynamic-imports)
  - [libs/sdk/sdk-impl/rules/reliverse/no-index-files](#libssdksdk-implrulesreliverseno-index-files)
  - [libs/sdk/sdk-impl/rules/reliverse/package-json-health](#libssdksdk-implrulesreliversepackage-json-health)
  - [libs/sdk/sdk-impl/rules/reliverse/path-extensions](#libssdksdk-implrulesreliversepath-extensions)
  - [libs/sdk/sdk-impl/rules/reliverse/self-include](#libssdksdk-implrulesreliverseself-include)
  - [libs/sdk/sdk-impl/rules/reliverse/tsconfig-health](#libssdksdk-implrulesreliversetsconfig-health)
  - [libs/sdk/sdk-impl/utils](#libssdksdk-implutils)
  - [libs/sdk/sdk-impl/utils/common](#libssdksdk-implutilscommon)
  - [libs/sdk/sdk-impl/utils/pack-unpack](#libssdksdk-implutilspack-unpack)
  - [libs/sdk/sdk-impl/utils/shared](#libssdksdk-implutilsshared)

## src

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cli.ts | cli.js, cli.d.ts | cli.ts |
| mod.ts | mod.js, mod.d.ts | mod.ts |

## app

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmds.ts | cmds.js, cmds.d.ts | cmds.ts |

## app/agg

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| impl.ts | impl.js, impl.d.ts | impl.ts |
| run.ts | run.js, run.d.ts | run.ts |

## app/build

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| impl.ts | impl.js, impl.d.ts | impl.ts |
| postbuild.ts | postbuild.js, postbuild.d.ts | postbuild.ts |
| ppb-utils.ts | ppb-utils.js, ppb-utils.d.ts | ppb-utils.ts |
| prebuild.ts | prebuild.js, prebuild.d.ts | prebuild.ts |

## app/check

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/conv

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/copy

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/init

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| init-const.ts | init-const.js, init-const.d.ts | init-const.ts |
| init-impl.ts | init-impl.js, init-impl.d.ts | init-impl.ts |
| init-tmpl.ts | init-tmpl.js, init-tmpl.d.ts | init-tmpl.ts |
| init-types.ts | init-types.js, init-types.d.ts | init-types.ts |

## app/inject

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/libs

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/magic

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| old.ts | old.js, old.d.ts | old.ts |

## app/merge

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/migrate

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/migrate/codemods

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| anything-bun.ts | anything-bun.js, anything-bun.d.ts | anything-bun.ts |
| commander-rempts.ts | commander-rempts.js, commander-rempts.d.ts | commander-rempts.ts |
| console-relinka.ts | console-relinka.js, console-relinka.d.ts | console-relinka.ts |
| fs-relifso.ts | fs-relifso.js, fs-relifso.d.ts | fs-relifso.ts |
| nodenext-bundler.ts | nodenext-bundler.js, nodenext-bundler.d.ts | nodenext-bundler.ts |
| path-pathkit.ts | path-pathkit.js, path-pathkit.d.ts | path-pathkit.ts |
| readdir-glob.ts | readdir-glob.js, readdir-glob.d.ts | readdir-glob.ts |

## app/mkdist

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/pack

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/pub

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| impl.ts | impl.js, impl.d.ts | impl.ts |

## app/remdn

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/rempts

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/rename

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/split

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |
| impl.ts | impl.js, impl.d.ts | impl.ts |

## app/transform

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## app/unpack

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cmd.ts | cmd.js, cmd.d.ts | cmd.ts |

## libs

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |

## libs/cfg

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cfg-mod.ts | cfg-mod.js, cfg-mod.d.ts | cfg-mod.ts |

## libs/cfg/cfg-impl

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cfg-consts.ts | cfg-consts.js, cfg-consts.d.ts | cfg-consts.ts |
| cfg-types.ts | cfg-types.js, cfg-types.d.ts | cfg-types.ts |

## libs/cfg/cfg-impl/rse-config

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| rse-mod.ts | rse-mod.js, rse-mod.d.ts | rse-mod.ts |

## libs/cfg/cfg-impl/rse-config/rse-impl

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| rse-biome.ts | rse-biome.js, rse-biome.d.ts | rse-biome.ts |
| rse-comments.ts | rse-comments.js, rse-comments.d.ts | rse-comments.ts |
| rse-consts.ts | rse-consts.js, rse-consts.d.ts | rse-consts.ts |
| rse-content.ts | rse-content.js, rse-content.d.ts | rse-content.ts |
| rse-core.ts | rse-core.js, rse-core.d.ts | rse-core.ts |
| rse-create.ts | rse-create.js, rse-create.d.ts | rse-create.ts |
| rse-def-utils.ts | rse-def-utils.js, rse-def-utils.d.ts | rse-def-utils.ts |
| rse-default.ts | rse-default.js, rse-default.d.ts | rse-default.ts |
| rse-define.ts | rse-define.js, rse-define.d.ts | rse-define.ts |
| rse-detect.ts | rse-detect.js, rse-detect.d.ts | rse-detect.ts |
| rse-gen-cfg.ts | rse-gen-cfg.js, rse-gen-cfg.d.ts | rse-gen-cfg.ts |
| rse-migrate.ts | rse-migrate.js, rse-migrate.d.ts | rse-migrate.ts |
| rse-path.ts | rse-path.js, rse-path.d.ts | rse-path.ts |
| rse-prompts.ts | rse-prompts.js, rse-prompts.d.ts | rse-prompts.ts |
| rse-read.ts | rse-read.js, rse-read.d.ts | rse-read.ts |
| rse-repair.ts | rse-repair.js, rse-repair.d.ts | rse-repair.ts |
| rse-schema.ts | rse-schema.js, rse-schema.d.ts | rse-schema.ts |
| rse-types.ts | rse-types.js, rse-types.d.ts | rse-types.ts |
| rse-unstable.ts | rse-unstable.js, rse-unstable.d.ts | rse-unstable.ts |
| rse-update.ts | rse-update.js, rse-update.d.ts | rse-update.ts |
| rse-utils.ts | rse-utils.js, rse-utils.d.ts | rse-utils.ts |

## libs/sdk

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| sdk-mod.ts | sdk-mod.js, sdk-mod.d.ts | sdk-mod.ts |

## libs/sdk/sdk-impl

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| constants.ts | constants.js, constants.d.ts | constants.ts |
| library-flow.ts | library-flow.js, library-flow.d.ts | library-flow.ts |
| regular-flow.ts | regular-flow.js, regular-flow.d.ts | regular-flow.ts |
| sdk-types.ts | sdk-types.js, sdk-types.d.ts | sdk-types.ts |

## libs/sdk/sdk-impl/build

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| build-library.ts | build-library.js, build-library.d.ts | build-library.ts |
| build-regular.ts | build-regular.js, build-regular.d.ts | build-regular.ts |

## libs/sdk/sdk-impl/build/bundlers

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |

## libs/sdk/sdk-impl/build/bundlers/unified

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| auto.ts | auto.js, auto.d.ts | auto.ts |
| build.ts | build.js, build.d.ts | build.ts |
| utils.ts | utils.js, utils.d.ts | utils.ts |
| validate.ts | validate.js, validate.d.ts | validate.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/copy

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| copy-mod.ts | copy-mod.js, copy-mod.d.ts | copy-mod.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/mkdist

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| mkdist-mod.ts | mkdist-mod.js, mkdist-mod.d.ts | mkdist-mod.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| loader.ts | loader.js, loader.d.ts | loader.ts |
| make.ts | make.js, make.d.ts | make.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loaders

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| js.ts | js.js, js.d.ts | js.ts |
| loaders-mod.ts | loaders-mod.js, loaders-mod.d.ts | loaders-mod.ts |
| postcss.ts | postcss.js, postcss.d.ts | postcss.ts |
| sass.ts | sass.js, sass.d.ts | sass.ts |
| vue.ts | vue.js, vue.d.ts | vue.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/utils

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| dts.ts | dts.js, dts.d.ts | dts.ts |
| fs.ts | fs.js, fs.d.ts | fs.ts |
| spinner.ts | spinner.js, spinner.d.ts | spinner.ts |
| vue-dts.ts | vue-dts.js, vue-dts.d.ts | vue-dts.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/rollup

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| build.ts | build.js, build.d.ts | build.ts |
| config.ts | config.js, config.d.ts | config.ts |
| stub.ts | stub.js, stub.d.ts | stub.ts |
| utils.ts | utils.js, utils.d.ts | utils.ts |
| watch.ts | watch.js, watch.d.ts | watch.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/rollup/plugins

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| cjs.ts | cjs.js, cjs.d.ts | cjs.ts |
| esbuild.ts | esbuild.js, esbuild.d.ts | esbuild.ts |
| json.ts | json.js, json.d.ts | json.ts |
| raw.ts | raw.js, raw.d.ts | raw.ts |
| shebang.ts | shebang.js, shebang.d.ts | shebang.ts |

## libs/sdk/sdk-impl/build/bundlers/unified/untyped

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| untyped-mod.ts | untyped-mod.js, untyped-mod.d.ts | untyped-mod.ts |

## libs/sdk/sdk-impl/cmds

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |

## libs/sdk/sdk-impl/cmds/inject

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| inject-impl-mod.ts | inject-impl-mod.js, inject-impl-mod.d.ts | inject-impl-mod.ts |

## libs/sdk/sdk-impl/cmds/transform

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| transform-impl-mod.ts | transform-impl-mod.js, transform-impl-mod.d.ts | transform-impl-mod.ts |

## libs/sdk/sdk-impl/config

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| default.ts | default.js, default.d.ts | default.ts |
| info.ts | info.js, info.d.ts | info.ts |
| init.ts | init.js, init.d.ts | init.ts |
| load.ts | load.js, load.d.ts | load.ts |
| types.ts | types.js, types.d.ts | types.ts |

## libs/sdk/sdk-impl/magic

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| ms-apply.ts | ms-apply.js, ms-apply.d.ts | ms-apply.ts |
| ms-spells.ts | ms-spells.js, ms-spells.d.ts | ms-spells.ts |

## libs/sdk/sdk-impl/pub

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| pub-library.ts | pub-library.js, pub-library.d.ts | pub-library.ts |
| pub-regular.ts | pub-regular.js, pub-regular.d.ts | pub-regular.ts |

## libs/sdk/sdk-impl/rules

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| rules-consts.ts | rules-consts.js, rules-consts.d.ts | rules-consts.ts |
| rules-mod.ts | rules-mod.js, rules-mod.d.ts | rules-mod.ts |
| rules-utils.ts | rules-utils.js, rules-utils.d.ts | rules-utils.ts |

## libs/sdk/sdk-impl/rules/reliverse

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |

## libs/sdk/sdk-impl/rules/reliverse/dler-config-health

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| dler-config-health.ts | dler-config-health.js, dler-config-health.d.ts | dler-config-health.ts |

## libs/sdk/sdk-impl/rules/reliverse/file-extensions

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| file-extensions.ts | file-extensions.js, file-extensions.d.ts | file-extensions.ts |

## libs/sdk/sdk-impl/rules/reliverse/missing-deps

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| analyzer.ts | analyzer.js, analyzer.d.ts | analyzer.ts |
| deps-mod.ts | deps-mod.js, deps-mod.d.ts | deps-mod.ts |
| deps-types.ts | deps-types.js, deps-types.d.ts | deps-types.ts |
| filesystem.ts | filesystem.js, filesystem.d.ts | filesystem.ts |
| formatter.ts | formatter.js, formatter.d.ts | formatter.ts |
| parser.ts | parser.js, parser.d.ts | parser.ts |

## libs/sdk/sdk-impl/rules/reliverse/no-dynamic-imports

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| no-dynamic-imports.ts | no-dynamic-imports.js, no-dynamic-imports.d.ts | no-dynamic-imports.ts |

## libs/sdk/sdk-impl/rules/reliverse/no-index-files

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| no-index-files.ts | no-index-files.js, no-index-files.d.ts | no-index-files.ts |

## libs/sdk/sdk-impl/rules/reliverse/package-json-health

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| package-json-health.ts | package-json-health.js, package-json-health.d.ts | package-json-health.ts |

## libs/sdk/sdk-impl/rules/reliverse/path-extensions

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| path-extensions.ts | path-extensions.js, path-extensions.d.ts | path-extensions.ts |

## libs/sdk/sdk-impl/rules/reliverse/self-include

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| self-include.ts | self-include.js, self-include.d.ts | self-include.ts |

## libs/sdk/sdk-impl/rules/reliverse/tsconfig-health

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| tsconfig-health.ts | tsconfig-health.js, tsconfig-health.d.ts | tsconfig-health.ts |

## libs/sdk/sdk-impl/utils

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| b-exts.ts | b-exts.js, b-exts.d.ts | b-exts.ts |
| binary.ts | binary.js, binary.d.ts | binary.ts |
| comments.ts | comments.js, comments.d.ts | comments.ts |
| file-type.ts | file-type.js, file-type.d.ts | file-type.ts |
| finalize.ts | finalize.js, finalize.d.ts | finalize.ts |
| replacements.ts | replacements.js, replacements.d.ts | replacements.ts |
| resolve-cross-libs.ts | resolve-cross-libs.js, resolve-cross-libs.d.ts | resolve-cross-libs.ts |
| tools-agg.ts | tools-agg.js, tools-agg.d.ts | tools-agg.ts |
| tools-impl.ts | tools-impl.js, tools-impl.d.ts | tools-impl.ts |
| utils-build.ts | utils-build.js, utils-build.d.ts | utils-build.ts |
| utils-clean.ts | utils-clean.js, utils-clean.d.ts | utils-clean.ts |
| utils-consts.ts | utils-consts.js, utils-consts.d.ts | utils-consts.ts |
| utils-deps.ts | utils-deps.js, utils-deps.d.ts | utils-deps.ts |
| utils-determine.ts | utils-determine.js, utils-determine.d.ts | utils-determine.ts |
| utils-error-cwd.ts | utils-error-cwd.js, utils-error-cwd.d.ts | utils-error-cwd.ts |
| utils-fs.ts | utils-fs.js, utils-fs.d.ts | utils-fs.ts |
| utils-jsr-json.ts | utils-jsr-json.js, utils-jsr-json.d.ts | utils-jsr-json.ts |
| utils-misc.ts | utils-misc.js, utils-misc.d.ts | utils-misc.ts |
| utils-package-json-libraries.ts | utils-package-json-libraries.js, utils-package-json-libraries.d.ts | utils-package-json-libraries.ts |
| utils-package-json-regular.ts | utils-package-json-regular.js, utils-package-json-regular.d.ts | utils-package-json-regular.ts |
| utils-perf.ts | utils-perf.js, utils-perf.d.ts | utils-perf.ts |
| utils-security.ts | utils-security.js, utils-security.d.ts | utils-security.ts |
| utils-tsconfig.ts | utils-tsconfig.js, utils-tsconfig.d.ts | utils-tsconfig.ts |

## libs/sdk/sdk-impl/utils/common

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |

## libs/sdk/sdk-impl/utils/pack-unpack

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
| pu-constants.ts | pu-constants.js, pu-constants.d.ts | pu-constants.ts |
| pu-file-utils.ts | pu-file-utils.js, pu-file-utils.d.ts | pu-file-utils.ts |
| pu-types.ts | pu-types.js, pu-types.d.ts | pu-types.ts |
| pub-json-utils.ts | pub-json-utils.js, pub-json-utils.d.ts | pub-json-utils.ts |

## libs/sdk/sdk-impl/utils/shared

| src | dist-npm/bin | dist-jsr/bin |
| --- | --- | --- |
