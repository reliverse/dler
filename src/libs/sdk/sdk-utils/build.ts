import type { PackageJson } from "pkg-types";

import { re } from "@reliverse/relico";
import { defu } from "defu";
import { createHooks } from "hookable";
import { createJiti } from "jiti";
import { promises as fsp } from "node:fs";
import Module from "node:module";
import { resolve, relative, isAbsolute, normalize } from "pathe";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { glob } from "tinyglobby";

import { relinka, createTimer, getElapsedTime } from "~/utils.js";

import type {
  BuildContext,
  UnifiedBuildConfig,
  BuildOptions,
} from "./types.js";

import { copyBuild } from "./builders/copy/index.js";
import { mkdistBuild } from "./builders/mkdist/index.js";
import { rollupBuild } from "./builders/rollup/index.js";
import { typesBuild } from "./builders/untyped/index.js";
import {
  dumpObject,
  rmdir,
  resolvePreset,
  removeExtension,
  inferPkgExternals,
  withTrailingSlash,
} from "./utils.js";
import { validatePackage, validateDependencies } from "./validate.js";

export async function build(
  rootDir: string,
  stub: boolean,
  inputConfig: UnifiedBuildConfig & {
    config?: string;
    showOutLog?: boolean;
  },
  outDir: string,
): Promise<void> {
  // Determine rootDir
  rootDir = resolve(process.cwd(), rootDir || ".");

  // Create jiti instance for loading initial config
  const jiti = createJiti(rootDir);

  const _buildConfig: UnifiedBuildConfig | UnifiedBuildConfig[] =
    // TODO: add relidler.cfg.ts support
    (await jiti.import(inputConfig?.config || "./build.config", {
      try: !inputConfig.config,
      default: true,
    })) || {};

  const buildConfigs = (
    Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]
  ).filter(Boolean);

  const pkg: PackageJson &
    Partial<Record<"relidler" | "build", UnifiedBuildConfig>> =
    ((await jiti.import("./package.json", {
      try: true,
      default: true,
    })) as PackageJson) || ({} as PackageJson);

  // Invoke build for every build config defined in build.config.ts
  const cleanedDirs: string[] = [];

  const _watchMode = inputConfig.watch === true;
  const _stubMode = !_watchMode && (stub || inputConfig.stub === true);

  if (!_watchMode && !_stubMode) {
    // Prefer `publishConfig` when defined
    Object.assign(pkg, pkg.publishConfig);
  }

  for (const buildConfig of buildConfigs) {
    await _build(
      rootDir,
      inputConfig,
      buildConfig,
      pkg,
      cleanedDirs,
      _stubMode,
      _watchMode,
      outDir,
      inputConfig.showOutLog || true,
    );
  }
}

async function _build(
  rootDir: string,
  inputConfig: UnifiedBuildConfig,
  buildConfig: UnifiedBuildConfig,
  pkg: PackageJson & Partial<Record<"relidler" | "build", UnifiedBuildConfig>>,
  cleanedDirs: string[],
  _stubMode: boolean,
  _watchMode: boolean,
  outDir: string,
  showOutLog: boolean,
): Promise<void> {
  // Start timing the build process
  const timer = createTimer();

  // Resolve preset
  const preset = await resolvePreset(
    buildConfig.preset ||
      pkg.relidler?.preset ||
      pkg.build?.preset ||
      inputConfig.preset ||
      "auto",
    rootDir,
  );

  // Merge options
  // @ts-expect-error [2589] Type instantiation is excessively deep and possibly infinite.
  const options = defu(
    buildConfig,
    pkg.relidler || pkg.build,
    inputConfig,
    preset,
    {
      name: (pkg?.name || "").split("/").pop() || "default",
      rootDir,
      entries: [],
      clean: true,
      declaration: undefined,
      outDir: outDir,
      stub: _stubMode,
      stubOptions: {
        /**
         * @see https://github.com/unjs/jiti#%EF%B8%8F-options
         */
        jiti: {
          interopDefault: true,
          alias: {},
        },
      },
      watch: _watchMode,
      watchOptions: _watchMode
        ? {
            exclude: "node_modules/**",
            include: "src/**",
          }
        : undefined,
      externals: [
        ...Module.builtinModules,
        ...Module.builtinModules.map((m) => `node:${m}`),
      ],
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      alias: {},
      replace: {},
      failOnWarn: true,
      sourcemap: false,
      showOutLog: true,
      rollup: {
        emitCJS: false,
        watch: false,
        cjsBridge: false,
        inlineDependencies: false,
        preserveDynamicImports: true,
        output: {
          /**
           * @see https://v8.dev/features/import-attributes
           */
          importAttributesKey: "with",
        },
        // Plugins
        replace: {
          preventAssignment: true,
        },
        alias: {},
        resolve: {
          preferBuiltins: true,
        },
        json: {
          preferConst: true,
        },
        commonjs: {
          ignoreTryCatch: true,
        },
        esbuild: { target: "esnext" },
        dts: {
          compilerOptions: {
            /**
             * @see https://github.com/Swatinem/rollup-plugin-dts/issues/143
             */
            preserveSymlinks: false,
            /**
             * @see https://github.com/Swatinem/rollup-plugin-dts/issues/127
             */
            composite: false,
          },
          respectExternal: true,
        },
      },
      parallel: false,
    } satisfies BuildOptions,
  ) as BuildOptions;

  // Resolve dirs relative to rootDir
  options.outDir = resolve(options.rootDir, options.outDir);

  // Create shared jiti instance for context
  const jiti = createJiti(options.rootDir, { interopDefault: true });

  // Build context
  const ctx: BuildContext = {
    options,
    jiti,
    warnings: new Set(),
    pkg,
    buildEntries: [],
    usedImports: new Set(),
    hooks: createHooks(),
  };

  // Register hooks
  if (preset.hooks) {
    ctx.hooks.addHooks(preset.hooks);
  }
  if (inputConfig.hooks) {
    ctx.hooks.addHooks(inputConfig.hooks);
  }
  if (buildConfig.hooks) {
    ctx.hooks.addHooks(buildConfig.hooks);
  }

  // Allow prepare and extending context
  await ctx.hooks.callHook("build:prepare", ctx);

  // Normalize entries
  options.entries = options.entries.map((entry) =>
    typeof entry === "string" ? { input: entry } : entry,
  );

  for (const entry of options.entries) {
    if (typeof entry.name !== "string") {
      let relativeInput = isAbsolute(entry.input)
        ? relative(rootDir, entry.input)
        : normalize(entry.input);
      if (relativeInput.startsWith("./")) {
        relativeInput = relativeInput.slice(2);
      }
      entry.name = removeExtension(relativeInput.replace(/^src\//, ""));
    }

    if (!entry.input) {
      throw new Error(`Missing entry input: ${dumpObject(entry)}`);
    }

    if (!entry.builder) {
      entry.builder = entry.input.endsWith("/") ? "mkdist" : "rollup";
    }

    if (options.declaration !== undefined && entry.declaration === undefined) {
      entry.declaration = options.declaration;
    }

    entry.input = resolve(options.rootDir, entry.input);
    entry.outDir = resolve(options.rootDir, entry.outDir || options.outDir);
  }

  // Infer dependencies from pkg
  options.dependencies = Object.keys(pkg.dependencies || {});
  options.peerDependencies = Object.keys(pkg.peerDependencies || {});
  options.devDependencies = Object.keys(pkg.devDependencies || {});

  // Inject all dependencies as externals
  options.externals.push(...inferPkgExternals(pkg));
  options.externals = [...new Set(options.externals)];

  // Call build:before
  await ctx.hooks.callHook("build:before", ctx);

  // Start info
  relinka(
    "info",
    re.cyan(`${options.stub ? "Stubbing" : "Building"} ${options.name}`),
  );
  if (process.env.DEBUG) {
    relinka(
      "info",
      `${re.bold("Root dir:")} ${options.rootDir}
  ${re.bold("Entries:")}
  ${options.entries.map((entry) => `  ${dumpObject(entry)}`).join("\n  ")}
`,
    );
  }

  // Clean dist dirs
  if (options.clean) {
    for (const dir of new Set(
      options.entries
        .map((e) => e.outDir)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .sort(),
    )) {
      if (
        dir === options.rootDir ||
        options.rootDir.startsWith(withTrailingSlash(dir)) ||
        cleanedDirs.some((c) => dir.startsWith(c))
      ) {
        continue;
      }
      cleanedDirs.push(dir);
      relinka(
        "info",
        `Cleaning dist directory: \`./${relative(process.cwd(), dir)}\``,
      );
      await rmdir(dir);
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  // Try to selflink
  // if (ctx.stub && ctx.pkg.name) {
  //   const nodemodulesDir = resolve(ctx.rootDir, 'node_modules', ctx.pkg.name)
  //   await symlink(resolve(ctx.rootDir), nodemodulesDir).catch(() => {})
  // }

  const buildTasks = [
    typesBuild, // untyped
    mkdistBuild, // mkdist
    rollupBuild, // rollup
    copyBuild, // copy
  ] as const;

  if (options.parallel) {
    await Promise.all(buildTasks.map((task) => task(ctx)));
  } else {
    for (const task of buildTasks) {
      await task(ctx);
    }
  }

  // Skip rest for stub and watch mode
  if (options.stub || options.watch) {
    await ctx.hooks.callHook("build:done", ctx);
    return;
  }

  // Done info
  relinka("success", `Build succeeded for ${options.name}`);

  // Find all dist files and add missing entries as chunks
  const outFiles = await glob(["**"], { cwd: options.outDir });
  for (const file of outFiles) {
    let entry = ctx.buildEntries.find((e) => e.path === file);
    if (!entry) {
      entry = {
        path: file,
        chunk: true,
      };
      ctx.buildEntries.push(entry);
    }
    if (!entry.bytes) {
      const stat = await fsp.stat(resolve(options.outDir, file));
      entry.bytes = stat.size;
    }
  }

  const rPath = (p: string): string =>
    relative(process.cwd(), resolve(options.outDir, p));

  if (showOutLog) {
    for (const entry of ctx.buildEntries.filter((e) => !e.chunk)) {
      let totalBytes = entry.bytes || 0;
      for (const chunk of entry.chunks || []) {
        totalBytes +=
          ctx.buildEntries.find((e) => e.path === chunk)?.bytes || 0;
      }
      let line = `  ${re.bold(rPath(entry.path))} (${[
        totalBytes && `total size: ${re.cyan(prettyBytes(totalBytes))}`,
        entry.bytes && `chunk size: ${re.cyan(prettyBytes(entry.bytes))}`,
        entry.exports?.length &&
          `exports: ${re.gray(entry.exports.join(", "))}`,
      ]
        .filter(Boolean)
        .join(", ")})`;

      if (entry.chunks?.length) {
        line += `\n${entry.chunks
          .map((p) => {
            const chunk =
              ctx.buildEntries.find((e) => e.path === p) || ({} as any);
            return re.gray(
              `  └─ ${rPath(p)}${re.bold(
                chunk.bytes ? ` (${prettyBytes(chunk.bytes)})` : "",
              )}`,
            );
          })
          .join("\n")}`;
      }

      if (entry.modules?.length) {
        line += `\n${entry.modules
          .filter((m) => m.id.includes("node_modules"))
          .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
          .map((m) => {
            return re.gray(
              `  📦 ${rPath(m.id)}${re.bold(m.bytes ? ` (${prettyBytes(m.bytes)})` : "")}`,
            );
          })
          .join("\n")}`;
      }

      relinka("info", entry.chunk ? re.gray(line) : line);
    }

    // Calculate elapsed time
    const elapsedTime = getElapsedTime(timer);
    const formattedTime = prettyMilliseconds(elapsedTime, { verbose: true });

    relinka(
      "info",
      "Σ Total dist size:",
      re.bold(
        prettyBytes(ctx.buildEntries.reduce((a, e) => a + (e.bytes || 0), 0)),
      ),
      `(build time: ${re.bold(formattedTime)})`,
    );
  }

  // Validate
  validateDependencies(ctx);
  validatePackage(pkg, rootDir, ctx);

  // Call build:done
  await ctx.hooks.callHook("build:done", ctx);

  relinka("info", "");

  if (ctx.warnings.size > 0) {
    relinka(
      "warn",
      `Build is done with some warnings:\n\n${[...ctx.warnings]
        .map((msg) => `- ${msg}`)
        .join("\n")}`,
    );
    if (ctx.options.failOnWarn) {
      relinka(
        "error",
        "Exiting with code (1). You can change this behavior by setting `failOnWarn: false` .",
      );
      process.exit(1);
    }
  }
}
