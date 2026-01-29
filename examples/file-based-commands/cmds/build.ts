import { defineCommand } from "@reliverse/rempts";

const buildCommand = defineCommand({
  description: "Build the project",
  handler: async () => {
    console.log("Building project...");
  },
});

export default buildCommand;
