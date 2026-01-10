import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

export default defineCommand({
  description: "Create, switch, or manage branches",
  alias: "br",
  options: {
    // Branch name
    name: option(type("string | undefined"), {
      short: "n",
      description: "Branch name",
    }),

    // Base branch
    base: option(type("string | undefined"), {
      short: "b",
      description: "Base branch to create from",
    }),

    // Switch to branch
    switch: option(type("boolean | undefined"), {
      short: "s",
      description: "Switch to the branch after creating",
    }),

    // Delete branch
    delete: option(type("boolean | undefined"), {
      short: "d",
      description: "Delete the branch",
    }),

    // Force operations
    force: option(type("boolean | undefined"), {
      short: "f",
      description: "Force the operation",
    }),
  },

  handler: async ({ flags, colors: _colors, spinner, shell }) => {
    const {
      name,
      base,
      switch: switchFlag,
      delete: deleteFlag,
      force,
    } = flags as {
      name: string;
      base: string;
      switch: boolean;
      delete: boolean;
      force: boolean;
    };
    const spin = spinner("Working with branches...");

    try {
      if (deleteFlag) {
        // Delete branch
        spin.update(`Deleting branch '${name}'...`);

        if (!force) {
          // Check if branch exists
          const { stdout: branches } = await shell`git branch --list ${name}`;
          if (!branches.toString().trim()) {
            throw new Error(`Branch '${name}' does not exist`);
          }

          // Check if it's the current branch
          const { stdout: currentBranch } = await shell`git branch --show-current`;
          if (currentBranch.toString().trim() === name) {
            throw new Error(
              `Cannot delete current branch '${name}'. Switch to another branch first.`
            );
          }
        }

        await shell`git branch ${force ? "-D" : "-d"} ${name}`;
        spin.succeed(`✅ Deleted branch '${name}'`);
      } else {
        // Create or switch branch
        spin.update(`Creating branch '${name}' from '${base}'...`);

        // Check if branch already exists
        const { stdout: existingBranches } = await shell`git branch --list ${name}`;
        if (existingBranches.toString().trim() && !force) {
          throw new Error(`Branch '${name}' already exists. Use --force to overwrite.`);
        }

        // Create branch
        if (force && existingBranches.toString().trim()) {
          await shell`git branch -D ${name}`;
        }

        await shell`git checkout -b ${name} ${base}`;

        if (!switchFlag) {
          // Switch back to original branch
          await shell`git checkout ${base}`;
        }

        spin.succeed(`✅ Created branch '${name}' from '${base}'`);

        if (switchFlag) {
          console.log(relico.cyan(`Switched to branch '${name}'`));
        }
      }

      // Show branch status
      const { stdout: currentBranch } = await shell`git branch --show-current`;
      const { stdout: allBranches } = await shell`git branch --list`;

      console.log(relico.bold("\n📋 Branch Status:"));
      console.log(`  Current: ${relico.cyan(currentBranch.toString().trim())}`);
      console.log(
        `  Branches: ${relico.dim(String(allBranches.toString().trim().split("\n").length))} total`
      );
    } catch (error) {
      spin.fail("Branch operation failed");
      console.error(relico.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  },
});
