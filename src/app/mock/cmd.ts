import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import prettyMilliseconds from "pretty-ms";

import type { TemplateFileContent, Template } from "~/libs/sdk/sdk-types";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";

import { DLER_TEMPLATES, dlerTemplatesMap } from "./mock-template";

const jiti = createJiti(import.meta.url);

async function writeFile(
  filePath: string,
  file: TemplateFileContent,
  dryRun: boolean,
): Promise<void> {
  const { content, type } = file;
  if (dryRun) {
    relinka("log", `[DRY RUN] Would write file: ${filePath}`);
    return;
  }

  // Check if file is binary before writing
  const isBinary = await isBinaryExt(filePath);
  if (isBinary && type !== "binary") {
    relinka(
      "warn",
      `Warning: File ${filePath} appears to be binary but is not marked as such in template`,
    );
  }

  if (type === "json") {
    await fs.writeJson(filePath, content, { spaces: 2 });
  } else {
    await fs.writeFile(filePath, content as string, "utf8");
  }
}

async function createMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    // Helper function to normalize paths
    const normalizePath = (filePath: string) => {
      return filePath;
    };

    // Create files and their parent directories
    await Promise.all(
      Object.entries(template.config.files).map(async ([filePath, file]) => {
        const normalizedPath = normalizePath(filePath);

        if (!dryRun) {
          await fs.ensureDir(path.dirname(normalizedPath));
        }
        await writeFile(normalizedPath, file, dryRun);
        relinka("log", `Created mock file: ${normalizedPath}`);
      }),
    );

    if (!dryRun) {
      relinka(
        "success",
        "Mock structure created successfully (used templates: " + template.name + ")",
      );
    } else {
      relinka("success", "[DRY RUN] Mock structure would be created successfully");
    }
  } catch (error) {
    relinka("error", "Failed to create mock structure", error);
    throw error;
  }
}

async function cleanupMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    const paths = Object.keys(template.config.files);
    const dirsToCheck = new Set<string>();

    // First delete all files and collect their parent directories
    for (const filePath of paths) {
      if (await fs.pathExists(filePath)) {
        if (dryRun) {
          relinka("log", `[DRY RUN] Would remove: ${filePath}`);
        } else {
          await fs.remove(filePath);
          relinka("log", `Removed: ${filePath}`);
        }
        // Add all parent directories to check
        let dir = path.dirname(filePath);
        while (dir && dir !== ".") {
          dirsToCheck.add(dir);
          dir = path.dirname(dir);
        }
      }
    }

    // Then check and remove empty directories
    if (!dryRun) {
      // Sort directories by depth (deepest first) to ensure we remove from bottom up
      const sortedDirs = Array.from(dirsToCheck).sort((a, b) => b.length - a.length);

      for (const dir of sortedDirs) {
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          if (files.length === 0) {
            await fs.remove(dir);
            relinka("log", `Removed empty directory: ${dir}`);
          }
        }
      }
    } else {
      // In dry run mode, just log what would be checked
      for (const dir of dirsToCheck) {
        relinka("log", `[DRY RUN] Would check directory: ${dir}`);
      }
    }

    if (!dryRun) {
      relinka("success", "Mock structure cleaned up successfully");
    }
  } catch (error) {
    relinka("error", "Failed to cleanup mock structure", error);
    throw error;
  }
}

async function handleExistingPaths(template: Template, force: boolean): Promise<boolean> {
  const paths = Object.keys(template.config.files);

  const existingPaths = await Promise.all(
    paths.map(async (filePath) => {
      return { path: filePath, exists: await fs.pathExists(filePath) };
    }),
  );

  const conflicts = existingPaths.filter((p) => p.exists);

  if (conflicts.length > 0) {
    if (!force) {
      throw new Error(
        `Path conflicts detected. Cannot proceed with the following existing paths:\n${conflicts.map((c) => c.path).join("\n")}`,
      );
    }

    // Clean up existing paths
    for (const conflict of conflicts) {
      await fs.remove(conflict.path);
      relinka("info", `Cleaned up existing path: ${conflict.path}`);
    }
  }

  return true;
}

export default defineCommand({
  meta: {
    name: "mock",
    version: "1.0.0",
    description: "Create mock project structure for testing",
  },
  args: {
    template: {
      type: "string",
      description: `Template to use. Run e.g. 'dler merge --s src/templates --d templates/my-template.ts --as-template' (glob supported) to create your own template. Default templates: ${Object.keys(DLER_TEMPLATES).join(", ")}.`,
      default: "react",
    },
    "template-file": {
      type: "string",
      description: "Custom template file to use instead of default dler's mock-template.ts",
    },
    "template-consts": {
      type: "string",
      description:
        "Space-separated list of template constants to target (e.g., BASIC_DLER_TEMPLATE REACT_DLER_TEMPLATE)",
    },
    cleanup: {
      type: "boolean",
      description: "Clean up existing mock",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Preview changes without applying them",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
    },
    whitelabel: {
      type: "string",
      description: "Custom prefix to use instead of 'DLER' in template handling",
      default: "DLER",
    },
    force: {
      type: "boolean",
      description: "Clean existing paths before proceeding (default: true)",
      default: true,
    },
  },
  async run({ args }) {
    const {
      template,
      "template-file": templateFile,
      "template-consts": templateConsts,
      cleanup,
      "dry-run": dryRun,
      verbose,
      whitelabel = "DLER",
      force,
    } = args;

    // Set log level based on verbose flag
    if (verbose) {
      relinka("log", "Verbose logging enabled");
    }

    let templates: Record<string, Template>;

    if (templateFile) {
      // Load custom template file using jiti
      const module = await jiti.import(templateFile);
      const templatesKey = `${whitelabel}_TEMPLATES`;
      const loadedTemplates = (module as unknown as Record<string, Record<string, Template>>)[
        templatesKey
      ];

      if (!loadedTemplates) {
        relinka("error", `No templates found with prefix: ${whitelabel}`);
        process.exit(1);
      }
      templates = loadedTemplates;
    } else {
      // Use built-in DLER_TEMPLATES
      templates = DLER_TEMPLATES;
    }

    // If specific template constants are requested, filter the templates
    if (templateConsts) {
      const requestedConsts = templateConsts.split(" ").map((c) => c.trim());
      const filteredTemplates: Record<string, Template> = {};

      for (const constName of requestedConsts) {
        let templateConst: Template | undefined;

        if (templateFile) {
          const module = await jiti.import(templateFile);
          templateConst = (module as unknown as Record<string, Template>)[constName];
        } else {
          const templateKey = dlerTemplatesMap[constName];
          if (!templateKey) {
            relinka(
              "error",
              `Invalid template constant: ${constName}. Available constants: ${Object.keys(dlerTemplatesMap).join(", ")}`,
            );
            process.exit(1);
          }
          templateConst = DLER_TEMPLATES[templateKey];
        }

        if (!templateConst) {
          relinka("error", `Template constant not found: ${constName}`);
          process.exit(1);
        }
        // Use the template name in lowercase as the key
        filteredTemplates[templateConst.name.toLowerCase()] = templateConst;
      }

      templates = filteredTemplates;
    }

    // Validate template
    if (!templates[template]) {
      relinka(
        "error",
        `Invalid template: ${template}. Available templates: ${Object.keys(templates).join(", ")}`,
      );
      process.exit(1);
    }

    try {
      const timer = createPerfTimer();

      if (cleanup) {
        await cleanupMockStructure(templates[template], dryRun);
        const elapsed = getElapsedPerfTime(timer);
        relinka(
          "success",
          `Successfully ${dryRun ? "would clean up" : "cleaned up"} template structure in ${prettyMilliseconds(elapsed)}`,
        );
        return;
      }

      if (!(await handleExistingPaths(templates[template], force))) {
        return;
      }

      await createMockStructure(templates[template], dryRun);

      const elapsed = getElapsedPerfTime(timer);
      relinka(
        "success",
        `Successfully ${dryRun ? "would create" : "created"} mock structure in ${prettyMilliseconds(elapsed)}`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      relinka("error", `Error during mock creation: ${errorMessage}`);
      process.exit(1);
    }
  },
});
