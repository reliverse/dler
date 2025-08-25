import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import { spinner } from "@reliverse/rempts";
import { $ } from "execa";

import type { Addons, PackageManager } from "~/app/providers/better-t-stack/types";

export async function installDependencies({
  projectDir,
  packageManager,
}: {
  projectDir: string;
  packageManager: PackageManager;
  addons?: Addons[];
}) {
  const s = spinner({
    text: `Running ${packageManager} install...`,
  });

  try {
    s.start(`Running ${packageManager} install...`);

    await $({
      cwd: projectDir,
      stderr: "inherit",
    })`${packageManager} install`;

    s.stop("Dependencies installed successfully");
  } catch (error) {
    s.stop(re.red("Failed to install dependencies"));
    if (error instanceof Error) {
      relinka("error", re.red(`Installation error: ${error.message}`));
    }
  }
}
