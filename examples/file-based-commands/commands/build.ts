import { defineCommand } from "@reliverse/rempts";
import { z } from "zod";

export default defineCommand({
  name: "build",
  description: "Build the project",
  options: {
    watch: {
      type: "boolean",
      description: "Watch for changes",
    },
    minify: {
      type: "boolean",
      description: "Minify output",
    },
  },
  handler: ({ flags }) => {
    console.log("Building project...");
    if (flags.watch) {
      console.log("Watching for changes...");
    }
    if (flags.minify) {
      console.log("Minifying output...");
    }
    console.log("Build complete!");
  },
});
