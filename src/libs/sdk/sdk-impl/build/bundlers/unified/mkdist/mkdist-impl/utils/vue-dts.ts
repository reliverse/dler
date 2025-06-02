import type { CreateProgramOptions } from "typescript";

import { relinka } from "@reliverse/relinka";
import { createRequire } from "node:module";
import { satisfies } from "semver";

import type { MkdistOptions } from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/make";

import type { DeclarationOutput } from "./dts";

import { augmentWithDiagnostics, extractDeclarations } from "./dts";

const require = createRequire(import.meta.url);

export async function getVueDeclarations(
  vfs: Map<string, string>,
  opts?: MkdistOptions,
): Promise<DeclarationOutput> {
  relinka("verbose", "Starting Vue declarations generation");

  const fileMapping = getFileMapping(vfs);
  const srcFiles = Object.keys(fileMapping);
  const originFiles = Object.values(fileMapping);
  if (originFiles.length === 0) {
    relinka("verbose", "No Vue files found to process");
    return {};
  }

  relinka("verbose", `Found ${originFiles.length} Vue files to process`);

  const { readPackageJSON } = await import("pkg-types"); // TODO
  const pkgInfo = await readPackageJSON("vue-tsc").catch(() => {});
  if (!pkgInfo) {
    relinka("verbose", "vue-tsc not found, skipping Vue SFC declarations");
    console.warn("[mkdist] Please install `vue-tsc` to generate Vue SFC declarations.");
    return {};
  }

  const { version } = pkgInfo;
  if (!version) {
    relinka("verbose", "Could not determine vue-tsc version");
    console.warn("[mkdist] Could not determine vue-tsc version.");
    return {};
  }

  relinka("verbose", `Using vue-tsc version: ${version}`);

  let output: DeclarationOutput;
  switch (true) {
    case satisfies(version, "^1.8.27"): {
      relinka("verbose", "Using vue-tsc v1.x emitter");
      output = await emitVueTscV1(vfs, srcFiles, originFiles, opts);
      break;
    }
    case satisfies(version, "~v2.0.0"): {
      relinka("verbose", "Using vue-tsc v2.x emitter");
      output = await emitVueTscV2(vfs, srcFiles, originFiles, opts);
      break;
    }
    default: {
      relinka("verbose", "Using latest vue-tsc emitter");
      output = await emitVueTscLatest(vfs, srcFiles, originFiles, opts);
    }
  }

  relinka("verbose", "Completed Vue declarations generation");
  return output;
}

const SFC_EXT_RE = /\.vue\.[cm]?[jt]s$/;

function getFileMapping(vfs: Map<string, string>): Record<string, string> {
  const files: Record<string, string> = Object.create(null);
  for (const [srcPath] of vfs) {
    if (SFC_EXT_RE.test(srcPath)) {
      files[srcPath.replace(SFC_EXT_RE, ".vue")] = srcPath;
    }
  }
  return files;
}

async function emitVueTscV1(
  vfs: Map<string, string>,
  inputFiles: string[],
  originFiles: string[],
  opts?: MkdistOptions,
) {
  const vueTsc = await import("vue-tsc").then((r) => r.default || r).catch(() => undefined);

  if (!vueTsc) {
    throw new Error("Failed to import vue-tsc");
  }

  const ts = require("typescript") as typeof import("typescript/lib/tsserverlibrary");

  if (!opts?.typescript?.compilerOptions) {
    throw new Error("Missing TypeScript compiler options");
  }

  const tsHost = ts.createCompilerHost(opts.typescript.compilerOptions);
  const _tsSysWriteFile = ts.sys.writeFile;
  ts.sys.writeFile = (filename, content) => {
    vfs.set(filename, content);
  };
  const _tsSysReadFile = ts.sys.readFile;
  ts.sys.readFile = (filename, encoding) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _tsSysReadFile(filename, encoding);
  };

  try {
    const program = ts.createProgram({
      rootNames: inputFiles,
      options: opts.typescript.compilerOptions,
      host: tsHost,
    });

    const result = program.emit();
    const output = extractDeclarations(vfs, originFiles, opts);

    augmentWithDiagnostics(result, output, tsHost, ts);

    return output;
  } finally {
    ts.sys.writeFile = _tsSysWriteFile;
    ts.sys.readFile = _tsSysReadFile;
  }
}

async function emitVueTscV2(
  vfs: Map<string, string>,
  inputFiles: string[],
  originFiles: string[],
  opts?: MkdistOptions,
) {
  const { resolve: resolveModule } = await import("mlly");
  const ts: typeof import("typescript") = await import("typescript").then((r) => r.default || r);
  const requireFromVueTsc = createRequire(await resolveModule("vue-tsc"));
  const vueLanguageCore: typeof import("@vue/language-core2.0") =
    requireFromVueTsc("@vue/language-core");
  const volarTs: typeof import("@volar/typescript") = requireFromVueTsc("@volar/typescript");

  if (!opts?.typescript?.compilerOptions) {
    throw new Error("Missing TypeScript compiler options");
  }

  const tsHost = ts.createCompilerHost(opts.typescript.compilerOptions);
  tsHost.writeFile = (filename, content) => {
    vfs.set(filename, content);
  };
  const _tsReadFile = tsHost.readFile.bind(tsHost);
  tsHost.readFile = (filename) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _tsReadFile(filename);
  };
  const _tsFileExist = tsHost.fileExists.bind(tsHost);
  tsHost.fileExists = (filename) => {
    return vfs.has(filename) || _tsFileExist(filename);
  };

  const programOptions: CreateProgramOptions = {
    rootNames: inputFiles,
    options: opts.typescript.compilerOptions,
    host: tsHost,
  };

  const createProgram = volarTs.proxyCreateProgram(ts, ts.createProgram, (ts, options) => {
    const vueLanguagePlugin = vueLanguageCore.createVueLanguagePlugin<string>(
      ts,
      options.options,
      vueLanguageCore.createParsedCommandLineByJson(ts, ts.sys, ".", {}, undefined, true)
        .vueOptions,
      (id: string) => id,
    );
    return [vueLanguagePlugin];
  });

  const program = createProgram(programOptions);
  const result = program.emit();
  const output = extractDeclarations(vfs, originFiles, opts);

  augmentWithDiagnostics(result, output, tsHost, ts);

  return output;
}

async function emitVueTscLatest(
  vfs: Map<string, string>,
  inputFiles: string[],
  originFiles: string[],
  opts?: MkdistOptions,
) {
  const { resolve: resolveModule } = await import("mlly");
  const ts: typeof import("typescript") = await import("typescript").then((r) => r.default || r);
  const requireFromVueTsc = createRequire(await resolveModule("vue-tsc"));
  const vueLanguageCore: typeof import("@vue/language-core") =
    requireFromVueTsc("@vue/language-core");
  const volarTs: typeof import("@volar/typescript") = requireFromVueTsc("@volar/typescript");

  if (!opts?.typescript?.compilerOptions) {
    throw new Error("Missing TypeScript compiler options");
  }

  const tsHost = ts.createCompilerHost(opts.typescript.compilerOptions);
  tsHost.writeFile = (filename, content) => {
    vfs.set(filename, content);
  };
  const _tsReadFile = tsHost.readFile.bind(tsHost);
  tsHost.readFile = (filename) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _tsReadFile(filename);
  };
  const _tsFileExist = tsHost.fileExists.bind(tsHost);
  tsHost.fileExists = (filename) => {
    return vfs.has(filename) || _tsFileExist(filename);
  };

  const programOptions: CreateProgramOptions = {
    rootNames: inputFiles,
    options: opts.typescript.compilerOptions,
    host: tsHost,
  };

  if (!opts?.rootDir) {
    throw new Error("Missing rootDir in options");
  }

  const rootDir = opts.rootDir;
  const createProgram = volarTs.proxyCreateProgram(ts, ts.createProgram, (ts, options) => {
    const vueLanguagePlugin = vueLanguageCore.createVueLanguagePlugin<string>(
      ts,
      options.options,
      vueLanguageCore.createParsedCommandLineByJson(ts, ts.sys, rootDir, {}, undefined, true)
        .vueOptions,
      (id: string) => id,
    );
    return [vueLanguagePlugin];
  });

  const program = createProgram(programOptions);
  const result = program.emit();
  const output = extractDeclarations(vfs, originFiles, opts);

  augmentWithDiagnostics(result, output, tsHost, ts);

  return output;
}
