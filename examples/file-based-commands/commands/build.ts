import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";

export default defineCommand({
  name: "build",
  description: "Build the project",
  options: {
    watch: option(type("boolean | undefined"), {
      description: "Watch for changes",
    }),
    minify: option(type("boolean | undefined"), {
      description: "Minify output",
    }),
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
