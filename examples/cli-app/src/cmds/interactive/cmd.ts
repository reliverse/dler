import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  askQuestion,
  confirmPrompt,
  multiselectPrompt,
  selectPrompt,
} from "@reliverse/dler-prompt";

export default defineCmd(
  async (_args) => {
    logger.log("🎯 Interactive Prompt Demo\n");

    // Single selection prompt
    const favoriteColor = await selectPrompt({
      title: "What's your favorite color?",
      options: [
        { value: "red", label: "Red" },
        { value: "blue", label: "Blue" },
        { value: "green", label: "Green" },
        { value: "yellow", label: "Yellow" },
        { value: "purple", label: "Purple" },
        { value: "orange", label: "Orange" },
      ],
    });
    logger.success(`You selected: ${favoriteColor}\n`);

    // Multiple selection prompt
    const hobbies = await multiselectPrompt({
      title: "Select your hobbies (use space to toggle, enter to confirm):",
      options: [
        { value: "reading", label: "Reading" },
        { value: "gaming", label: "Gaming" },
        { value: "sports", label: "Sports" },
        { value: "music", label: "Music" },
        { value: "cooking", label: "Cooking" },
        { value: "traveling", label: "Traveling" },
        { value: "photography", label: "Photography" },
      ],
    });
    logger.success(`Selected hobbies: ${hobbies.join(", ")}\n`);

    // Confirmation prompt
    const wantsNewsletter = await confirmPrompt(
      "Would you like to subscribe to our newsletter?",
      true,
    );
    if (wantsNewsletter) {
      logger.success("You subscribed to the newsletter!\n");
    } else {
      logger.log("You declined the newsletter subscription.\n");
    }

    // Question prompt
    const name = await askQuestion("What's your name?", "Anonymous");
    logger.success(`Hello, ${name}!\n`);

    // Another confirmation
    const proceed = await confirmPrompt(
      "Do you want to proceed with the setup?",
      false,
    );
    if (proceed) {
      logger.success("✅ Setup will proceed!\n");
    } else {
      logger.log("❌ Setup cancelled.\n");
    }

    logger.success("🎉 Interactive demo completed!");
  },
  defineCmdArgs({
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
    },
  }),
  defineCmdCfg({
    name: "interactive",
    description: "Demonstrate all interactive prompt types",
    examples: ["cli-app interactive", "cli-app interactive --verbose"],
  }),
);
