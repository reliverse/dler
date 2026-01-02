import { createSpinner, spinnerPrompt } from "./src/mod";

console.log("Testing spinnerPrompt...");

// Test 1: Basic spinner with timer
const spinner1 = spinnerPrompt({
  text: "Loading...",
  indicator: "timer",
  delay: 100,
});

spinner1.start();

// Simulate some work
await new Promise((resolve) => {
  setTimeout(() => {
    spinner1.succeed("Loading complete!");
    resolve(undefined);
  }, 2000);
});

// Test 2: Spinner with custom frames
const spinner2 = createSpinner({
  text: "Processing...",
  frames: ["◒", "◐", "◓", "◑"],
  delay: 80,
  indicator: "dots",
});

spinner2.start();

await new Promise((resolve) => {
  setTimeout(() => {
    spinner2.updateText("Almost done...");
    setTimeout(() => {
      spinner2.succeed("Processing complete!");
      resolve(undefined);
    }, 1000);
  }, 1000);
});

// Test 3: Spinner with abort signal
const abortController = new AbortController();
const spinner3 = spinnerPrompt({
  text: "This will be cancelled",
  signal: abortController.signal,
  onCancel: () => {
    console.log("Spinner was cancelled!");
  },
  cancelMessage: "Operation cancelled",
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

console.log("\nAll spinner tests completed!");
