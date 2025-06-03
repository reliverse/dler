import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import prettyMilliseconds from "pretty-ms";

import type { TemplateFileContent, Template } from "~/libs/sdk/sdk-types";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";
import {
  validatePath,
  validateFileType,
  validateContent,
  checkPermissions,
  handleError,
  validateTemplate,
  checkRateLimit,
  sanitizeInput,
} from "~/libs/sdk/sdk-impl/utils/utils-security";

import { DLER_TEMPLATES, dlerTemplatesMap } from "./mock";

const jiti = createJiti(import.meta.url);

async function writeFile(
  filePath: string,
  file: TemplateFileContent,
  dryRun: boolean,
): Promise<void> {
  try {
    const { content, type } = file;

    // Validate file type
    validateFileType(type);

    // Validate content
    validateContent(content, type);

    // Sanitize file path
    const sanitizedPath = sanitizeInput(filePath);

    // Check rate limit
    checkRateLimit(`write_${sanitizedPath}`);

    if (dryRun) {
      relinka("log", `[DRY RUN] Would write file: ${sanitizedPath}`);
      return;
    }

    // Check if file is binary before writing
    const isBinary = await isBinaryExt(sanitizedPath);
    if (isBinary && type !== "binary") {
      relinka(
        "warn",
        `Warning: File ${sanitizedPath} appears to be binary but is not marked as such in template`,
      );
    }

    // Check permissions
    await checkPermissions(sanitizedPath, "write");

    if (type === "json") {
      await fs.writeJson(sanitizedPath, content, { spaces: 2 });
    } else {
      await fs.writeFile(sanitizedPath, content as string, "utf8");
    }
  } catch (error) {
    handleError(error, `writeFile(${filePath})`);
  }
}

async function createMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    // Validate template
    validateTemplate(template);

    // Helper function to normalize and validate paths
    const normalizePath = (filePath: string) => {
      return validatePath(filePath, process.cwd());
    };

    // Create files and their parent directories
    await Promise.all(
      Object.entries(template.config.files).map(async ([filePath, file]) => {
        const normalizedPath = normalizePath(filePath);

        if (!dryRun) {
          await fs.ensureDir(path.dirname(normalizedPath));
        }
        await writeFile(normalizedPath, file, dryRun);
        // relinka("verbose", `Created mock file: ${normalizedPath}`);
      }),
    );

    if (!dryRun) {
      relinka(
        "success",
        "Mock structure created successfully (used template: " + template.name + ")",
      );
    } else {
      relinka("success", "[DRY RUN] Mock structure would be created successfully");
    }
  } catch (error) {
    handleError(error, "createMockStructure");
  }
}

async function cleanupMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    // Validate template
    validateTemplate(template);

    const paths = Object.keys(template.config.files);
    let filesRemoved = 0;

    // Delete files and their parent directories
    for (const filePath of paths) {
      const normalizedPath = validatePath(filePath, process.cwd());

      if (dryRun) {
        relinka("log", `[DRY RUN] Would remove: ${normalizedPath}`);
        continue;
      }

      try {
        if (await fs.pathExists(normalizedPath)) {
          await fs.remove(normalizedPath);
          // relinka("verbose", `Removed: ${normalizedPath}`);
          filesRemoved++;

          // Try to remove parent directory if empty
          const parentDir = path.dirname(normalizedPath);
          if (await fs.pathExists(parentDir)) {
            const files = await fs.readdir(parentDir);
            if (files.length === 0) {
              await fs.remove(parentDir);
              relinka("log", `Removed empty directory: ${parentDir}`);
            }
          }
        }
      } catch (error) {
        relinka(
          "warn",
          `Failed to remove ${normalizedPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (dryRun) {
      relinka("success", "[DRY RUN] Mock structure would be cleaned up successfully");
    } else {
      relinka("success", `Mock structure cleaned up successfully (removed ${filesRemoved} files)`);
    }
  } catch (error) {
    handleError(error, "cleanupMockStructure");
  }
}

async function handleExistingPaths(template: Template, force: boolean): Promise<boolean> {
  try {
    // Validate template
    validateTemplate(template);

    const paths = Object.keys(template.config.files);

    const existingPaths = await Promise.all(
      paths.map(async (filePath) => {
        const normalizedPath = validatePath(filePath, process.cwd());
        return { path: normalizedPath, exists: await fs.pathExists(normalizedPath) };
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
        await checkPermissions(conflict.path, "write");
        await fs.remove(conflict.path);
        // relinka("verbose", `Cleaned up existing path: ${conflict.path}`);
      }
    }

    return true;
  } catch (error) {
    handleError(error, "handleExistingPaths");
    return false;
  }
}

export default defineCommand({
  meta: {
    name: "mock",
    version: "1.0.0",
    description:
      "Bootstraps file structure based on the specified mock template. Pro tip: Run e.g. 'dler merge --s src/templates --d templates/my-template.ts --as-template' (glob supported) to create mock template based on your own file structure.",
  },
  args: {
    template: {
      type: "string",
      description:
        "Mock template to use (default: react) (available: " +
        Object.keys(DLER_TEMPLATES).join(", ") +
        ")",
      default: "react",
    },
    "template-file": {
      type: "string",
      description:
        "Custom template file to use instead of default dler's src/app/template/mock-template.ts",
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
    try {
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
        try {
          // Load custom template file using jiti
          const module = await jiti.import(templateFile);
          const templatesKey = `${whitelabel}_TEMPLATES`;
          const loadedTemplates = (module as unknown as Record<string, Record<string, Template>>)[
            templatesKey
          ];

          if (!loadedTemplates) {
            throw new Error(`No templates found with prefix: ${whitelabel}`);
          }
          templates = loadedTemplates;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          relinka("error", `Failed to load template file: ${errorMessage}`);
          process.exit(1);
        }
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

          try {
            if (templateFile) {
              const module = await jiti.import(templateFile);
              templateConst = (module as unknown as Record<string, Template>)[constName];
            } else {
              const templateKey = dlerTemplatesMap[constName];
              if (!templateKey) {
                throw new Error(
                  `Invalid template constant: ${constName}. Available constants: ${Object.keys(dlerTemplatesMap).join(", ")}`,
                );
              }
              templateConst = DLER_TEMPLATES[templateKey];
            }

            if (!templateConst) {
              throw new Error(`Template constant not found: ${constName}`);
            }
            // Use the template name in lowercase as the key
            filteredTemplates[templateConst.name.toLowerCase()] = templateConst;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            relinka("error", errorMessage);
            process.exit(1);
          }
        }

        templates = filteredTemplates;
      }

      // Validate template
      if (!templates[template]) {
        throw new Error(
          `Invalid template: ${template}. Available templates: ${Object.keys(templates).join(", ")}`,
        );
      }

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
