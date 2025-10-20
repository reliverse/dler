import type { MonorepoConfig, PackageInfo } from "./types";
import {
  validateMonorepoName,
  validatePackageName,
  validateVersion,
} from "./validators";
import { DEFAULT_LICENSE, DEFAULT_VERSION, WORKSPACES } from "./config";
import { createFullPath, fileExists, getWorkspaceScope } from "./utils";
import { askQuestion } from "@reliverse/dler-prompts";

const writeLine = (text: string): void => {
  Bun.write(Bun.stdout, `${text}\n`);
};

export const promptMonorepoConfig = async (): Promise<MonorepoConfig> => {
  writeLine("🚀 Bun Monorepo Bootstrapper\n");

  // Try to read existing root package.json to avoid re-asking known values
  const rootPath = process.cwd();
  const rootPackageJsonPath = createFullPath(rootPath, "package.json");
  const hasRootPackageJson = await fileExists(rootPackageJsonPath);
  const existingRoot: Record<string, unknown> | null = hasRootPackageJson
    ? await Bun.file(rootPackageJsonPath).json().catch(() => null)
    : null;

  let name = "";
  let isValidName = false;

  if (existingRoot && typeof existingRoot.name === "string") {
    name = existingRoot.name;
    isValidName = true;
  } else {
    while (!isValidName) {
      name = await askQuestion("Monorepo name", "my-monorepo");
      const validation = validateMonorepoName(name);

      if (!validation.valid) {
        writeLine(`❌ ${validation.error}`);
        continue;
      }

      isValidName = true;
    }
  }

  const description =
    (existingRoot && typeof existingRoot.description === "string"
      ? (existingRoot.description as string)
      : await askQuestion("Description", "A Bun monorepo project"));

  let version = "";
  let isValidVersion = false;

  if (existingRoot && typeof existingRoot.version === "string") {
    version = existingRoot.version;
    isValidVersion = true;
  } else {
    while (!isValidVersion) {
      version = await askQuestion("Version", DEFAULT_VERSION);
      const validation = validateVersion(version);

      if (!validation.valid) {
        writeLine(`❌ ${validation.error}`);
        continue;
      }

      isValidVersion = true;
    }
  }

  const author =
    (existingRoot && typeof (existingRoot as any).author === "string"
      ? ((existingRoot as any).author as string)
      : await askQuestion("Author", ""));
  const license =
    (existingRoot && typeof (existingRoot as any).license === "string"
      ? ((existingRoot as any).license as string)
      : await askQuestion("License", DEFAULT_LICENSE));

  const packages = await promptPackages();

  return {
    name,
    description,
    version,
    author,
    license,
    packages,
    rootPath,
  };
};

const promptPackages = async (): Promise<PackageInfo[]> => {
  const packages: PackageInfo[] = [];

  writeLine("\n📦 Package Configuration");
  writeLine(
    "Enter package names (one per prompt). Press Enter with empty input to finish.\n",
  );

  let continueAdding = true;
  let packageIndex = 1;

  while (continueAdding) {
    const packageName = await askQuestion(
      `Package ${packageIndex} name (or press Enter to finish)`,
    );

    if (!packageName) {
      continueAdding = false;
      continue;
    }

    const validation = validatePackageName(packageName);

    if (!validation.valid) {
      writeLine(`❌ ${validation.error}`);
      continue;
    }

    const workspace = await askQuestion(
      "Workspace directory",
      WORKSPACES.PACKAGES,
    );
    const scope = getWorkspaceScope(workspace);

    packages.push({
      name: packageName,
      workspace,
      scope,
    });

    writeLine(`✅ Added ${scope}${packageName}\n`);
    packageIndex++;
  }

  return packages;
};
