import { defineCommand } from "@reliverse/rempts-core";

export default defineCommand({
  name: "cmd",
  description: "Build command files",
  handler: () => {
    console.log("Building command files...");
  },
});
