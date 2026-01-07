// Test app command
import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "test-app",
  description: "Test app directory command",
  options: {},
  handler: ({ flags }) => {
    console.log("App directory command executed!");
    console.log("Flags received:", flags);
  },
});
