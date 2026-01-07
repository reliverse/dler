import type { HandlerArgs } from "@reliverse/rempts-core";
import { createProject } from "./create-project";
import path from "node:path";
import { relico } from "@reliverse/relico";

interface CreateOptions {
  name: string | undefined;
  template: string;
  dir: string | undefined;
  git: boolean;
  install: boolean;
  offline: boolean | undefined;
}

export async function create(context: HandlerArgs<CreateOptions>) {
  const { flags, positional, prompt, spinner, colors, shell } = context;

  // Get project name
  let projectName = positional[0] || flags.name;
  if (!projectName) {
    projectName = await prompt("Project name:", {
      validate: (value) => {
        if (!value) return "Project name is required";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Project name must only contain lowercase letters, numbers, and hyphens";
        }
        return true;
      },
    });
  } else if (!/^[a-z0-9-]+$/.test(projectName)) {
    console.error(
      relico.red("Project name must only contain lowercase letters, numbers, and hyphens"),
    );
    process.exit(1);
  }

  // Get directory
  const projectDir = flags.dir || path.join(process.cwd(), projectName!);

  // Confirm details
  console.log();
  console.log(relico.bold("Creating Rempts project:"));
  console.log(relico.dim("  Name:     ") + relico.cyan(projectName!));
  console.log(relico.dim("  Template: ") + relico.cyan(flags.template));
  console.log(relico.dim("  Location: ") + relico.cyan(projectDir));
  console.log(relico.dim("  Git:      ") + relico.cyan(flags.git ? "Yes" : "No"));
  console.log(relico.dim("  Install:  ") + relico.cyan(flags.install ? "Yes" : "No"));
  console.log();

  const confirmed = await prompt.confirm("Continue?", { default: true });
  if (!confirmed) {
    console.log(relico.red("Cancelled"));
    process.exit(1);
  }

  console.log();

  // Create project
  await createProject({
    name: projectName!,
    dir: projectDir,
    template: flags.template,
    git: flags.git,
    install: flags.install,
    offline: flags.offline ?? false,
    prompt,
    spinner,
    colors,
    shell,
  });

  // Success message
  console.log();
  console.log(relico.green("✨ Project created successfully!"));
  console.log();
  console.log("Next steps:");
  console.log(relico.gray(`  cd ${path.relative(process.cwd(), projectDir)}`));

  if (!flags.install) {
    console.log(relico.gray(`  bun install`));
  }

  console.log(relico.gray(`  bun run dev`));

  console.log();
}
