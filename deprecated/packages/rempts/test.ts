import { inputPrompt, multiselectPrompt, selectPrompt } from "./src/mod";

console.log("Testing inputPrompt...");
try {
  const result = inputPrompt({
    message: "Enter your name: ",
    required: true,
    echoMode: "normal",
  });
  console.log("Result:", result);
} catch (error) {
  console.error("Error:", error);
}

console.log("\nTesting selectPrompt...");
try {
  const result = selectPrompt({
    message: "Choose an option:",
    options: [
      { value: "Option 1", label: "First option" },
      { value: "Option 2", label: "Second option" },
      { value: "Option 3", label: "Third option" },
    ],
    perPage: 3,
  });
  console.log("Result:", result);
} catch (error) {
  console.error("Error:", error);
}

console.log("\nTesting optional selectPrompt...");
try {
  const result = selectPrompt({
    message: "Choose an optional option (Ctrl+C to skip):",
    options: [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta" },
    ],
  });
  console.log("Optional Result:", result);
} catch (error) {
  console.error("Error:", error);
}

console.log("\nTesting multiselectPrompt...");
try {
  const result = multiselectPrompt({
    message: "Choose multiple options:",
    options: [
      { value: "Option 1", label: "First option" },
      { value: "Option 2", label: "Second option" },
      { value: "Option 3", label: "Third option" },
    ],
    perPage: 3,
  });
  console.log("Result:", result);
} catch (error) {
  console.error("Error:", error);
}

console.log("\nTesting optional multiselectPrompt...");
try {
  const result = multiselectPrompt({
    message: "Choose optional options (Ctrl+C to skip):",
    options: [
      { value: "Option 1", label: "First option" },
      { value: "Option 2", label: "Second option" },
    ],
  });
  console.log("Optional Result:", result);
} catch (error) {
  console.error("Error:", error);
}
