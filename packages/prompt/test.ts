import { inputPrompt, multiselectPrompt, selectPrompt } from "./src/mod";

console.log("Testing inputPrompt...");
try {
  const result = inputPrompt({
    title: "Enter your name: ",
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
    title: "Choose an option:",
    options: [
      { id: "Option 1", label: "First option" },
      { id: "Option 2", label: "Second option" },
      { id: "Option 3", label: "Third option" },
    ],
    perPage: 3,
  });
  console.log("Result:", result);
} catch (error) {
  console.error("Error:", error);
}

console.log("\nTesting multiselectPrompt...");
try {
  const result = multiselectPrompt({
    title: "Choose multiple options:",
    options: [
      { id: "Option 1", label: "First option" },
      { id: "Option 2", label: "Second option" },
      { id: "Option 3", label: "Third option" },
    ],
    perPage: 3,
  });
  console.log("Result:", result);
} catch (error) {
  console.error("Error:", error);
}
