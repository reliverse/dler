import { defineCommand } from "@reliverse/rempts";

export default defineCommand({
  name: "cmd",
  description: "Build command files",
  handler: () => {
    console.log("Building command files...");
  },
});
