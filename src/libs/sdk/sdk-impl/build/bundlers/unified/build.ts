import type { PackageJson } from "pkg-types";

import { isAbsolute, normalize, relative, resolve } from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { defu } from "defu";
import { createHooks } from "hookable";
import { createJiti } from "jiti";
import { promises as fsp } from "node:fs";
import Module from "node:module";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { glob } from "tinyglobby";

import type { BuildContext, BuildOptions, UnifiedBuildConfig } from "~/libs/sdk/sdk-types";

import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";

import { copyBuild } from "./copy/copy-mod";
import { mkdistBuild } from "./mkdist/mkdist-mod";
import { rollupBuild } from "./rollup/build";
import { typesBuild } from "./untyped/untyped-mod";
import {
  dumpObject,
  inferPkgExternals,
  removeExtension,
  resolvePreset,
  rmdir,
  withTrailingSlash,
} from "./utils";
import { validateDependencies, validatePackage } from "./validate";

const STOP_AFTER_STEP = 0; // 0 runs all steps, specific step number stops right after that step

/**
 * Stops the build process at a specific step.
 * TODO: bring back all info from this commit:
 * https://github.com/reliverse/dler/tree/b95c808
 * @param stepNumber - The step number to stop at.
 */
function shouldStopAtStep(stepNumber: number): void {
  if (STOP_AFTER_STEP > 0 && stepNumber >= STOP_AFTER_STEP) {
    relinka("success", `Stopping build at step ${stepNumber}`);
    process.exit(0);
  }
}

// Step 1: Main build function that orchestrates the entire build process
export async function unifiedBuild(
  inputSourceDir: string,
  coreIsCLI: { enabled: boolean; scripts: Record<string, string> },
  isLib: boolean,
  rootDir: string,
  inputConfig: UnifiedBuildConfig & {
    config?: string;
    showOutLog?: boolean;
  },
  outDir: string,
  transpileStub = false,
): Promise<void> {
  shouldStopAtStep(1);
  // relinka("info", "Step 1: Starting unified build process");
  relinka("info", "Starting unified build process...");
  relinka("verbose", `Processing build for source directory: ${inputSourceDir}`);
  relinka(
    "verbose",
    `Output directory: ${outDir}, Is CLI: ${coreIsCLI.enabled}, Is Library: ${isLib}`,
  );

  // Determine rootDir
  const resolvedRootDir = resolve(process.cwd(), rootDir || ".");

  // Create jiti instance for loading initial config
  const jiti = createJiti(resolvedRootDir);

  const _buildConfig: UnifiedBuildConfig | UnifiedBuildConfig[] =
    (await jiti.import(inputConfig?.config || ".config/dler.ts", {
      default: true,
      try: !inputConfig.config,
    })) || {};

  const buildConfigs = (Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]).filter(
    Boolean,
  );

  const pkg: PackageJson & Partial<Record<"build" | "dler", UnifiedBuildConfig>> =
    (await jiti.import("./package.json", {
      default: true,
      try: true,
    })) || ({} as PackageJson);

  // Invoke build for every build config defined in `.config/dler.ts`
  const cleanedDirs: string[] = [];

  const _transpileWatchMode = inputConfig.transpileWatch === true;
  const _transpileStubMode =
    !_transpileWatchMode && (transpileStub || inputConfig.transpileStub === true);

  if (!_transpileWatchMode && !_transpileStubMode) {
    // Prefer `publishConfig` when defined
    Object.assign(pkg, pkg.publishConfig);
  }

  for (const buildConfig of buildConfigs) {
    await _build(
      resolvedRootDir,
      inputConfig,
      buildConfig,
      pkg,
      cleanedDirs,
      _transpileStubMode,
      _transpileWatchMode,
      outDir,
      inputConfig.showOutLog || true,
      isLib,
    );
  }
}

async function _build(
  rootDir: string,
  inputConfig: UnifiedBuildConfig,
  buildConfig: UnifiedBuildConfig,
  pkg: PackageJson & Partial<Record<"build" | "dler", UnifiedBuildConfig>>,
  cleanedDirs: string[],
  _transpileStubMode: boolean,
  _transpileWatchMode: boolean,
  outDir: string,
  showOutLog: boolean,
  isLib: boolean,
): Promise<void> {
  // Start timing the build process
  const timer = createPerfTimer();

  // Resolve preset
  const preset = await resolvePreset(
    buildConfig.preset || pkg.dler?.preset || pkg.build?.preset || inputConfig.preset || "auto",
    rootDir,
  );

  // Merge options
  const options = defu(buildConfig, pkg.dler || pkg.build, inputConfig, preset, {
    alias: {},
    clean: false,
    declaration: undefined,
    dependencies: [],
    devDependencies: [],
    entries: [],
    externals: [...Module.builtinModules, ...Module.builtinModules.map((m) => `node:${m}`)],
    transpileFailOnWarn: true,
    name: (pkg?.name || "").split("/").pop() || "default",
    outDir: outDir,
    parallel: false,
    peerDependencies: [],
    replace: {},
    rollup: {
      alias: {},
      cjsBridge: false,
      commonjs: {
        ignoreTryCatch: true,
      },
      dts: {
        compilerOptions: {
          /**
           * @see https://github.com/Swatinem/rollup-plugin-dts/issues/127
           */
          composite: false,
          /**
           * @see https://github.com/Swatinem/rollup-plugin-dts/issues/143
           */
          preserveSymlinks: false,
        },
        respectExternal: true,
      },
      emitCJS: false,
      esbuild: { target: "esnext" },
      inlineDependencies: false,
      json: {
        preferConst: true,
      },
      output: {
        /**
         * @see https://v8.dev/features/import-attributes
         */
        importAttributesKey: "with",
      },
      preserveDynamicImports: true,
      // Plugins
      replace: {
        preventAssignment: true,
      },
      resolve: {
        preferBuiltins: true,
      },
      watch: false,
    },
    rootDir,
    showOutLog: true,
    transpileSourcemap: false,
    transpileStub: _transpileStubMode,
    transpileStubOptions: {
      /**
       * @see https://github.com/unjs/jiti#%EF%B8%8F-options
       */
      jiti: {
        alias: {},
        interopDefault: true,
      },
    },
    transpileWatch: _transpileWatchMode,
    transpileWatchOptions: _transpileWatchMode
      ? {
          exclude: "node_modules/**",
          include: "src/**",
        }
      : undefined,
    isLib,
  } satisfies BuildOptions) as BuildOptions;
  shouldStopAtStep(5);
  relinka("info", "Configuration merged with defaults"); // Step 5
  relinka("verbose", `Build options: clean=${options.clean}, parallel=${options.parallel}`);
  relinka("verbose", `Declaration files: ${options.declaration ? "enabled" : "disabled"}`);

  // Resolve dirs relative to rootDir
  options.outDir = resolve(options.rootDir, options.outDir);

  // Create shared jiti instance for context
  const jiti = createJiti(options.rootDir, { interopDefault: true });

  // Build context
  const ctx: BuildContext = {
    buildEntries: [],
    hooks: createHooks(),
    jiti,
    options,
    pkg,
    usedImports: new Set(),
    warnings: new Set(),
    isLib,
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
    typeof entry === "string" ? { input: entry, isLib } : entry,
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
    entry.isLib = isLib;
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
    "verbose",
    `${options.transpileStub ? "Stubbing" : "[unified] Building"} ${options.name}`,
  );
  if (process.env.DEBUG) {
    relinka(
      "log",
      `Root dir: ${options.rootDir}
Entries:
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
      relinka("log", `Cleaning dist directory: \`./${relative(process.cwd(), dir)}\``);
      await rmdir(dir);
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  // Try to selflink
  // if (ctx.transpileStub && ctx.pkg.name) {
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

  // Skip rest for transpileStub and transpileWatch mode
  if (options.transpileStub || options.transpileWatch) {
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
        chunk: true,
        path: file,
        isLib: ctx.options.isLib,
      };
      ctx.buildEntries.push(entry);
    }
    if (!entry.bytes) {
      const stat = await fsp.stat(resolve(options.outDir, file));
      entry.bytes = stat.size;
    }
  }

  const rPath = (p: string): string => relative(process.cwd(), resolve(options.outDir, p));

  if (showOutLog) {
    for (const entry of ctx.buildEntries.filter((e) => !e.chunk)) {
      let totalBytes = entry.bytes || 0;
      for (const chunk of entry.chunks || []) {
        totalBytes += ctx.buildEntries.find((e) => e.path === chunk)?.bytes || 0;
      }
      let line = `  ${rPath(entry.path)} (${[
        totalBytes && `total size: ${prettyBytes(totalBytes)}`,
        entry.bytes && `chunk size: ${prettyBytes(entry.bytes)}`,
        entry.exports?.length && `exports: ${entry.exports.join(", ")}`,
      ]
        .filter(Boolean)
        .join(", ")})`;

      if (entry.chunks?.length) {
        line += `\n${entry.chunks
          .map((p) => {
            const chunk = ctx.buildEntries.find((e) => e.path === p) || ({} as any);
            return `  └─ ${rPath(p)}${chunk.bytes ? ` (${prettyBytes(chunk.bytes)})` : ""}`;
          })
          .join("\n")}`;
      }

      if (entry.modules?.length) {
        line += `\n${entry.modules
          .filter((m) => m.id.includes("node_modules"))
          .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
          .map((m) => {
            return `  📦 ${rPath(m.id)}${m.bytes ? ` (${prettyBytes(m.bytes)})` : ""}`;
          })
          .join("\n")}`;
      }

      relinka("log", entry.chunk ? line : line);
    }

    // Calculate elapsed time
    const elapsedTime = getElapsedPerfTime(timer);
    const transpileFormattedTime = prettyMilliseconds(elapsedTime, {
      verbose: true,
    });

    relinka(
      "info",
      `Σ Total dist size: ${prettyBytes(ctx.buildEntries.reduce((a, e) => a + (e.bytes || 0), 0))} (build time: ${transpileFormattedTime})`,
    );
  }

  // Validate
  validateDependencies(ctx);
  validatePackage(pkg, rootDir, ctx);

  // Call build:done
  await ctx.hooks.callHook("build:done", ctx);

  if (ctx.warnings.size > 0) {
    relinka(
      "warn",
      `Build is done with some warnings:\n\n${[...ctx.warnings]
        .map((msg) => `- ${msg}`)
        .join("\n")}`,
    );
    if (ctx.options.transpileFailOnWarn) {
      relinka(
        "error",
        "Exiting with code (1). You can change this behavior by setting `transpileFailOnWarn: false` .",
      );
      process.exit(1);
    }
    shouldStopAtStep(15);
    relinka("info", `Build complete (with ${ctx.warnings.size} warnings)`); // Step 15
  }
}
