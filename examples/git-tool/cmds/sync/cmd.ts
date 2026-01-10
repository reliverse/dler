import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  description: "Sync with upstream repository",
  alias: "pull",
  options: {
    // Remote name
    remote: option(type("string"), {
      short: "r",
      description: "Remote name to sync with",
    }),

    // Branch to sync
    branch: option(type("string"), {
      short: "b",
      description: "Branch to sync (defaults to current branch)",
    }),

    // Force sync
    force: option(type("boolean"), {
      short: "f",
      description: "Force sync even if there are conflicts",
    }),

    // Rebase instead of merge
    rebase: option(type("boolean"), {
      description: "Use rebase instead of merge",
    }),

    // Prune remote branches
    prune: option(type("boolean"), {
      short: "p",
      description: "Remove remote-tracking branches that no longer exist",
    }),
  },

  handler: async ({ flags, colors, spinner, shell, prompt }) => {
    const { remote, branch, force, rebase, prune } = flags as {
      remote: string;
      branch: string | undefined;
      force: boolean;
      rebase: boolean;
      prune: boolean;
    };
    const spin = spinner("Syncing with remote...");

    try {
      // Get current branch if not specified
      const currentBranch =
        branch || (await shell`git branch --show-current`).stdout.toString().trim();

      // Check if we have uncommitted changes
      const { stdout: status } = await shell`git status --porcelain`;
      if (status.toString().trim() && !force) {
        const stashChanges = await prompt.confirm(
          "You have uncommitted changes. Stash them before syncing?",
          { default: true }
        );

        if (stashChanges) {
          spin.update("Stashing changes...");
          await shell`git stash push -m "Auto-stash before sync"`;
          console.log(relico.yellow("📦 Changes stashed"));
        }
      }

      // Fetch latest changes
      spin.update("Fetching latest changes...");
      await shell`git fetch ${remote}`;

      if (prune) {
        spin.update("Pruning remote branches...");
        await shell`git remote prune ${remote}`;
        console.log(relico.green("🧹 Pruned remote branches"));
      }

      // Check if there are incoming changes
      const { stdout: behind } = await shell`git rev-list --count HEAD..${remote}/${currentBranch}`;
      const { stdout: ahead } = await shell`git rev-list --count ${remote}/${currentBranch}..HEAD`;

      const behindCount = Number.parseInt(behind.toString().trim(), 10);
      const aheadCount = Number.parseInt(ahead.toString().trim(), 10);

      if (behindCount === 0 && aheadCount === 0) {
        spin.succeed("✅ Already up to date");
        console.log(relico.green("No changes to sync"));
        return;
      }

      console.log(relico.bold("\n📊 Sync Status:"));
      console.log(`  Behind: ${relico.red(String(behindCount))} commits`);
      console.log(`  Ahead: ${relico.green(String(aheadCount))} commits`);

      if (behindCount > 0) {
        // Pull changes
        spin.update("Pulling changes...");

        if (rebase) {
          await shell`git pull --rebase ${remote} ${currentBranch}`;
          console.log(relico.green("✅ Rebased successfully"));
        } else {
          await shell`git pull ${remote} ${currentBranch}`;
          console.log(relico.green("✅ Merged successfully"));
        }
      }

      if (aheadCount > 0) {
        // Push local changes
        const pushChanges = await prompt.confirm(`Push ${aheadCount} local commits to ${remote}?`, {
          default: true,
        });

        if (pushChanges) {
          spin.update("Pushing changes...");
          await shell`git push ${remote} ${currentBranch}`;
          console.log(relico.green("✅ Pushed successfully"));
        }
      }

      // Restore stashed changes if any
      const { stdout: stashList } = await shell`git stash list`;
      if (stashList.includes("Auto-stash before sync")) {
        const restoreStash = await prompt.confirm("Restore stashed changes?", {
          default: true,
        });

        if (restoreStash) {
          spin.update("Restoring stashed changes...");
          await shell`git stash pop`;
          console.log(relico.green("✅ Stashed changes restored"));
        }
      }

      spin.succeed("✅ Sync completed successfully!");

      // Show final status
      const { stdout: finalStatus } = await shell`git status -sb`;
      console.log(relico.bold("\n📋 Final Status:"));
      console.log(relico.dim(finalStatus.toString()));
    } catch (error) {
      spin.fail("Sync failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));

      // Check if there are conflicts
      const { stdout: conflictStatus } = await shell`git status --porcelain`;
      if (conflictStatus.includes("UU") || conflictStatus.includes("AA")) {
        console.log(relico.yellow("\n⚠️  Merge conflicts detected. Resolve them and try again."));
        console.log(relico.dim('Use "git status" to see conflicted files'));
      }
    }
  },
});
