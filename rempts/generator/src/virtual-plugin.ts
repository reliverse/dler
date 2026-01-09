import { dirname, join } from "node:path";
import type { BunPlugin, OnLoadArgs, OnResolveArgs } from "bun";
import { Generator } from "./generator";

export interface RemptsVirtualPluginOptions {
  cmdsDir?: string;
  config?: any;
}

/**
 * Bun plugin that creates a virtual module for command type generation
 *
 * This plugin intercepts imports to `virtual:rempts-generated` and generates
 * types on-the-fly without writing any files to disk. TypeScript resolves this
 * virtual module at compile time, providing full type safety.
 *
 * @example
 * ```typescript
 * // In your CLI entry file:
 * import 'virtual:rempts-generated'
 *
 * // Types are automatically generated and registered
 * ```
 */
export function remptsVirtualPlugin(options: RemptsVirtualPluginOptions = {}): BunPlugin {
  const { cmdsDir: defaultCmdsDir, config } = options;

  return {
    name: "@reliverse/rempts-virtual",

    setup(build) {
      // Store importer path in closure for use in onLoad
      let importerPath: string | undefined;

      // Intercept resolution of virtual:rempts-generated module
      build.onResolve({ filter: /^virtual:rempts-generated$/ }, (args: OnResolveArgs) => {
        // Store importer path for use in onLoad
        importerPath = args.importer;
        return {
          path: args.path,
          namespace: "rempts-generated",
        };
      });

      // Generate types on-the-fly when the virtual module is loaded
      build.onLoad(
        { filter: /^virtual:rempts-generated$/, namespace: "rempts-generated" },
        async (_args: OnLoadArgs) => {
          try {
            // Determine commands directory from importer or use default
            let cmdsDir: string;
            if (defaultCmdsDir) {
              cmdsDir = defaultCmdsDir;
            } else if (importerPath) {
              // Extract commands directory from importer path
              // Commands directory is always <entry-file-dir>/cmds
              const importerDir = dirname(importerPath);
              cmdsDir = join(importerDir, "cmds");
            } else {
              // Fallback to default
              cmdsDir = "cmds";
            }

            // Create a temporary generator instance to scan and parse commands
            const generator = new Generator({
              cmdsDir,
              outputFile: "", // Not used for virtual module
              config,
              generateReport: false,
            });

            // Generate virtual module content
            const code = await generator.generateVirtualModule();

            return {
              contents: code,
              loader: "ts",
            };
          } catch (error) {
            // Return empty module if generation fails (graceful degradation)
            // This allows the CLI to still work without type generation
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(
              `[rempts] Failed to generate virtual types: ${errorMessage}. Type inference may be limited.`
            );

            // Return minimal module that doesn't break imports
            return {
              contents: `// Virtual module generation failed
// Type inference may be limited
export const generated = null;
export const commands = {};
export const commandMeta = {};
export default null;
`,
              loader: "ts",
            };
          }
        }
      );
    },
  };
}

export default remptsVirtualPlugin;
