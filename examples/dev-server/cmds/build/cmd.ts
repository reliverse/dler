import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts-core";
import { type } from "arktype";

// Type for the merged plugin stores
interface DevServerStore {
  metrics: {
    recordEvent: (name: string, data?: any) => void;
  };
  config: any;
}

const buildCommand = defineCommand({
  description: "Build for production",
  options: {
    output: option(
      type("string | undefined").pipe((s) => s ?? "dist"),
      {
        description: "Output directory",
        short: "o",
      }
    ),
    minify: option(
      type("boolean | undefined").pipe((b) => b ?? true),
      {
        description: "Minify output",
        short: "m",
      }
    ),
    sourcemap: option(
      type("boolean | undefined").pipe((b) => b ?? false),
      {
        description: "Generate source maps",
        short: "s",
      }
    ),
    target: option(
      type("'node'|'bun'|'browser' | undefined").pipe((t) => t ?? "node"),
      {
        description: "Build target",
        short: "t",
      }
    ),
  },
  handler: async ({ flags, spinner, colors, context }) => {
    const { output, minify, sourcemap, target } = flags;

    const buildSpinner = spinner("Building for production...");

    // Simulate build process
    const steps = [
      "Compiling TypeScript...",
      "Bundling modules...",
      "Optimizing assets...",
      "Generating source maps...",
      "Writing output...",
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      buildSpinner.update(steps[i]!);
    }

    buildSpinner.succeed("Build completed successfully");

    console.log(relico.green(`✓ Output: ${output}`));
    console.log(relico.green(`✓ Target: ${target}`));
    console.log(relico.green(`✓ Minified: ${minify ? "Yes" : "No"}`));
    console.log(relico.green(`✓ Source maps: ${sourcemap ? "Yes" : "No"}`));

    // Access plugin context - now properly typed!
    if (context?.store) {
      const state = context.store.getState();
      if (state.metrics) {
        state.metrics.recordEvent("build_completed", {
          output,
          minify,
          sourcemap,
          target,
        });
      }

      const config = context.getStoreValue("config");
      if (config) {
        console.log(relico.dim(`Build config: ${JSON.stringify(config, null, 2)}`));
      }
    }
  },
});

export default buildCommand;
