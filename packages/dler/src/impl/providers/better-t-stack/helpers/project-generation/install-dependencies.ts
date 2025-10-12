import { re } from "@reliverse/relico";
import { relinka } from "@reliverse/relinka";
import { createSpinner } from "@reliverse/rempts";
import { $ } from "execa";

import type { Addons, PackageManager } from "~/impl/providers/better-t-stack/types";

export async function installDependencies({
  projectDir,
  packageManager,
}: {
  projectDir: string;
  packageManager: PackageManager;
  addons?: Addons[];
}) {
  const s = createSpinner({
    text: `Running ${packageManager} install...`,
  });

  try {
    s.start(`Running ${packageManager} install...`);

    await $({
      cwd: projectDir,
      stderr: "inherit",
    })`${packageManager} install`;

    s.succeed("Dependencies installed successfully");
  } catch (error) {
    s.fail(re.red("Failed to install dependencies"));
    if (error instanceof Error) {
      relinka("error", re.red(`Installation error: ${error.message}`));
    }
  }
}
