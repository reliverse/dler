// - merge/cmd.ts creates e.g. templates.ts (when as-templates was used)
// - mock/cmd.ts bootstraps file structure based on the templates.ts

// mock command is used to bootstrap file structure based on the specified mock template(s).
// simple example: `bun dler mock --template-file dler --templates react`
// advanced example: `bun dler mock --template-file dler --templates react --cleanup`

import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";
import { createJiti } from "jiti";
import prettyMilliseconds from "pretty-ms";

import type {
  TemplatesFileContent,
  Template,
} from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";
import { createPerfTimer, getElapsedPerfTime } from "~/libs/sdk/sdk-impl/utils/utils-perf";
import {
  validatePath,
  validateFileType,
  validateContent,
  checkPermissions,
  handleError,
  validateTemplate,
  sanitizeInput,
} from "~/libs/sdk/sdk-impl/utils/utils-security";

import { DLER_TEMPLATES, dlerTemplatesMap } from "./mock";

const jiti = createJiti(import.meta.url);

async function writeFile(
  filePath: string,
  file: TemplatesFileContent,
  dryRun: boolean,
): Promise<void> {
  try {
    const { content, type } = file;

    validateFileType(type);
    validateContent(content, type);

    const sanitizedPath = sanitizeInput(filePath);

    if (dryRun) {
      relinka("log", `[DRY RUN] Would write file: ${sanitizedPath}`);
      return;
    }

    const isBinary = await isBinaryExt(sanitizedPath);
    if (isBinary && type !== "binary") {
      relinka(
        "warn",
        `Warning: File ${sanitizedPath} appears to be binary but is not marked as such in template`,
      );
    }

    await checkPermissions(sanitizedPath, "write");

    if (type === "json") {
      // Handle special case for package.json and tsconfig.json
      const fileName = path.basename(sanitizedPath).toLowerCase();
      if (fileName === "package.json" || fileName === "tsconfig.json") {
        // Remove the "satisfies PackageJson" or "satisfies TSConfig" suffix if present
        const cleanContent =
          typeof content === "string"
            ? content.replace(/\s+satisfies\s+(?:PackageJson|TSConfig)$/, "")
            : content;
        await fs.writeJson(sanitizedPath, cleanContent, { spaces: 2 });
      } else {
        await fs.writeJson(sanitizedPath, content, { spaces: 2 });
      }
    } else if (type === "binary") {
      // For binary files, we expect the content to be a Buffer or base64 string
      const binaryContent =
        typeof content === "string" ? Buffer.from(content, "base64") : Buffer.from(content as any);
      await fs.writeFile(sanitizedPath, binaryContent);
    } else {
      await fs.writeFile(sanitizedPath, content as string, "utf8");
    }
  } catch (error) {
    handleError(error, `writeFile(${filePath})`);
  }
}

async function createMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    validateTemplate(template);

    const normalizePath = (filePath: string) => validatePath(filePath, process.cwd());

    // Process files in parallel but maintain order for better error reporting
    const fileEntries = Object.entries(template.config.files);
    const results = await Promise.allSettled(
      fileEntries.map(async ([filePath, file]) => {
        const normalizedPath = normalizePath(filePath);

        if (!dryRun) {
          await fs.ensureDir(path.dirname(normalizedPath));
        }
        await writeFile(normalizedPath, file, dryRun);
      }),
    );

    // Check for any failures
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      throw new Error(
        `Failed to create ${failures.length} file(s):\n${failures.map((f) => f.reason).join("\n")}`,
      );
    }

    relinka(
      "success",
      dryRun
        ? `[DRY RUN] Mock structure would be created successfully (template: ${template.name})`
        : `Mock structure created successfully (template: ${template.name})`,
    );
  } catch (error) {
    handleError(error, "createMockStructure");
  }
}

async function cleanupMockStructure(template: Template, dryRun: boolean): Promise<void> {
  try {
    validateTemplate(template);

    const paths = Object.keys(template.config.files);
    let filesRemoved = 0;
    const processedDirs = new Set<string>();

    // First pass: remove files
    for (const filePath of paths) {
      const normalizedPath = validatePath(filePath, process.cwd());

      if (dryRun) {
        relinka("log", `[DRY RUN] Would remove: ${normalizedPath}`);
        continue;
      }

      try {
        if (await fs.pathExists(normalizedPath)) {
          await fs.remove(normalizedPath);
          filesRemoved++;
          processedDirs.add(path.dirname(normalizedPath));
        }
      } catch (error) {
        relinka(
          "warn",
          `Failed to remove ${normalizedPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Second pass: recursively remove empty directories
    const removeEmptyDirs = async (dirPath: string): Promise<void> => {
      if (!(await fs.pathExists(dirPath))) return;

      const entries = await fs.readdir(dirPath);
      if (entries.length === 0) {
        await fs.remove(dirPath);
        // relinka("verbose", `Removed empty directory: ${dirPath}`);

        // Process parent directory
        const parentDir = path.dirname(dirPath);
        if (parentDir !== dirPath) {
          // Prevent infinite recursion at root
          await removeEmptyDirs(parentDir);
        }
      }
    };

    // Process all directories that contained removed files
    for (const dirPath of processedDirs) {
      await removeEmptyDirs(dirPath);
    }

    relinka(
      "success",
      dryRun
        ? `[DRY RUN] Mock structure would be cleaned up successfully (template: ${template.name})`
        : `Mock structure cleaned up successfully (removed ${filesRemoved} files, template: ${template.name})`,
    );
  } catch (error) {
    handleError(error, "cleanupMockStructure");
  }
}

async function handleExistingPaths(template: Template, force: boolean): Promise<boolean> {
  try {
    validateTemplate(template);

    const paths = Object.keys(template.config.files);

    const conflicts = (
      await Promise.all(
        paths.map(async (filePath) => {
          const normalizedPath = validatePath(filePath, process.cwd());
          return { path: normalizedPath, exists: await fs.pathExists(normalizedPath) };
        }),
      )
    ).filter((p) => p.exists);

    if (conflicts.length > 0) {
      if (!force) {
        throw new Error(
          `Path conflicts detected for template '${template.name}'. Conflicting paths:\n${conflicts
            .map((c) => c.path)
            .join("\n")}`,
        );
      }

      for (const conflict of conflicts) {
        await checkPermissions(conflict.path, "write");
        await fs.remove(conflict.path);
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
    version: "1.2.0",
    description:
      "Bootstraps file structure based on the specified mock template(s). Pro tip: Run 'dler merge --s src/templates --d templates/my-template.ts --as-templates' (glob supported) to create mock templates from your own file structure.",
  },
  args: defineArgs({
    config: {
      type: "string",
      description:
        "Custom template file to use instead of dler's src/app/mock/mock.ts example (type 'dler' to use built-in templates)",
      required: true,
    },
    templates: {
      type: "string",
      description:
        "Template identifier/constant to use or 'all' to process every template (keys: " +
        Object.keys(DLER_TEMPLATES).join(", ") +
        "; constants: " +
        Object.keys(dlerTemplatesMap).join(", ") +
        ")",
      default: "all",
    },
    "templates-multi": {
      type: "boolean",
      description:
        "Treat the templates file as an aggregator that exports multiple templates (default: true)",
      default: true,
    },
    cleanup: {
      type: "boolean",
      description: "Clean up existing mock files generated by the template(s)",
    },
    "dry-run": {
      type: "boolean",
      description: "Preview changes without applying them",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
    },
    whitelabel: {
      type: "string",
      description: "Custom prefix used instead of 'DLER' when resolving template constants",
      default: "DLER",
    },
    force: {
      type: "boolean",
      description: "Overwrite or delete existing paths when conflicts are detected (default: true)",
    },
  }),
  async run({ args }) {
    try {
      const {
        config: templatesConfig,
        templates: templatesArg = "all",
        "templates-multi": templatesMulti = true,
        cleanup,
        "dry-run": dryRun,
        verbose,
        whitelabel = "DLER",
        force,
      } = args;

      if (verbose) relinka("log", "Verbose logging enabled");

      /* ----------------------------------------------------------------
       * LOAD AVAILABLE TEMPLATES
       * ---------------------------------------------------------------- */
      let availableTemplates: Record<string, Template>;

      if (templatesConfig === "dler") {
        availableTemplates = DLER_TEMPLATES;
      } else {
        try {
          const module = await jiti.import(templatesConfig);

          if (templatesMulti) {
            const templatesKey = `${whitelabel}_TEMPLATES`;
            const loadedTemplates = (module as unknown as Record<string, Record<string, Template>>)[
              templatesKey
            ];

            if (!loadedTemplates) {
              throw new Error(`No templates found with prefix: ${whitelabel}`);
            }
            availableTemplates = loadedTemplates;
          } else {
            const singleTemplate = (module as unknown as Record<string, Template>)[
              templatesArg.trim()
            ];

            if (!singleTemplate) {
              throw new Error(
                `Template ${templatesArg.trim()} not found in single-template file ${templatesConfig}`,
              );
            }

            availableTemplates = { [singleTemplate.name]: singleTemplate };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          relinka("error", `Failed to load template file: ${message}`);
          process.exit(1);
        }
      }

      /* ----------------------------------------------------------------
       * RESOLVE TEMPLATE(S)
       * ---------------------------------------------------------------- */
      const resolveTemplate = async (token: string): Promise<Template | undefined> => {
        if (availableTemplates[token]) return availableTemplates[token];

        if (templatesConfig !== "dler") {
          try {
            const module = await jiti.import(templatesConfig);
            const constant = (module as unknown as Record<string, Template>)[token];
            if (constant) return constant;
          } catch {
            /* ignore */
          }
        }

        const builtInKey = dlerTemplatesMap[token];
        if (builtInKey && DLER_TEMPLATES[builtInKey]) return DLER_TEMPLATES[builtInKey];

        return undefined;
      };

      let selectedTemplates: Template[];

      if (templatesArg.trim() === "all") {
        selectedTemplates = Object.values(availableTemplates);
      } else {
        const templateTokens = templatesArg.trim().split(/\s+/);
        const resolvedTemplates: Template[] = [];

        for (const token of templateTokens) {
          const resolved = await resolveTemplate(token);

          if (!resolved) {
            throw new Error(
              `Invalid template reference: ${token}. ` +
                `Available keys: ${Object.keys(availableTemplates).join(", ")}; ` +
                `Available constants: ${Object.keys(dlerTemplatesMap).join(", ")}`,
            );
          }
          resolvedTemplates.push(resolved);
        }

        selectedTemplates = resolvedTemplates;
      }

      /* ----------------------------------------------------------------
       * EXECUTION
       * ---------------------------------------------------------------- */
      const timer = createPerfTimer();

      for (const template of selectedTemplates) {
        if (cleanup) {
          await cleanupMockStructure(template, dryRun);
          continue; // Skip creation after cleanup
        }

        if (!(await handleExistingPaths(template, force))) continue;
        await createMockStructure(template, dryRun);
      }

      // Only print paths and success message if we're not in cleanup mode
      if (!cleanup) {
        // print paths to root dirs of each bootstraped template
        for (const template of selectedTemplates) {
          relinka("log", `Bootstraped template: ${template.name}`);
          const firstFilePath = Object.keys(template.config.files)[0];
          if (firstFilePath) {
            relinka("log", `– Path: ${path.dirname(firstFilePath)}`);
          }
        }
        // notify about the end of the process
        relinka(
          "success",
          `Finished processing ${
            selectedTemplates.length
          } template(s) in ${prettyMilliseconds(getElapsedPerfTime(timer))}`,
        );
      } else {
        relinka(
          "success",
          `Finished cleanup of ${
            selectedTemplates.length
          } template(s) in ${prettyMilliseconds(getElapsedPerfTime(timer))}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      relinka("error", `Error during mock creation: ${message}`);
      process.exit(1);
    }
  },
});
