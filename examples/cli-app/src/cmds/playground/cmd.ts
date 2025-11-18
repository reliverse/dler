import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import {
  exitCancelled,
  inputPrompt,
  isCancel,
  multiselectPrompt,
  selectPrompt,
  spinnerPrompt,
} from "@reliverse/dler-prompt";

export default defineCommand({
  meta: {
    name: "playground",
    description: "Demonstrate input, select, and multiselect prompts",
    examples: ["cli-app playground", "cli-app playground --verbose"],
  },
  args: defineArgs({
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
    },
  }),
  run: async () => {
    logger.log("🎮 Prompt Playground Demo\n");

    // Input prompt - username
    let usernameResult: string;
    try {
      usernameResult = await inputPrompt({ message: "Enter username: " });
    } catch (error) {
      if (isCancel(error)) {
        return exitCancelled("Operation cancelled");
      }
      logger.error(
        `Error: ${error instanceof Error ? error.message : "Input failed"}`,
      );
      return;
    }
    logger.log("Username result:", JSON.stringify(usernameResult, null, 2));
    logger.success(`Username: ${usernameResult}\n`);

    // Input prompt - password
    let passwordResult: string;
    try {
      passwordResult = await inputPrompt({
        message: "Enter password: ",
        echoMode: "password",
      });
    } catch (error) {
      if (isCancel(error)) {
        return exitCancelled("Operation cancelled");
      }
      logger.error(
        `Error: ${error instanceof Error ? error.message : "Input failed"}`,
      );
      return;
    }
    logger.log("Password result:", JSON.stringify(passwordResult, null, 2));
    logger.success("Password entered successfully\n");

    // Select prompt
    const selectCommitTypeOptions = [
      { value: "ts", label: "TypeScript" },
      { value: "js", label: "JavaScript" },
      { value: "py", label: "Python" },
      { value: "java", label: "Java" },
      { value: "cpp", label: "C++" },
      { value: "c", label: "C" },
      { value: "rust", label: "Rust" },
      { value: "go", label: "Go" },
      { value: "php", label: "PHP" },
      { value: "ruby", label: "Ruby" },
      { value: "swift", label: "Swift" },
      { value: "kotlin", label: "Kotlin" },
      { value: "scala", label: "Scala" },
    ];
    const multiselectCommitTypeOptions = [
      { value: "feat", label: "Introducing new features" },
      { value: "fix", label: "Bug fix" },
      { value: "docs", label: "Writing docs" },
      { value: "style", label: "Improving structure/format of the code" },
      { value: "refactor", label: "Refactoring code" },
      { value: "test", label: "Refactoring code" },
      { value: "chore", label: "When adding missing tests" },
      { value: "perf", label: "Improving performance" },
    ];
    let selectedCommitType: string;
    try {
      selectedCommitType = await selectPrompt({
        title: "What is your favorite programming language?",
        message: "This is a multiselect prompt",
        options: selectCommitTypeOptions,
        perPage: 5,
        footerText: "Enter to confirm",
      });
    } catch (error) {
      if (isCancel(error)) {
        return exitCancelled("Operation cancelled");
      }
      logger.error(
        `Error: ${error instanceof Error ? error.message : "Selection failed"}`,
      );
      return;
    }
    if (selectedCommitType === null) {
      logger.warn("No selection made");
      return;
    }
    logger.log("Select result:", selectedCommitType);
    logger.success(`Selected commit type: ${selectedCommitType}\n`);

    // Multiselect prompt
    let selectedCommitTypes: string[];
    try {
      selectedCommitTypes = await multiselectPrompt({
        message: "Select Commit Types: ",
        options: multiselectCommitTypeOptions,
        perPage: 5,
        footerText: "Space: toggle, Enter: confirm",
      });
    } catch (error) {
      if (isCancel(error)) {
        return exitCancelled("Operation cancelled");
      }
      logger.error(
        `Error: ${error instanceof Error ? error.message : "Selection failed"}`,
      );
      return;
    }
    logger.log("Multiselect result:", selectedCommitTypes);
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
});
