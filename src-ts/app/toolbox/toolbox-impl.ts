import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { confirmPrompt } from "@reliverse/rempts";
import { FALLBACK_ENV_EXAMPLE_URL } from "~/app/config/constants";
import { composeEnvFile } from "~/app/init/use-template/cp-modules/compose-env-file/cef-mod";
import { promptGitDeploy } from "~/app/init/use-template/cp-modules/git-deploy-prompts/gdp-mod";
import type { ReliverseConfig } from "~/app/schema/mod";
import { downloadRepo } from "~/app/utils/downloading/downloadRepo";
import type { RepoOption } from "~/app/utils/projectRepository";
import { askProjectName } from "~/app/utils/prompts/askProjectName";
import { askUsernameFrontend } from "~/app/utils/prompts/askUsernameFrontend";
import type { ReliverseMemory } from "~/app/utils/schemaMemory";
import { cd, pwd, rm } from "~/app/utils/terminalHelpers";

export async function rmTestsRuntime(cwd: string) {
  const TestsRuntimePath = path.join(cwd, "tests-runtime");
  if (await fs.pathExists(TestsRuntimePath)) {
    const shouldRemoveTestsRuntime = await confirmPrompt({
      title: "Are you sure you want to remove the tests-runtime folder?",
    });
    if (shouldRemoveTestsRuntime) {
      await rm(TestsRuntimePath);
    }
  }
}

export async function downloadRepoOption(
  template: RepoOption,
  config: ReliverseConfig,
  memory: ReliverseMemory,
  isDev: boolean,
  cwd: string,
  skipPrompts: boolean,
) {
  const projectName = await askProjectName({ repoName: "" });
  const primaryDomain = `${projectName}.vercel.app`;
  const { dir } = await downloadRepo({
    repoURL: template,
    projectName,
    isDev,
    cwd,
    isTemplateDownload: false,
  });

  relinka("info", `Downloaded template to ${dir}`);
  await cd(dir);
  pwd();

  const maskInput = await confirmPrompt({
    title: "Do you want to mask secret inputs (e.g., GitHub token) in the next steps?",
    content: "Regardless of your choice, your data will be securely stored on your device.",
  });

  await composeEnvFile(
    dir,
    FALLBACK_ENV_EXAMPLE_URL,
    maskInput,
    skipPrompts,
    config,
    false, // isMrse
  );

  const frontendUsername = await askUsernameFrontend(config, false);
  if (!frontendUsername) {
    throw new Error(
      "Failed to determine your frontend username. Please try again or notify the CLI developers.",
    );
  }

  const { deployService } = await promptGitDeploy({
    isLib: false,
    projectName,
    config,
    projectPath: dir,
    primaryDomain,
    hasDbPush: false,
    shouldRunDbPush: false,
    shouldInstallDeps: false,
    isDev: true,
    memory,
    cwd,
    maskInput: false,
    skipPrompts: false,
    selectedTemplate: "blefnk/relivator-nextjs-template",
    isTemplateDownload: false,
    frontendUsername,
  });

  if (deployService === "none") {
    relinka("info", "Skipping deploy process...");
  } else {
    relinka("success", `Project deployed successfully to ${primaryDomain}`);
  }
}
