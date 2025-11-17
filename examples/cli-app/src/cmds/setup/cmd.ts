import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  confirmPrompt,
  multiselectPrompt,
  selectPrompt,
  spinnerPrompt,
} from "@reliverse/dler-prompt";

export default defineCommand({
  meta: {
    name: "setup",
    description: "Interactive project setup wizard",
    aliases: ["init", "create"],
    examples: [
      "cli-app setup",
      "cli-app setup --template basic",
      "cli-app setup --skip-prompts",
    ],
  },
  args: defineArgs({
    template: {
      type: "string",
      description: "Use a specific template",
      aliases: ["t"],
    },
    skipPrompts: {
      type: "boolean",
      description: "Skip interactive prompts",
      default: false,
    },
  }),
  run: async () => {
    logger.log("⚙️  Project Setup Wizard\n");

    // Select project type
    const projectTypeOptions = [
      { value: "web-app", label: "Web Application" },
      { value: "cli-tool", label: "CLI Tool" },
      { value: "library", label: "Library" },
      { value: "api-server", label: "API Server" },
      { value: "desktop-app", label: "Desktop App" },
    ];
    const projectType = await selectPrompt({
      title: "What type of project are you setting up?",
      options: projectTypeOptions,
    });
    if (projectType === null) {
      logger.error("Selection cancelled");
      return;
    }
    logger.success(`Project type: ${projectType}\n`);

    // Select features
    const featureOptions = [
      { value: "typescript", label: "TypeScript" },
      { value: "testing", label: "Testing Framework" },
      { value: "linting", label: "Linting" },
      { value: "formatting", label: "Code Formatting" },
      { value: "cicd", label: "CI/CD" },
      { value: "documentation", label: "Documentation" },
      { value: "docker", label: "Docker Support" },
    ];
    const selectedFeatures = await multiselectPrompt({
      title: "Select features to include:",
      options: featureOptions,
    });

    if (selectedFeatures === null) {
      logger.error("Selection cancelled");
      return;
    }

    if (selectedFeatures.length > 0) {
      logger.success(`Selected features: ${selectedFeatures.join(", ")}\n`);
    } else {
      logger.log("No features selected.\n");
    }

    // Confirm setup
    const confirmResult = await confirmPrompt({
      title: `Proceed with setting up a ${projectType} with ${selectedFeatures.length} feature(s)?`,
    });

    if (
      confirmResult.error ||
      confirmResult.confirmed === null ||
      !confirmResult.confirmed
    ) {
      logger.log("❌ Setup cancelled.");
      return;
    }

    // Use spinner for setup process
    const setupSpinner = spinnerPrompt({
      text: "Setting up project...",
      indicator: "timer",
      delay: 100,
    });
    setupSpinner.start();

    // Simulate setup steps
    await new Promise((resolve) => setTimeout(resolve, 800));
    setupSpinner.updateText("Installing dependencies...");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setupSpinner.updateText("Configuring project...");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setupSpinner.succeed("Project setup completed!");
  },
});
