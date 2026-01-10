import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  description: "Build command files",
  handler: () => {
    console.log("Building command files...");
  },
});
