import { callCmd } from "@reliverse/rempts";
import { default as remptsCmd } from "~/app/rempts/cmd";

/**
 * Utility functions for common generator patterns using typed commands
 */

interface GenerateCommandsOptions {
  commands: string | string[];
  customRoot?: string;
  outputFile?: string;
  overwrite?: boolean;
}

interface GenerateModuleOptions {
  moduleName: string;
  commands: string[];
  moduleRoot?: string;
  overwrite?: boolean;
}

/**
 * Generate new commands with simplified options
 */
export async function generateCommands({
  commands,
  customRoot,
  outputFile = "src-ts/app/cmds.ts",
  overwrite = true,
}: GenerateCommandsOptions): Promise<void> {
  const commandString = Array.isArray(commands) ? commands.join(" ") : commands;

  await callCmd(remptsCmd, {
    init: commandString,
    customCmdsRoot: customRoot,
    outFile: outputFile,
    overwrite,
  });
}

/**
 * Generate a complete module with CRUD commands
 */
export async function generateModule({
  moduleName,
  commands,
  moduleRoot = "src/modules",
  overwrite = true,
}: GenerateModuleOptions): Promise<void> {
  const moduleDir = `${moduleRoot}/${moduleName}`;
  const commandString = commands.join(" ");

  await callCmd(remptsCmd, {
    init: commandString,
    customCmdsRoot: moduleDir,
    outFile: `${moduleDir}/cmds.ts`,
    overwrite,
  });
}

/**
 * Generate CRUD commands for a resource
 */
export async function generateCrudModule(
  resourceName: string,
  options?: Omit<GenerateModuleOptions, "moduleName" | "commands">,
): Promise<void> {
  const crudCommands = [
    `${resourceName}-create`,
    `${resourceName}-read`,
    `${resourceName}-update`,
    `${resourceName}-delete`,
    `${resourceName}-list`,
  ];

  await generateModule({
    moduleName: resourceName,
    commands: crudCommands,
    ...options,
  });
}

/**
 * Regenerate all command exports
 */
export async function regenerateExports(
  outputFile = "src-ts/app/cmds.ts",
  overwrite = true,
): Promise<void> {
  await callCmd(remptsCmd, {
    overwrite,
    outFile: outputFile,
  });
}

/**
 * Generate exports for specific command directories
 */
export async function generateSelectiveExports(
  directories: string[],
  outputFile: string,
  overwrite = true,
): Promise<void> {
  await callCmd(remptsCmd, {
    cmdDirs: directories,
    outFile: outputFile,
    overwrite,
  });
}

/**
 * Batch create multiple modules with their commands
 */
export async function generateMultipleModules(
  modules: { name: string; commands: string[] }[],
  options?: Omit<GenerateModuleOptions, "moduleName" | "commands">,
): Promise<void> {
  for (const module of modules) {
    await generateModule({
      moduleName: module.name,
      commands: module.commands,
      ...options,
    });
  }

  // Generate a master exports file for all modules
  const moduleNames = modules.map((m) => m.name);
  await generateSelectiveExports(moduleNames, `${options?.moduleRoot || "src/modules"}/index.ts`);
}

/**
 * Generate API endpoint commands
 */
export async function generateApiModule(
  apiName: string,
  endpoints: string[] = ["get", "post", "put", "delete"],
  options?: Omit<GenerateModuleOptions, "moduleName" | "commands">,
): Promise<void> {
  const apiCommands = endpoints.map((endpoint) => `${apiName}-${endpoint}`);

  await generateModule({
    moduleName: `api-${apiName}`,
    commands: apiCommands,
    ...options,
  });
}

/**
 * Generate database model commands
 */
export async function generateDbModule(
  modelName: string,
  operations: string[] = ["migrate", "seed", "rollback", "status"],
  options?: Omit<GenerateModuleOptions, "moduleName" | "commands">,
): Promise<void> {
  const dbCommands = operations.map((op) => `${modelName}-${op}`);

  await generateModule({
    moduleName: `db-${modelName}`,
    commands: dbCommands,
    ...options,
  });
}

export async function typedGenerators() {
  await generateCommands({
    commands: ["my-new-cmd", "another-cmd"],
    customRoot: "src/custom-commands",
    outputFile: "src/custom-commands/cmds.ts",
    overwrite: true,
  });
}
