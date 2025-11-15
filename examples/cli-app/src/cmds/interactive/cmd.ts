import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  askQuestion,
  confirmPrompt,
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
    const colorResult = await selectPrompt({
      title: "What's your favorite color?",
      options: colorOptions,
    });
    if (colorResult.error || colorResult.selectedIndex === null) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    const favoriteColor = colorOptions[colorResult.selectedIndex]?.value ?? "";
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
    const hobbiesResult = await multiselectPrompt({
      title: "Select your hobbies (use space to toggle, enter to confirm):",
      options: hobbyOptions,
    });
    if (hobbiesResult.error) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    const selectedHobbies = hobbiesResult.selectedIndices.map(
      (idx) => hobbyOptions[idx]?.value ?? "",
    );
    logger.success(`Selected hobbies: ${selectedHobbies.join(", ")}\n`);

    // Confirmation prompt
    const wantsNewsletterResult = await confirmPrompt({
      title: "Would you like to subscribe to our newsletter?",
    });
    if (
      wantsNewsletterResult.error ||
      wantsNewsletterResult.confirmed === null
    ) {
      logger.log("Confirmation cancelled.\n");
    } else if (wantsNewsletterResult.confirmed) {
      logger.success("You subscribed to the newsletter!\n");
    } else {
      logger.log("You declined the newsletter subscription.\n");
    }

    // Question prompt
    const name = await askQuestion("What's your name?", "Anonymous");
    logger.success(`Hello, ${name}!\n`);

    // Another confirmation
    const proceedResult = await confirmPrompt({
      title: "Do you want to proceed with the setup?",
    });
    if (proceedResult.error || proceedResult.confirmed === null) {
      logger.log("❌ Setup cancelled.\n");
    } else if (proceedResult.confirmed) {
      logger.success("✅ Setup will proceed!\n");
    } else {
      logger.log("❌ Setup cancelled.\n");
    }

    logger.success("🎉 Interactive demo completed!");
  },
});
