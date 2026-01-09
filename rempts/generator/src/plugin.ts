import type { BuildOutput, BunPlugin, OnLoadArgs, OnResolveArgs } from "bun";
import { Generator } from "./generator";

export interface RemptsCodegenPluginOptions {
  cmdsDir?: string;
  outputFile?: string;
  config?: any;
  generateReport?: boolean;
}

/**
 * Bun plugin for automatic command type generation
 *
 * This plugin integrates with Bun.build() to automatically generate
 * command types during the build process, eliminating the need for
 * separate codegen steps.
 */
export function remptsCodegenPlugin(options: RemptsCodegenPluginOptions = {}): BunPlugin {
  const { cmdsDir = "cmds", outputFile = "./commands.gen.ts", config, generateReport } = options;

  let generator: Generator | null = null;

  return {
    name: "@reliverse/rempts-codegen",

    setup(build) {
      // Initialize generator
      generator = new Generator({
        cmdsDir,
        outputFile,
        config,
        generateReport,
      });

      // Hook into the build start to generate types
      build.onStart(async () => {
        if (generator) {
          try {
            console.log("🔧 Generating command types...");
            await generator.run();
            console.log("✅ Command types generated");
          } catch (error) {
            console.warn(
              "⚠️  Failed to generate command types:",
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      });

      // Hook into file resolution to watch command files
      build.onResolve({ filter: /^\.\/commands\// }, async (args: OnResolveArgs) => {
        // This ensures command files are tracked by the bundler
        return {
          path: args.path,
          namespace: "file",
        };
      });

      // Hook into load to process command files
      build.onLoad(
        { filter: /\.(ts|tsx|js|jsx)$/, namespace: "file" },
        async (args: OnLoadArgs) => {
          // Check if this is a command file
          if (args.path.includes(cmdsDir)) {
            // Let Bun handle the file normally, but we've already generated types
            return undefined;
          }
          return undefined;
        }
      );

      // Hook into end to ensure types are up to date
      build.onEnd(async (result: BuildOutput) => {
        if (result.success && generator) {
          // Regenerate types if build was successful
          try {
            await generator.run();
          } catch (error) {
            console.warn(
              "⚠️  Failed to regenerate types:",
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      });
    },
  };
}

/**
 * Create a Bun plugin that automatically generates command types
 *
 * @param options Configuration options for the codegen plugin
 * @returns Bun plugin that can be used with Bun.build()
 *
 * @example
 * ```typescript
 * import { remptsCodegenPlugin } from '@reliverse/rempts-generator/plugin'
 *
 * await Bun.build({
 *   entrypoints: ['./cli.ts'],
 *   outdir: './dist',
 *   plugins: [
 *     remptsCodegenPlugin({
 *       cmdsDir: './cmds',
 *       outputFile: './commands.gen.ts'
 *     })
 *   ]
 * })
 * ```
 */
export default remptsCodegenPlugin;
