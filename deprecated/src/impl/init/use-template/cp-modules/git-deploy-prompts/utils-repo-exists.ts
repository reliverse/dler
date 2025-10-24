import { relinka } from "@reliverse/relinka";
import { simpleGit } from "simple-git";
import { cliName } from "~/impl/config/constants";
import { migrateReliverseConfig } from "~/impl/config/migrate";
import type { ReliverseConfig } from "~/impl/schema/mod";
import type { GitModParams } from "~/impl/types/mod";
import { getEffectiveDir } from "~/impl/utils/getEffectiveDir";
import type { RepoOption } from "~/impl/utils/projectRepository";
import { handleReplacements } from "~/impl/utils/replacements/reps-mod";
import type { ReliverseMemory } from "~/impl/utils/schemaMemory";

import { handleExistingRepoContent } from "./utils-private-repo";

export async function handleExistingRepo(
  params: GitModParams & {
    memory: ReliverseMemory;
    config: ReliverseConfig;
    githubUsername: string;
    selectedTemplate: RepoOption;
  },
  shouldCommitAndPush: boolean,
  isDev: boolean,
): Promise<boolean> {
  const effectiveDir = getEffectiveDir(params);

  relinka(
    "info",
    `Using existing repo: ${params.githubUsername}/${params.projectName}`,
  );

  const { success: repoSuccess, externalReliverseConfig } =
    await handleExistingRepoContent(
      params.memory,
      params.githubUsername,
      params.projectName,
      effectiveDir,
    );

  if (!repoSuccess) {
    throw new Error("Failed to handle existing repository content");
  }

  // If we have a rsesonc file, migrate its data
  if (externalReliverseConfig) {
    await migrateReliverseConfig(externalReliverseConfig, effectiveDir, isDev);
  }

  // Run replacements after rsesonc
  // migration (even if migration failed)
  await handleReplacements(
    effectiveDir,
    params.selectedTemplate,
    "",
    {
      ...params.config,
      projectName: params.projectName,
      frontendUsername: params.githubUsername,
      primaryDomain: `${params.projectName}.com`,
    },
    true,
    false,
    false,
  );

  if (shouldCommitAndPush) {
    // Create Octokit instance with GitHub token
    if (!params.memory.githubKey) {
      throw new Error("GitHub token not found");
    }

    // Add and commit all files in the working directory
    const git = simpleGit({ baseDir: effectiveDir });
    await git.add(".");
    await git.commit(`Update by ${cliName}`);

    // Get the latest commit details
    const latestCommit = await git.log({ maxCount: 1 });
    if (!latestCommit.latest) {
      throw new Error("Failed to get latest commit");
    }

    // Push the commit
    try {
      await git.push("origin", "main");
      relinka("success", "Created and pushed new commit with changes");
      return true;
    } catch (error) {
      relinka(
        "error",
        "Failed to push commit:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  return true;
}
