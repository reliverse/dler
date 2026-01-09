import { defineCommand } from "@reliverse/rempts-core";

const buildCommand = defineCommand({
  name: "build",
  description: "Build the project",
  handler: async () => {
    console.log("Building project...");
  },
});

export default buildCommand;
