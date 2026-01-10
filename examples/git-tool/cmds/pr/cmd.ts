import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  description: "Create and manage pull requests",
  alias: "pull-request",
  options: {
    // PR title
    title: option(type("string"), {
      short: "t",
      description: "Pull request title",
    }),

    // PR description
    description: option(type("string"), {
      short: "d",
      description: "Pull request description",
    }),

    // Base branch
    base: option(type("string"), {
      short: "b",
      description: "Base branch to merge into",
    }),

    // Head branch
    head: option(type("string"), {
      short: "h",
      description: "Head branch (defaults to current branch)",
    }),

    // Draft PR
    draft: option(type("boolean"), {
      description: "Create as draft pull request",
    }),

    // Assign reviewers
    reviewers: option(type("string"), {
      short: "r",
      description: "Comma-separated list of reviewers",
    }),

    // Labels
    labels: option(type("string"), {
      short: "l",
      description: "Comma-separated list of labels",
    }),
  },

  handler: async ({ flags, colors, spinner, shell, prompt }) => {
    const { title, description, base, head, draft, reviewers, labels } = flags as {
      title: string;
      description: string | undefined;
      base: string;
      head: string | undefined;
      draft: boolean | undefined;
      reviewers: string | undefined;
      labels: string | undefined;
    };
    const spin = spinner("Creating pull request...");

    try {
      // Get current branch if head not specified
      const headBranch = head || (await shell`git branch --show-current`).toString().trim();

      // Check if we have uncommitted changes
      const { stdout: status } = await shell`git status --porcelain`;
      if (status.toString().trim()) {
        const commitChanges = await prompt.confirm(
          "You have uncommitted changes. Commit them before creating PR?",
          { default: true }
        );

        if (commitChanges) {
          const commitMessage = await prompt.text("Commit message:", {
            default: "WIP: prepare for PR",
          });

          await shell`git add .`;
          await shell`git commit -m ${commitMessage}`;
          console.log(relico.green("✅ Changes committed"));
        }
      }

      // Check if branch is pushed
      const { stdout: remoteStatus } = await shell`git status -sb`;
      if (!remoteStatus.toString().includes("ahead")) {
        const pushBranch = await prompt.confirm(`Push branch '${headBranch}' to remote?`, {
          default: true,
        });

        if (pushBranch) {
          spin.update("Pushing branch to remote...");
          await shell`git push -u origin ${headBranch}`;
          console.log(relico.green("✅ Branch pushed to remote"));
        }
      }

      // Generate PR description if not provided
      let prDescription = description;
      if (!prDescription) {
        // Get recent commits for description
        const { stdout: commits } = await shell`git log --oneline ${base}..${headBranch}`;
        const commitList = commits.toString().trim().split("\n").slice(0, 5);

        prDescription = `## Changes\n\n${commitList.map((commit: string) => `- ${commit}`).join("\n")}`;

        if (commits.toString().trim().split("\n").length > 5) {
          prDescription += `\n\n... and ${commits.toString().trim().split("\n").length - 5} more commits`;
        }
      }

      // Simulate PR creation (in real implementation, would use GitHub CLI or API)
      spin.update("Creating pull request...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const prNumber = Math.floor(Math.random() * 1000) + 1;
      const prUrl = `https://github.com/example/repo/pull/${prNumber}`;

      spin.succeed("✅ Pull request created!");

      console.log(relico.bold("\n📋 Pull Request Details:"));
      console.log(`  Title: ${relico.cyan(title)}`);
      console.log(`  Base: ${relico.cyan(base)} ← ${relico.cyan(headBranch)}`);
      console.log(`  Draft: ${relico.cyan(draft ? "Yes" : "No")}`);
      console.log(`  URL: ${relico.blue(prUrl)}`);

      if (reviewers) {
        const reviewersArray = reviewers.split(",").map((s) => s.trim());
        console.log(`  Reviewers: ${relico.cyan(reviewersArray.join(", "))}`);
      }

      if (labels) {
        const labelsArray = labels.split(",").map((s) => s.trim());
        console.log(`  Labels: ${relico.cyan(labelsArray.join(", "))}`);
      }

      console.log(relico.dim("\nDescription:"));
      console.log(relico.dim(prDescription));

      // Ask if user wants to open PR
      const openPR = await prompt.confirm("Open pull request in browser?", {
        default: false,
      });

      if (openPR) {
        console.log(relico.blue(`Opening ${prUrl}...`));
        // In real implementation: await shell`open ${prUrl}`
      }
    } catch (error) {
      spin.fail("Pull request creation failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  },
});
