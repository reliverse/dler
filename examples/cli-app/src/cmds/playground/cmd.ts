import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  inputPrompt,
  multiselectPrompt,
  selectPrompt,
  spinnerPrompt,
} from "@reliverse/dler-prompt";

export default defineCmd(
  async (_args) => {
    logger.log("🎮 Prompt Playground Demo\n");

    // Input prompt - username
    const usernameResult = await inputPrompt({ title: "Enter username: " });
    logger.log("Username result:", JSON.stringify(usernameResult, null, 2));
    if (usernameResult.error) {
      logger.error(`Error: ${usernameResult.error}`);
      return;
    }
    if (usernameResult.value) {
      logger.success(`Username: ${usernameResult.value}\n`);
    }

    // Input prompt - password
    const passwordResult = await inputPrompt({
      title: "Enter password: ",
      echoMode: "password",
    });
    logger.log("Password result:", JSON.stringify(passwordResult, null, 2));
    if (passwordResult.error) {
      logger.error(`Error: ${passwordResult.error}`);
      return;
    }
    if (passwordResult.value) {
      logger.success("Password entered successfully\n");
    }

    // Select prompt
    const commitTypeOptions = [
      { id: "feat", label: "Introducing new features" },
      { id: "fix", label: "Bug fix" },
      { id: "docs", label: "Writing docs" },
      { id: "style", label: "Improving structure/format of the code" },
      { id: "refactor", label: "Refactoring code" },
      { id: "test", label: "Refactoring code" },
      { id: "chore", label: "When adding missing tests" },
      { id: "perf", label: "Improving performance" },
    ];
    const commitTypeResult = await selectPrompt({
      title: "Select Commit Type: ",
      options: commitTypeOptions,
      perPage: 5,
      footerText: "Footer here",
    });
    logger.log("Select result:", JSON.stringify(commitTypeResult, null, 2));
    if (commitTypeResult.error || commitTypeResult.selectedIndex === null) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    const selectedCommitType =
      commitTypeOptions[commitTypeResult.selectedIndex]?.id ?? "";
    logger.success(`Selected commit type: ${selectedCommitType}\n`);

    // Multiselect prompt
    const multiselectResult = await multiselectPrompt({
      title: "Select Commit Types: ",
      options: commitTypeOptions,
      perPage: 5,
      footerText: "Space: toggle, Enter: confirm",
    });
    logger.log(
      "Multiselect result:",
      JSON.stringify(multiselectResult, null, 2),
    );
    if (multiselectResult.error) {
      logger.error("Selection cancelled or error occurred");
      return;
    }
    const selectedCommitTypes = multiselectResult.selectedIndices.map(
      (idx) => commitTypeOptions[idx]?.id ?? "",
    );
    logger.success(
      `Selected commit types: ${selectedCommitTypes.join(", ")}\n`,
    );

    // Spinner prompt demo
    logger.log("Spinner demo:\n");
    const spinner1 = spinnerPrompt({
      text: "Loading data...",
      indicator: "timer",
      delay: 100,
    });
    spinner1.start();
    await new Promise((resolve) => {
      setTimeout(() => {
        spinner1.succeed("Data loaded successfully!");
        resolve(undefined);
      }, 2000);
    });

    // Spinner with custom frames
    const spinner2 = spinnerPrompt({
      text: "Processing files...",
      frames: ["◒", "◐", "◓", "◑"],
      delay: 80,
      indicator: "dots",
    });
    spinner2.start();
    await new Promise((resolve) => {
      setTimeout(() => {
        spinner2.updateText("Almost done...");
        setTimeout(() => {
          spinner2.succeed("Files processed!");
          resolve(undefined);
        }, 1000);
      }, 1000);
    });

    // Spinner with abort signal demo
    logger.log(
      "\nSpinner with abort signal demo (will auto-cancel after 1.5s to demonstrate cancellation):\n",
    );
    const abortController = new AbortController();
    const spinner3 = spinnerPrompt({
      text: "This will be cancelled programmatically",
      signal: abortController.signal,
      onCancel: () => {
        logger.log("(Demo: Spinner was cancelled via abort signal)");
      },
      cancelMessage: "Operation cancelled (demo)",
    });
    spinner3.start();
    setTimeout(() => {
      abortController.abort();
    }, 1500);
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 2000);
    });
    logger.log(
      "(Note: The cancel message above is expected - it demonstrates cancellation behavior)\n",
    );

    logger.success("\n🎉 Playground demo completed!");
  },
  defineCmdArgs({
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
    },
  }),
  defineCmdCfg({
    name: "playground",
    description: "Demonstrate input, select, and multiselect prompts",
    examples: ["cli-app playground", "cli-app playground --verbose"],
  }),
);
