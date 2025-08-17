import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";

/**
 * Converts a TypeBox schema to a JSON Schema
 */
function convertTypeBoxToJsonSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  // Handle TypeBox specific conversions
  if (schema.type === "string" && schema.enum) {
    return {
      type: "string",
      enum: schema.enum,
    };
  }

  // Handle unions (convert to enum if all literals)
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    const variants = schema.anyOf || schema.allOf || schema.oneOf;
    const allLiterals = variants.every((v: any) => v.const !== undefined);

    if (allLiterals) {
      return {
        type: "string",
        enum: variants.map((v: any) => v.const),
      };
    }
  }

  // Handle objects
  if (schema.type === "object") {
    const result: any = {
      type: "object",
      properties: {},
    };

    if (schema.required) {
      result.required = schema.required;
    }

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        result.properties[key] = convertTypeBoxToJsonSchema(value);
      }
    }

    // Handle additional properties
    if (schema.additionalProperties) {
      result.additionalProperties = convertTypeBoxToJsonSchema(schema.additionalProperties);
    }

    // Handle pattern properties
    if (schema.patternProperties) {
      result.patternProperties = {};
      for (const [pattern, value] of Object.entries(schema.patternProperties)) {
        result.patternProperties[pattern] = convertTypeBoxToJsonSchema(value);
      }
    }

    return result;
  }

  // Handle arrays
  if (schema.type === "array") {
    return {
      type: "array",
      items: convertTypeBoxToJsonSchema(schema.items),
    };
  }

  // Handle basic types
  if (schema.type) {
    const result: any = { type: schema.type };
    if (schema.minimum !== undefined) result.minimum = schema.minimum;
    if (schema.maximum !== undefined) result.maximum = schema.maximum;
    if (schema.minLength !== undefined) result.minLength = schema.minLength;
    if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
    if (schema.pattern !== undefined) result.pattern = schema.pattern;
    if (schema.format !== undefined) result.format = schema.format;
    if (schema.default !== undefined) result.default = schema.default;
    return result;
  }

  return schema;
}

/**
 * Generates a JSON schema file from the TypeBox schema
 */
export async function generateJsonSchema(typeboxSchema: any, outputPath: string): Promise<void> {
  const converted = convertTypeBoxToJsonSchema(typeboxSchema);

  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "rse configuration schema",
    description: "https://docs.reliverse.org",
    type: "object",
    properties: converted.properties,
    required: converted.required,
  };

  await fs.writeFile(outputPath, JSON.stringify(schema, null, 2));
}

/**
 * Generates the schema.json in the project root
 */
export async function generateSchemaFile(schema: any): Promise<void> {
  const schemaPath = path.join(process.cwd(), "schema.json");
  if (fs.existsSync(schemaPath)) {
    await fs.remove(schemaPath);
  }
  await generateJsonSchema(schema, schemaPath);
}
