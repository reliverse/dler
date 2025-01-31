import type { PackageJson } from "pkg-types";

import { consola } from "consola";
import { colors } from "consola/utils";
import { defu } from "defu";
import { createHooks } from "hookable";
import { createJiti } from "jiti";
import { promises as fsp } from "node:fs";
import Module from "node:module";
import { resolve, relative, isAbsolute, normalize } from "pathe";
import prettyBytes from "pretty-bytes";
import { glob } from "tinyglobby";

import type { BuildContext, BuildConfig, BuildOptions } from "./types.js";

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
  inputConfig: BuildConfig & { config?: string } = {},
): Promise<void> {
  // Determine rootDir
  rootDir = resolve(process.cwd(), rootDir || ".");

  // Create jiti instance for loading initial config
  const jiti = createJiti(rootDir);

  const _buildConfig: BuildConfig | BuildConfig[] =
    (await jiti.import(inputConfig?.config || "./build.config", {
      try: !inputConfig.config,
      default: true,
    })) || {};

  const buildConfigs = (
    Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]
  ).filter(Boolean);

  const pkg: PackageJson & Partial<Record<"relidler" | "build", BuildConfig>> =
    (await jiti.import("./package.json", {
      try: true,
      default: true,
    })) || ({} as PackageJson);

  // Invoke build for every build config defined in build.config.ts
  const cleanedDirs: string[] = [];

  const _watchMode = inputConfig.watch;
  const _stubMode = !_watchMode && (stub || inputConfig.stub);

  for (const buildConfig of buildConfigs) {
    await _build(
      rootDir,
      buildConfig,
      pkg,
      cleanedDirs,
      // @ts-expect-error TODO: fix ts
      _stubMode,
      _watchMode,
      inputConfig,
    );
  }
}

async function _build(
  rootDir: string,
  buildConfig: BuildConfig,
  pkg: PackageJson & Partial<Record<"relidler" | "build", BuildConfig>>,
  cleanedDirs: string[],
  _stubMode: boolean,
  _watchMode: boolean,
  inputConfig: BuildConfig = {},
): Promise<void> {
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
  // @ts-expect-error TODO: fix ts
  const options = defu<BuildOptions, BuildOptions>(
    // @ts-expect-error TODO: fix ts
    buildConfig as BuildOptions,
    (pkg.relidler || pkg.build) as BuildOptions,
    inputConfig as BuildOptions,
    preset as BuildOptions,
    {
      name: (pkg?.name || "").split("/").pop() || "default",
      rootDir,
      entries: [],
      clean: true,
      declaration: undefined,
      outDir: "dist",
      stub: _stubMode,
      stubOptions: {
        jiti: {
          interopDefault: true,
          alias: {},
        },
      },
      watch: _watchMode,
      // @ts-expect-error TODO: fix ts
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
      rollup: {
        emitCJS: false,
        watch: false,
        cjsBridge: false,
        inlineDependencies: false,
        preserveDynamicImports: true,
        output: {
          importAttributesKey: "with",
        },
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
        // @ts-expect-error TODO: fix ts
        commonjs: {
          ignoreTryCatch: true,
        },
        esbuild: { target: "esnext" },
        dts: {
          compilerOptions: { preserveSymlinks: false },
          respectExternal: true,
        },
      },
      parallel: false,
    } satisfies BuildOptions,
  );

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

  // Add all dependencies as externals
  options.externals.push(...inferPkgExternals(pkg));
  options.externals = [...new Set(options.externals)];

  // Call build:before
  await ctx.hooks.callHook("build:before", ctx);

  // Start info
  consola.info(
    colors.cyan(`${options.stub ? "Stubbing" : "Building"} ${options.name}`),
  );
  if (process.env["DEBUG"]) {
    consola.info(`${colors.bold("Root dir:")} ${options.rootDir}
  ${colors.bold("Entries:")}
  ${options.entries.map((entry) => `  ${dumpObject(entry)}`).join("\n  ")}
`);
  }

  // Clean dist dirs
  if (options.clean) {
    for (const dir of new Set(
      options.entries
        .map((e) => e.outDir)
        .filter(Boolean)
        .sort() as unknown as Set<string>,
    )) {
      if (
        dir === options.rootDir ||
        options.rootDir.startsWith(withTrailingSlash(dir)) ||
        cleanedDirs.some((c) => dir.startsWith(c))
      ) {
        continue;
      }
      cleanedDirs.push(dir);
      consola.info(
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
  consola.success(colors.green(`Build succeeded for ${options.name}`));

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
  for (const entry of ctx.buildEntries.filter((e) => !e.chunk)) {
    let totalBytes = entry.bytes || 0;
    for (const chunk of entry.chunks || []) {
      totalBytes += ctx.buildEntries.find((e) => e.path === chunk)?.bytes || 0;
    }
    let line = `  ${colors.bold(rPath(entry.path))} (${[
      totalBytes && `total size: ${colors.cyan(prettyBytes(totalBytes))}`,
      entry.bytes && `chunk size: ${colors.cyan(prettyBytes(entry.bytes))}`,
      entry.exports?.length &&
        `exports: ${colors.gray(entry.exports.join(", "))}`,
    ]
      .filter(Boolean)
      .join(", ")})`;
    if (entry.chunks?.length) {
      line += `\n${entry.chunks
        .map((p) => {
          const chunk =
            ctx.buildEntries.find((e) => e.path === p) || ({} as any);
          return colors.gray(
            `  └─ ${rPath(p)}${colors.bold(
              chunk.bytes ? ` (${prettyBytes(chunk?.bytes)})` : "",
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
          return colors.gray(
            `  📦 ${rPath(m.id)}${colors.bold(m.bytes ? ` (${prettyBytes(m.bytes)})` : "")}`,
          );
        })
        .join("\n")}`;
    }
    consola.log(entry.chunk ? colors.gray(line) : line);
  }
  console.log(
    "Σ Total dist size (byte size):",
    colors.cyan(
      prettyBytes(ctx.buildEntries.reduce((a, e) => a + (e.bytes || 0), 0)),
    ),
  );

  // Validate
  validateDependencies(ctx);
  validatePackage(pkg, rootDir, ctx);

  // Call build:done
  await ctx.hooks.callHook("build:done", ctx);

  consola.log("");

  if (ctx.warnings.size > 0) {
    consola.warn(
      `Build is done with some warnings:\n\n${[...ctx.warnings].map((msg) => `- ${msg}`).join("\n")}`,
    );
    if (ctx.options.failOnWarn) {
      consola.error(
        "Exiting with code (1). You can change this behavior by setting `failOnWarn: false` .",
      );
      process.exit(1);
    }
  }
}
