import path from "node:path";
import { re } from "@reliverse/relico";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createSpinner } from "@reliverse/rempts";
import { execa } from "execa";

import type { ProjectConfig } from "~/impl/providers/better-t-stack/types";

import { addPackageDependency } from "~/impl/providers/better-t-stack/utils/add-package-deps";
import { getPackageExecutionCommand } from "~/impl/providers/better-t-stack/utils/get-package-execution-command";

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  workspaces?: string[];
  packageManager?: string;
  "lint-staged"?: Record<string, string[]>;
}

export async function setupTauri(config: ProjectConfig): Promise<void> {
  const { packageManager, frontend, projectDir } = config;
  const s = createSpinner({
    text: "Setting up Tauri desktop app support...",
  });
  const clientPackageDir = path.join(projectDir, "apps/web");

  if (!(await fs.pathExists(clientPackageDir))) {
    return;
  }

  try {
    s.start("Setting up Tauri desktop app support...");

    await addPackageDependency({
      devDependencies: ["@tauri-apps/cli"],
      projectDir: clientPackageDir,
    });

    const clientPackageJsonPath = path.join(clientPackageDir, "package.json");
    if (await fs.pathExists(clientPackageJsonPath)) {
      const packageJson = (await fs.readJson(
        clientPackageJsonPath,
      )) as PackageJson;

      packageJson.scripts = {
        ...packageJson.scripts,
        tauri: "tauri",
        "desktop:dev": "tauri dev",
        "desktop:build": "tauri build",
      };

      await fs.writeJson(clientPackageJsonPath, packageJson, { spaces: 2 });
    }

    const hasReactRouter = frontend.includes("react-router");
    const hasNuxt = frontend.includes("nuxt");
    const hasSvelte = frontend.includes("svelte");
    const hasNext = frontend.includes("next");

    const devUrl =
      hasReactRouter || hasSvelte
        ? "http://localhost:5173"
        : hasNext
          ? "http://localhost:3001"
          : "http://localhost:3001";

    const frontendDist = hasNuxt
      ? "../.output/public"
      : hasSvelte
        ? "../build"
        : hasNext
          ? "../.next"
          : hasReactRouter
            ? "../build/client"
            : "../dist";

    const tauriArgs = [
      "init",
      `--app-name=${path.basename(projectDir)}`,
      `--window-title=${path.basename(projectDir)}`,
      `--frontend-dist=${frontendDist}`,
      `--dev-url=${devUrl}`,
      `--before-dev-command="${packageManager} run dev"`,
      `--before-build-command="${packageManager} run build"`,
    ];
    const tauriArgsString = tauriArgs.join(" ");

    const commandWithArgs = `@tauri-apps/cli@latest ${tauriArgsString}`;

    const tauriInitCommand = getPackageExecutionCommand(
      packageManager,
      commandWithArgs,
    );

    await execa(tauriInitCommand, {
      cwd: clientPackageDir,
      env: {
        CI: "true",
      },
      shell: true,
    });

    s.succeed("Tauri desktop app support configured successfully!");
  } catch (error) {
    s.fail(re.red("Failed to set up Tauri"));
    if (error instanceof Error) {
      relinka("error", error.message);
    }
  }
}
