import { join } from "@reliverse/pathkit";
import { existsSync, mkdir, readdir, unlink } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

interface BuildTarget {
  platform: string;
  arch: string;
  extension: string;
  target: string;
}

export interface BunBuildOptions {
  minify: boolean;
  sourcemap: boolean;
  bytecode: boolean;
  outdir: string;
  clean: boolean;
  windowsIcon?: string;
  windowsHideConsole: boolean;
  assetNaming: string;
  external?: string[];
  compile: boolean;
}

const TARGETS: BuildTarget[] = [
  { platform: "linux", arch: "x64", extension: "", target: "bun-linux-x64" },
  {
    platform: "linux",
    arch: "x64-baseline",
    extension: "",
    target: "bun-linux-x64-baseline",
  },
  {
    platform: "linux",
    arch: "x64-modern",
    extension: "",
    target: "bun-linux-x64-modern",
  },
  {
    platform: "linux",
    arch: "arm64",
    extension: "",
    target: "bun-linux-arm64",
  },
  {
    platform: "linux",
    arch: "x64-musl",
    extension: "",
    target: "bun-linux-x64-musl",
  },
  {
    platform: "linux",
    arch: "arm64-musl",
    extension: "",
    target: "bun-linux-arm64-musl",
  },
  {
    platform: "windows",
    arch: "x64",
    extension: ".exe",
    target: "bun-windows-x64",
  },
  {
    platform: "windows",
    arch: "arm64",
    extension: ".exe",
    target: "bun-windows-arm64",
  },
  {
    platform: "windows",
    arch: "x64-baseline",
    extension: ".exe",
    target: "bun-windows-x64-baseline",
  },
  {
    platform: "windows",
    arch: "x64-modern",
    extension: ".exe",
    target: "bun-windows-x64-modern",
  },
  { platform: "darwin", arch: "x64", extension: "", target: "bun-darwin-x64" },
  {
    platform: "darwin",
    arch: "arm64",
    extension: "",
    target: "bun-darwin-arm64",
  },
];

export const getOutputFileName = (
  target: BuildTarget,
  baseName: string,
  isCompiled: boolean,
): string => {
  // Always include the architecture in the filename for clarity
  const suffix = `-${target.arch}`;
  const extension = isCompiled ? target.extension : ".js";
  return `${baseName}-${target.platform}${suffix}${extension}`;
};

export const buildForTarget = async (
  target: BuildTarget,
  inputFile: string,
  options: BunBuildOptions,
): Promise<void> => {
  const outputFile = join(
    options.outdir,
    getOutputFileName(target, "dler", options.compile),
  );

  const buildArgs = [
    "build",
    ...(options.compile ? ["--compile", `--target=${target.target}`] : []),
    inputFile,
    `--outfile=${outputFile}`,
  ];

  if (options.minify) {
    buildArgs.push("--minify");
  }

  if (options.sourcemap) {
    buildArgs.push("--sourcemap");
  }

  if (options.bytecode) {
    buildArgs.push("--bytecode");
  }

  if (options.assetNaming !== "[name]-[hash].[ext]") {
    buildArgs.push(`--asset-naming=${options.assetNaming}`);
  }

  // External dependencies
  if (options.external && options.external.length > 0) {
    for (const ext of options.external) {
      buildArgs.push(`--external=${ext}`);
    }
  }

  // Windows-specific flags
  if (target.platform === "windows") {
    if (options.windowsIcon && existsSync(options.windowsIcon)) {
      buildArgs.push(`--windows-icon=${options.windowsIcon}`);
    }
    if (options.windowsHideConsole) {
      buildArgs.push("--windows-hide-console");
    }
  }

  relinka("info", `Building for ${target.platform}-${target.arch}...`);

  try {
    const proc = Bun.spawn(["bun", ...buildArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      relinka("error", `Build failed for ${target.platform}-${target.arch}:`);
      if (stderr) relinka("error", stderr);
      if (stdout) relinka("error", stdout);
      throw new Error(`Build failed with exit code ${exitCode}`);
    }

    relinka("success", `✅ Built: ${outputFile}`);

    if (stdout.includes("bundle")) {
      const bundleMatch = stdout.match(/bundle (\d+) modules/);
      const compileMatch = stdout.match(/compile .* \[(\d+ms)\]/);

      if (bundleMatch || compileMatch) {
        const bundleInfo = bundleMatch ? `${bundleMatch[1]} modules` : "";
        const compileInfo = compileMatch ? `${compileMatch[1]}` : "";
        relinka("verbose", `  ${bundleInfo} ${compileInfo}`.trim());
      }
    }
  } catch (error) {
    relinka(
      "error",
      `Failed to build for ${target.platform}-${target.arch}: ${error}`,
    );
    throw error;
  }
};

export const cleanOutputDir = async (outdir: string): Promise<void> => {
  if (existsSync(outdir)) {
    relinka("info", `Cleaning dler-* files from output directory: ${outdir}`);

    try {
      const entries = await readdir(outdir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith("dler-")) {
          const filePath = join(outdir, entry.name);
          await unlink(filePath);
          relinka("verbose", `Deleted: ${entry.name}`);
        }
      }
    } catch (error) {
      relinka("warn", `Failed to clean dler-* files: ${error}`);
    }
  } else {
    await mkdir(outdir, { recursive: true });
  }
};

export const validateInputFile = (inputFile: string): void => {
  if (!existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`);
  }
};

export const parseTargets = (targetStr: string): BuildTarget[] => {
  if (targetStr === "all") {
    return TARGETS;
  }

  const requestedTargets = targetStr.split(",").map((t) => t.trim());
  const validTargets: BuildTarget[] = [];

  for (const requested of requestedTargets) {
    const exactMatch = TARGETS.find(
      (target) =>
        target.target === requested ||
        `${target.platform}-${target.arch}` === requested ||
        target.platform === requested,
    );

    if (exactMatch) {
      validTargets.push(exactMatch);
      continue;
    }

    // If platform only, add all variants
    const platformTargets = TARGETS.filter((t) => t.platform === requested);
    if (platformTargets.length > 0) {
      validTargets.push(...platformTargets);
    } else {
      relinka("warn", `Unknown target: ${requested}`);
    }
  }

  return validTargets.length > 0 ? validTargets : [TARGETS[0]!]; // Default to first target
};

export const listAvailableTargets = (): void => {
  relinka("info", "Available targets:");
  for (const target of TARGETS) {
    const name = `${target.platform}-${target.arch}`;
    relinka("info", `  ${target.target.padEnd(25)} (${name})`);
  }
};
