import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  description: "Build command files",
  handler: () => {
    console.log("Building command files...");
  },
});
