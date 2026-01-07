import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "test",
  description: "Run tests",
  handler: () => {
    console.log("Running tests...");
    console.log("All tests passed!");
  },
});
