import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";

import type { DlerConfig } from "~/libs/sdk/sdk-impl/config/types";

// `dler libs --init my-lib-1 @org/my-lib-2`

export default defineCommand({
  meta: {
    name: "libs",
    version: "1.0.0",
    description: "Initialize and manage library packages.",
  },
  args: defineArgs({
    init: {
      type: "string",
      required: true,
      description: "Names of libraries to initialize (space-separated or quoted)",
    },
    overwrite: {
      type: "boolean",
      description: "Overwrite existing libraries",
    },
  }),
  async run({ args }) {
    // Parse library names from init argument
    let libNames: string[] = [];

    if (Array.isArray(args.init)) {
      libNames = args.init as string[];
    } else if (typeof args.init === "string") {
      libNames = args.init.split(/\s+/).filter(Boolean);
    }

    // Fallback: try to extract additional libraries from process.argv
    if (libNames.length === 1) {
      const argv = process.argv;
      const initIndex = argv.findIndex((arg) => arg === "--init");

      if (initIndex !== -1 && initIndex + 1 < argv.length) {
        const additionalArgs: string[] = [];

        for (let i = initIndex + 2; i < argv.length; i++) {
          const arg = argv[i];
          if (arg?.startsWith("--")) break;
          if (arg && !arg.startsWith("-")) {
            additionalArgs.push(arg);
          } else {
            break;
          }
        }

        if (additionalArgs.length > 0 && libNames[0]) {
          libNames = [libNames[0], ...additionalArgs];
        }
      }
    }

    if (libNames.length === 0) {
      relinka("error", "❌ No library names provided");
      return;
    }

    // Read dler config
    const dlerConfigPath = path.resolve(".config/dler.ts");
    let dlerConfig: DlerConfig | undefined;

    try {
      const jiti = createJiti(import.meta.url);
      dlerConfig = await jiti.import<DlerConfig>(dlerConfigPath, {
        default: true,
      });
    } catch {
      relinka("error", "❌ Failed to read .config/dler.ts");
      return;
    }

    const { libsDirSrc, libsList } = dlerConfig;

    if (!libsDirSrc || !libsList) {
      relinka("error", "❌ Missing libsDirSrc or libsList in dler config");
      return;
    }

    relinka("info", `🚀 Processing ${libNames.length} library(s): ${libNames.join(", ")}`);

    // Process each library
    for (const libName of libNames) {
      const libConfig = libsList[libName];

      if (!libConfig) {
        relinka("warn", `❌ Library "${libName}" not found in libsList config`);
        continue;
      }

      const { libDirName, libMainFile } = libConfig;

      if (!libDirName || !libMainFile) {
        relinka("warn", `❌ Missing libDirName or libMainFile for "${libName}"`);
        continue;
      }

      const libDirPath = path.join(libsDirSrc, libDirName);
      const mainFilePath = path.join(libsDirSrc, libMainFile);

      // Create directory if it doesn't exist
      if (!(await fs.pathExists(libDirPath))) {
        await fs.ensureDir(libDirPath);
        relinka("log", `✅ Created library directory: ${libDirPath}`);
      }

      // Create main file if it doesn't exist
      if (!(await fs.pathExists(mainFilePath)) || args.overwrite) {
        const mainFileContent = `// Main entry point for ${libName}
  export * from "./${libDirName}";
  `;
        await fs.ensureDir(path.dirname(mainFilePath));
        await fs.writeFile(mainFilePath, mainFileContent, "utf8");
        relinka("log", `✅ Created/Updated main file: ${mainFilePath}`);
      } else {
        relinka("warn", `⚠️ Main file already exists: ${mainFilePath}. Use --overwrite to update.`);
      }
    }
  },
});
