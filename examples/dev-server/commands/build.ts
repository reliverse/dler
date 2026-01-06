import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { relico } from "@reliverse/relico";

// Type for the merged plugin stores
type DevServerStore = {
  metrics: {
    recordEvent: (name: string, data?: any) => void;
  };
  config: any;
};

const buildCommand = defineCommand({
  name: "build",
  description: "Build for production",
  options: {
    output: option(type("string").default("dist"), {
      description: "Output directory",
      short: "o",
    }),
    minify: option(type("boolean").default(true), {
      description: "Minify output",
      short: "m",
    }),
    sourcemap: option(type("boolean").default(false), {
      description: "Generate source maps",
      short: "s",
    }),
    target: option(type("'node'|'bun'|'browser'").default("node"), {
      description: "Build target",
      short: "t",
    }),
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

    buildSpinner.succeed(`Build completed successfully`);

    console.log(relico.green(`✓ Output: ${output}`));
    console.log(relico.green(`✓ Target: ${target}`));
    console.log(relico.green(`✓ Minified: ${minify ? "Yes" : "No"}`));
    console.log(relico.green(`✓ Source maps: ${sourcemap ? "Yes" : "No"}`));

    // Access plugin context - now properly typed!
    if (context?.store) {
      if ("metrics" in context.store) {
        context.store.metrics.recordEvent("build_completed", {
          output,
          minify,
          sourcemap,
          target,
        });
      }

      if ("config" in context.store) {
        console.log(relico.dim(`Build config: ${JSON.stringify(context.store.config, null, 2)}`));
      }
    }
  },
});

export default buildCommand;
