import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { generateReltypesContent } from "./gen";

// Timestamp when types were last updated
// Update this constant when making changes to the type definitions
// The file will be regenerated if the existing reltypes.ts has an older timestamp
// Format: YYYY-MM-DD (ISO date format, easy to read and compare)
const LAST_UPDATED = "2025-08-26";

export async function checkIfRegenerationNeeded(reltypesPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(reltypesPath, "utf8");
    const lines = content.split("\n");
    const firstLine = lines[0];

    if (!firstLine) {
      return true; // Empty file, regenerate
    }

    // Extract ISO date from comment like "// reliverse.ts types version 2025-08-26"
    const dateMatch = firstLine.match(/^\/\/ reliverse\.ts types version (\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch || !dateMatch[1]) {
      return true; // No timestamp found, regenerate
    }

    const fileDate = new Date(dateMatch[1]);
    if (Number.isNaN(fileDate.getTime())) {
      return true; // Invalid date, regenerate
    }
    const lastUpdated = new Date(LAST_UPDATED);

    // Compare dates (ignoring time components)
    return fileDate < lastUpdated;
  } catch {
    return true; // Error reading file, regenerate
  }
}

export async function ensureReltypesFile(cwd: string) {
  const reltypesPath = path.resolve(cwd, "reltypes.ts");

  // If package.json exists and has @reliverse/dler, skip generating reltypes.ts
  try {
    const pkgJsonPath = path.resolve(cwd, "package.json");
    if (await fs.pathExists(pkgJsonPath)) {
      const raw = await fs.readFile(pkgJsonPath, "utf8");
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const hasDler = Boolean(
        (pkg.dependencies && pkg.dependencies["@reliverse/dler"]) ||
          (pkg.devDependencies && pkg.devDependencies["@reliverse/dler"]),
      );
      if (hasDler) {
        return; // Prefer package import; do not generate reltypes.ts
      }
    }
  } catch {
    // Ignore errors and fall back to generating reltypes.ts if needed
  }

  // Check if reliverse.ts already exists and if it needs regeneration
  if (await fs.pathExists(reltypesPath)) {
    const needsRegeneration = await checkIfRegenerationNeeded(reltypesPath);
    if (!needsRegeneration) {
      return; // File exists and is up to date
    }
    relinka("verbose", "reltypes.ts exists but is outdated, regenerating...");
  }

  try {
    const reltypesContent = generateReltypesContent({ lastUpdated: LAST_UPDATED });
    const isNewFile = !(await fs.pathExists(reltypesPath));
    await fs.outputFile(reltypesPath, reltypesContent, { encoding: "utf8" });

    if (isNewFile) {
      relinka("success", `Generated reltypes.ts at ${reltypesPath}`);
    } else {
      relinka("success", `Regenerated reltypes.ts at ${reltypesPath}`);
    }
    relinka("verbose", "This file contains TypeScript types for your reliverse.ts configuration");
  } catch (error: unknown) {
    relinka(
      "warn",
      `Could not generate reltypes.ts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Validator-agnostic JSON schema generator
export interface JsonSchemaDocument {
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export type SchemaFactory = () => JsonSchemaDocument | Promise<JsonSchemaDocument>;

export async function generateSchemaFile({
  filePath,
  schemaOrFactory,
}: {
  filePath: string;
  schemaOrFactory: JsonSchemaDocument | SchemaFactory;
}): Promise<void> {
  try {
    const schema =
      typeof schemaOrFactory === "function"
        ? await (schemaOrFactory as SchemaFactory)()
        : schemaOrFactory;

    const finalized: JsonSchemaDocument = {
      $schema: "http://json-schema.org/draft-07/schema#",
      ...schema,
    };

    await fs.outputFile(filePath, JSON.stringify(finalized, null, 2), { encoding: "utf8" });
    relinka("success", `Generated schema at ${filePath}`);
  } catch (error: unknown) {
    relinka(
      "warn",
      `Could not generate schema file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
