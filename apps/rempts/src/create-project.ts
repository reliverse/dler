import type { RemptsUtils } from "@reliverse/rempts-utils";
import {
  processTemplate,
  resolveTemplateSource,
  isLocalTemplate,
  getBundledTemplatePath,
} from "./template-engine";
import type { CreateOptions } from "./types";
import { relico } from "@reliverse/relico";

interface CreateProjectOptions extends CreateOptions {
  name: string;
  dir: string;
  template: string;
  prompt: RemptsUtils["prompt"];
  spinner: RemptsUtils["spinner"];
  colors: RemptsUtils["colors"];
  shell: typeof Bun.$;
}

export async function createProject(options: CreateProjectOptions) {
  const { name, dir, template, git, install, prompt, spinner, colors, shell, offline } = options;

  // Check if directory exists
  try {
    await shell`test -d ${dir}`.quiet();
    const overwrite = await prompt.confirm(`Directory ${dir} already exists. Overwrite?`, {
      default: false,
    });
    if (!overwrite) {
      console.log(relico.red("Cancelled"));
      process.exit(1);
    }
    await shell`rm -rf ${dir}`;
  } catch {
    // Directory doesn't exist, which is good
  }

  // Create project directory
  const spin = spinner("Creating project structure...");
  spin.start();

  await shell`mkdir -p ${dir}`;

  try {
    // Resolve template source
    let templateSource = template;

    // Check if it's a local/bundled template first
    if (await isLocalTemplate(template)) {
      templateSource = getBundledTemplatePath(template);
    } else {
      templateSource = resolveTemplateSource(template);
    }

    // Process template with giget
    const { manifest } = await processTemplate({
      source: templateSource,
      dir,
      offline,
      variables: {
        name: name,
        version: "0.1.0",
        description: `A CLI built with Rempts`,
        author: "",
        license: "MIT",
        year: new Date().getFullYear().toString(),
      },
    });

    spin.succeed("Project structure created");

    // Initialize git
    if (git) {
      const gitSpin = spinner("Initializing git repository...");
      gitSpin.start();

      try {
        await shell`cd ${dir} && git init`.quiet();
        await shell`cd ${dir} && git add .`.quiet();
        await shell`cd ${dir} && git commit -m "feat: initialize ${name} CLI project with Rempts

- Generated using rempts template
- Includes basic CLI structure with commands directory
- Configured with Rempts build system and TypeScript
- Ready for development with bun run dev"`;

        gitSpin.succeed("Git repository initialized");
      } catch (error) {
        gitSpin.fail("Failed to initialize git repository");
        console.error(relico.dim(`  ${error}`));
      }
    }

    // Install dependencies
    if (install) {
      const installSpin = spinner(`Installing dependencies...`);
      installSpin.start();

      try {
        await shell`cd ${dir} && bun install`;

        installSpin.succeed("Dependencies installed");
      } catch (error) {
        installSpin.fail("Failed to install dependencies");
        console.error(relico.dim(`  You can install them manually by running: bun install`));
      }
    }
  } catch (error) {
    spin.fail("Failed to create project");
    console.error(relico.red(`Error: ${error}`));

    // Cleanup on failure
    try {
      await shell`rm -rf ${dir}`.quiet();
    } catch {}

    process.exit(1);
  }
}
