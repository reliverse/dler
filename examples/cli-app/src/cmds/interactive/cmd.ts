import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  confirmPrompt,
  inputPrompt,
  multiselectPrompt,
  selectPrompt,
} from "@reliverse/dler-prompt";

export default defineCommand({
  meta: {
    name: "interactive",
    description: "Demonstrate all interactive prompt types",
    examples: ["cli-app interactive", "cli-app interactive --verbose"],
  },
  args: defineArgs({
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
    },
  }),
  run: async () => {
    logger.log("🎯 Interactive Prompt Demo\n");

    // Single selection prompt
    const colorOptions = [
      { value: "red", label: "Red" },
      { value: "blue", label: "Blue" },
      { value: "green", label: "Green" },
      { value: "yellow", label: "Yellow" },
      { value: "purple", label: "Purple" },
      { value: "orange", label: "Orange" },
    ];
    const favoriteColor = await selectPrompt({
      message: "What's your favorite color?",
      options: colorOptions,
    });
    if (favoriteColor === null) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    logger.success(`You selected: ${favoriteColor}\n`);

    // Multiple selection prompt
    const hobbyOptions = [
      { value: "reading", label: "Reading" },
      { value: "gaming", label: "Gaming" },
      { value: "sports", label: "Sports" },
      { value: "music", label: "Music" },
      { value: "cooking", label: "Cooking" },
      { value: "traveling", label: "Traveling" },
      { value: "photography", label: "Photography" },
    ];
    const selectedHobbies = await multiselectPrompt({
      message: "Select your hobbies (use space to toggle, enter to confirm):",
      options: hobbyOptions,
    });
    if (selectedHobbies === null) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    logger.success(`Selected hobbies: ${selectedHobbies.join(", ")}\n`);

    // Confirmation prompt
    try {
      const wantsNewsletter = await confirmPrompt({
        message: "Would you like to subscribe to our newsletter?",
      });
      if (wantsNewsletter) {
        logger.success("You subscribed to the newsletter!\n");
      } else {
        logger.log("You declined the newsletter subscription.\n");
      }
    } catch {
      logger.log("Confirmation cancelled.\n");
    }

    // Question prompt
    const name = await inputPrompt({
      message: "What's your name?",
      defaultValue: "Anonymous",
    });
    logger.success(`Hello, ${name}!\n`);

    // Another confirmation
    try {
      const proceed = await confirmPrompt({
        message: "Do you want to proceed with the setup?",
      });
      if (proceed) {
        logger.success("✅ Setup will proceed!\n");
      } else {
        logger.log("❌ Setup cancelled.\n");
      }
    } catch {
      logger.log("❌ Setup cancelled.\n");
    }

    logger.success("🎉 Interactive demo completed!");
  },
});
