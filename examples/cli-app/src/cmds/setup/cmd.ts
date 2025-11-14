import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  confirmPrompt,
  multiselectPrompt,
  selectPrompt,
} from "@reliverse/dler-prompt";

export default defineCmd(
  async (_args) => {
    logger.log("⚙️  Project Setup Wizard\n");

    // Select project type
    const projectType = await selectPrompt({
      title: "What type of project are you setting up?",
      options: [
        { value: "web-app", label: "Web Application" },
        { value: "cli-tool", label: "CLI Tool" },
        { value: "library", label: "Library" },
        { value: "api-server", label: "API Server" },
        { value: "desktop-app", label: "Desktop App" },
      ],
    });
    logger.success(`Project type: ${projectType}\n`);

    // Select features
    const features = await multiselectPrompt({
      title: "Select features to include:",
      options: [
        { value: "typescript", label: "TypeScript" },
        { value: "testing", label: "Testing Framework" },
        { value: "linting", label: "Linting" },
        { value: "formatting", label: "Code Formatting" },
        { value: "cicd", label: "CI/CD" },
        { value: "documentation", label: "Documentation" },
        { value: "docker", label: "Docker Support" },
      ],
    });

    if (features.length > 0) {
      logger.success(`Selected features: ${features.join(", ")}\n`);
    } else {
      logger.log("No features selected.\n");
    }

    // Confirm setup
    const confirm = await confirmPrompt(
      `Proceed with setting up a ${projectType} with ${features.length} feature(s)?`,
      true,
    );

    if (confirm) {
      logger.success("🚀 Setting up project...\n");
      // Simulate setup
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logger.success("✅ Project setup completed!");
    } else {
      logger.log("❌ Setup cancelled.");
    }
  },
  defineCmdArgs({
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
  defineCmdCfg({
    name: "setup",
    description: "Interactive project setup wizard",
    aliases: ["init", "create"],
    examples: [
      "cli-app setup",
      "cli-app setup --template basic",
      "cli-app setup --skip-prompts",
    ],
  }),
);
