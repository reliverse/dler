import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";
import ky from "ky";
import MagicString from "magic-string";
import { readPackageJSON } from "pkg-types";

interface ConfigModEntry {
  version: string;
  mode: string;
  main: string;
  input: string;
  output: string;
}

interface ConfigModOptions {
  tool: string;
  mode: string;
  forceUpdate?: boolean;
  isDev?: boolean;
}

export async function ensureConfigMod(options: ConfigModOptions): Promise<void> {
  console.log("ensureConfigMod", options);

  const { tool, mode, forceUpdate = false, isDev = false } = options;
  const configModPath = path.resolve(process.cwd(), "mod.ts");

  // Read package.json to get version
  const pkg = await readPackageJSON().catch(() => ({ version: "1.0.0" as const }));

  // Read existing mod.ts or create new structure
  let dotConfig: Record<string, ConfigModEntry> = {};

  if ((await fs.pathExists(configModPath)) && !forceUpdate) {
    try {
      // Use jiti to safely import the existing config
      const jiti = createJiti(import.meta.url);

      const existingConfig = (await jiti.import(configModPath)) as {
        dotConfig?: Record<string, ConfigModEntry>;
      };
      if (existingConfig?.dotConfig && typeof existingConfig.dotConfig === "object") {
        dotConfig = existingConfig.dotConfig;
      }
    } catch (error) {
      relinka(
        "warn",
        `Could not import existing mod.ts: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Fallback to manual parsing if jiti fails
      try {
        const content = await fs.readFile(configModPath, "utf8");
        dotConfig = parseConfigManually(content);
      } catch (parseError) {
        relinka("warn", `Manual parsing also failed, starting with empty config`);
      }
    }
  }

  // Add/update the tool configuration
  const pkgVersion: string = pkg.version ?? "1.0.0";
  const toolConfig: ConfigModEntry = {
    version: pkgVersion,
    mode,
    main: "defineConfig",
    input: getInputSource(tool, mode, isDev),
    output: `types/${tool}.schema.ts`,
  };

  // Check if we need to download fresh types
  const existingConfig = dotConfig[tool];
  const shouldDownloadSchema = await shouldUpdateSchema(existingConfig, toolConfig);

  dotConfig[tool] = toolConfig;

  // Generate mod.ts content using magic-string
  const modContent = generateConfigModContent(dotConfig);
  await fs.outputFile(configModPath, modContent, { encoding: "utf8" });

  // Download and generate schema file only if needed
  if (shouldDownloadSchema) {
    await processSchema(toolConfig.input, toolConfig.output, mode);
    const action = mode === "copy-internal" ? "Copied" : "Downloaded";
    relinka("info", `${action} fresh types for ${tool} v${pkgVersion}`);
  } else {
    relinka("info", `Types for ${tool} v${pkgVersion} are up to date, skipping download`);
  }

  // Update the tool's config file with proper imports
  await updateToolConfigImports(tool, toolConfig.main);

  relinka("success", `Updated mod.ts with ${tool} configuration`);
}

async function shouldUpdateSchema(
  existingConfig: ConfigModEntry | undefined,
  newConfig: ConfigModEntry,
): Promise<boolean> {
  // Always update if no existing config
  if (!existingConfig) {
    return true;
  }

  // Check if version changed
  if (existingConfig.version !== newConfig.version) {
    relinka("info", `Version changed from ${existingConfig.version} to ${newConfig.version}`);
    return true;
  }

  // Check if input URL changed
  if (existingConfig.input !== newConfig.input) {
    relinka("info", `Schema input URL changed`);
    return true;
  }

  // Check if output file exists
  const outputPath = path.resolve(process.cwd(), newConfig.output);
  if (!(await fs.pathExists(outputPath))) {
    relinka("info", `Schema file ${newConfig.output} does not exist`);
    return true;
  }

  // Check if mode or main export changed (affects imports)
  if (existingConfig.mode !== newConfig.mode || existingConfig.main !== newConfig.main) {
    relinka("info", `Configuration mode or main export changed`);
    return true;
  }

  // Everything is up to date
  return false;
}

function getInputSource(tool: string, mode: string, isDev: boolean): string {
  if (mode === "copy-internal") {
    const sourceDir = isDev ? "src" : "bin";
    return `${sourceDir}/libs/cfg/cfg-dler.ts`;
  } else {
    // copy-remote mode (previously copy-paste)
    return getSchemaUrl(tool);
  }
}

async function processSchema(input: string, outputPath: string, mode: string): Promise<void> {
  if (mode === "copy-internal") {
    await copyInternalSchema(input, outputPath);
  } else {
    // copy-remote mode
    await downloadSchema(input, outputPath);
  }
}

async function copyInternalSchema(inputPath: string, outputPath: string): Promise<void> {
  try {
    const fullInputPath = path.resolve(process.cwd(), inputPath);
    const fullOutputPath = path.resolve(process.cwd(), outputPath);

    if (!(await fs.pathExists(fullInputPath))) {
      throw new Error(`Internal schema file not found: ${inputPath}`);
    }

    const content = await fs.readFile(fullInputPath, "utf8");
    await fs.outputFile(fullOutputPath, content, { encoding: "utf8" });

    relinka("success", `Copied internal schema from ${inputPath} to ${outputPath}`);
  } catch (error) {
    relinka(
      "error",
      `Failed to copy internal schema: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

function parseConfigManually(content: string): Record<string, ConfigModEntry> {
  try {
    // Find the dotConfig export
    const exportMatch = content.match(/export const dotConfig[^=]*=\s*({[\s\S]*?});/);
    if (!exportMatch?.[1]) {
      return {};
    }

    // Clean up the object string for JSON parsing
    const objStr = exportMatch[1]
      .replace(/(\w+):/g, '"$1":') // Quote keys
      .replace(/'/g, '"') // Replace single quotes with double quotes
      .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

    return JSON.parse(objStr) as Record<string, ConfigModEntry>;
  } catch (error) {
    relinka(
      "warn",
      `Failed to manually parse config: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }
}

function getSchemaUrl(tool: string): string {
  const schemaUrls: Record<string, string> = {
    dler: "https://raw.githubusercontent.com/blefnk/temp/refs/heads/main/dler-types.ts",
    rse: "https://raw.githubusercontent.com/blefnk/temp/refs/heads/main/rse-types.ts",
  };

  return schemaUrls[tool] || schemaUrls.dler!;
}

async function downloadSchema(inputUrl: string, outputPath: string): Promise<void> {
  try {
    const response = await ky.get(inputUrl);
    const content = await response.text();

    const fullOutputPath = path.resolve(process.cwd(), outputPath);
    await fs.outputFile(fullOutputPath, content, { encoding: "utf8" });

    relinka("success", `Downloaded schema to ${outputPath}`);
  } catch (error) {
    relinka(
      "error",
      `Failed to download schema: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

async function updateToolConfigImports(tool: string, mainExport: string): Promise<void> {
  const configPath = path.resolve(process.cwd(), `${tool}.ts`);

  if (!(await fs.pathExists(configPath))) {
    relinka("warn", `Config file ${tool}.ts not found, skipping import update`);
    return;
  }

  try {
    const content = await fs.readFile(configPath, "utf8");
    const s = new MagicString(content);

    const schemaImportPath = `./types/${tool}.schema`;
    const newImportStatement = `import { ${mainExport} } from "${schemaImportPath}";`;

    // Check if import already exists
    if (content.includes(schemaImportPath)) {
      relinka("info", `Import already exists in ${tool}.ts`);
      return;
    }

    // Find existing defineConfig import and replace it
    const existingImportRegex = /import\s*{\s*defineConfig\s*}\s*from\s*[^;]+;/;
    const existingImportMatch = content.match(existingImportRegex);

    if (existingImportMatch) {
      const start = content.indexOf(existingImportMatch[0]);
      const end = start + existingImportMatch[0].length;
      s.overwrite(start, end, newImportStatement);
    } else {
      // Find the best place to insert the import
      const lines = content.split("\n");
      let insertIndex = 0;
      let insertLine = 0;

      // Find the last import statement
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (line && line.startsWith("import ")) {
          insertLine = i + 1;
          insertIndex = content.indexOf(lines[i]!) + lines[i]!.length + 1;
        } else if (line === "") {
          /* empty line, continue */
        } else if (line) {
          break;
        }
      }

      // Insert the import at the appropriate position
      if (insertLine === 0) {
        // No existing imports, add at the beginning
        s.prepend(newImportStatement + "\n\n");
      } else {
        // Add after existing imports
        s.appendLeft(insertIndex, newImportStatement + "\n");
      }
    }

    const updatedContent = s.toString();
    await fs.writeFile(configPath, updatedContent, "utf8");
    relinka("success", `Updated imports in ${tool}.ts`);
  } catch (error) {
    relinka(
      "error",
      `Failed to update imports: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function generateConfigModContent(dotConfig: Record<string, ConfigModEntry>): string {
  const s = new MagicString("");

  // Add header
  s.append("// autogenerated by `dler config`\n");
  s.append("// don't edit this file manually\n\n");

  // Generate interfaces
  const interfaceDefinition = generateDotConfigInterface(dotConfig);
  s.append(interfaceDefinition);
  s.append("\n\n");

  // Generate dotConfig object with proper formatting
  s.append("export const dotConfig: DotConfig = ");
  s.append(JSON.stringify(dotConfig, null, 2));
  s.append(";\n");

  return s.toString();
}

function generateDotConfigInterface(dotConfig: Record<string, ConfigModEntry>): string {
  const s = new MagicString("");
  const toolNames = Object.keys(dotConfig);

  // ConfigModEntry interface
  s.append("export interface ConfigModEntry {\n");
  s.append("  version: string;\n");
  s.append("  mode: string;\n");
  s.append("  main: string;\n");
  s.append("  input: string;\n");
  s.append("  output: string;\n");
  s.append("}\n\n");

  // DotConfig interface
  s.append("export interface DotConfig {\n");

  // Add each tool as optional property
  toolNames.forEach((tool) => {
    s.append(`  ${tool}?: ConfigModEntry;\n`);
  });

  s.append("}");

  return s.toString();
}
