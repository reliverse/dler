import { defineCommand } from "@reliverse/rempts";

const testCommand = defineCommand({
  description: "Run tests",
  handler: async () => {
    console.log("Running tests...");
  },
});

export default testCommand;
