import { selectPrompt } from "@reliverse/rempts";

/**
 * Prompts the user to select a config file type (JSONC or TS)
 * @returns The selected config type ('jsonc' or 'ts')
 */
export async function askReliverseConfigType(): Promise<"jsonc" | "ts"> {
  return await selectPrompt({
    title: "Please select a configuration file kind.",
    content: "TypeScript is recommended for most projects.",
    options: [
      { label: "TypeScript (recommended)", value: "ts" },
      { label: "JSONC", value: "jsonc" },
    ],
    defaultValue: "ts",
  });
}
