import { glob } from "tinyglobby";
import type { CallExpression, SourceFile, VariableDeclaration } from "ts-morph";
import { ModuleKind, Node, Project, ScriptTarget, SyntaxKind } from "ts-morph";

interface CommanderOption {
  name: string;
  type: "string" | "boolean" | "number";
  description: string;
  defaultValue?: unknown;
  shortFlag?: string;
  required?: boolean;
}

interface CommandInfo {
  commandName?: string;
  actionFunction?: Node;
  actionFunctionParam?: string;
  options: CommanderOption[];
  description?: string;
  version?: string;
}

/**
 * Parses Commander-style flags into a structured format
 * Example: "--name <value>" becomes { longName: "name", shortName: undefined, takesValue: true }
 */
function parseCommanderFlags(flags: string): {
  longName: string;
  shortName?: string;
  takesValue: boolean;
} {
  const parts = flags.split(/[\s,]+/).filter(Boolean);
  let longName = "";
  let shortName: string | undefined;
  let takesValue = false;

  for (const part of parts) {
    if (part.startsWith("--")) {
      longName = part.substring(2);
    } else if (part.startsWith("-") && part.length === 2) {
      shortName = part.substring(1);
    }
  }

  // Check for value: if <...> or [...] is present
  if (flags.includes("<") || flags.includes("[")) {
    takesValue = true;
    // Clean up longName if it includes the value placeholder
    longName = longName.replace(/[<[].*/, "").trim();
  }

  if (!longName && shortName) {
    // If only short flag is defined, use it as the long name
    if (flags.includes(`<${shortName}>`)) takesValue = true;
    longName = shortName;
  }

  if (!longName) {
    throw new Error(`Could not parse flags: ${flags}`);
  }

  return { longName, shortName, takesValue };
}

/**
 * Extracts the default value from a Node
 */
function getDefaultValueText(node: Node | undefined): string | undefined {
  if (!node) return;

  if (Node.isLiteralExpression(node)) {
    return node.getText();
  }

  if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
    return node.getText();
  }

  if (Node.isCallExpression(node)) {
    return node.getText();
  }

  if (Node.isPrefixUnaryExpression(node)) {
    return node.getText();
  }

  console.warn(`Unhandled default value type: ${node.getKindName()}, text: ${node.getText()}`);
  return node.getText(); // Best effort
}

/**
 * Transforms a Commander command into a Rempts command structure
 */
async function transformCommand(
  varDecl: VariableDeclaration,
  info: CommandInfo,
  sourceFile: SourceFile,
) {
  const commandName = info.commandName;
  if (!commandName) {
    console.warn("No command name found");
    return;
  }

  let actionBodyText = "";
  if (info.actionFunction) {
    if (
      Node.isArrowFunction(info.actionFunction) ||
      Node.isFunctionExpression(info.actionFunction) ||
      Node.isFunctionDeclaration(info.actionFunction)
    ) {
      const body = info.actionFunction.getBody();
      if (body) {
        actionBodyText = body.getText();

        // If it's a block, remove the curly braces
        if (Node.isBlock(body)) {
          actionBodyText = actionBodyText.slice(1, -1).trim();
        }
      }
    } else {
      console.warn(`Unhandled action function type: ${info.actionFunction.getKindName()}`);
    }
  }

  // Reverse options because we parsed them from right-to-left in the chain
  info.options.reverse();

  // Replace parameter name with 'args' using string replacement
  if (info.actionFunctionParam) {
    const paramRegex = new RegExp(`\\b${info.actionFunctionParam}\\b`, "g");
    actionBodyText = actionBodyText.replace(paramRegex, "args");
  }

  // Create Rempts defineCommand structure
  const argsProperties = info.options
    .map((opt) => {
      const defaultValueStr = opt.defaultValue
        ? `,\n      default: ${String(opt.defaultValue)}`
        : "";
      const requiredStr = opt.required ? ",\n      required: true" : "";

      return `    ${opt.name}: {
      type: "${opt.type}",
      description: "${opt.description}"${defaultValueStr}${requiredStr}
    }`;
    })
    .join(",\n");

  const defineCommandText = `
export const ${varDecl.getName()} = defineCommand({
  meta: {
    name: "${commandName}",
    version: "${info.version || "1.0.0"}",
    description: "${info.description || "Migrated from Commander"}",
  },
  args: {
${argsProperties}
  },
  async run({ args }) {
${actionBodyText}
  },
});

// Add runMain at the end of the file
await runMain(${varDecl.getName()});
`;

  // Replace the original variable declaration with the new command
  varDecl.replaceWithText(defineCommandText);

  // If the original action was a separate function declaration, remove it
  if (info.actionFunction && Node.isIdentifier(info.actionFunction)) {
    const funcName = info.actionFunction.getText();
    const funcDecl = sourceFile.getFunction(funcName);
    if (funcDecl) {
      funcDecl.remove();
    }
  }

  // Fix imports and save
  sourceFile.fixMissingImports();
  await sourceFile.save();
  console.log(`Transformed command in: ${sourceFile.getFilePath()}`);
}

/**
 * Extracts command information from a Commander command chain
 */
function extractCommandInfo(node: Node, sourceFile: SourceFile): CommandInfo | undefined {
  const info: CommandInfo = {
    options: [],
  };

  if (Node.isNewExpression(node)) {
    const expr = node.getExpression();
    if (expr && Node.isIdentifier(expr) && expr.getText() === "Command") {
      const commandArg = node.getArguments()[0];
      if (commandArg && Node.isStringLiteral(commandArg)) {
        info.commandName = commandArg.getLiteralText();
      }
      return info;
    }
  }

  if (Node.isCallExpression(node)) {
    let tempExpr: Node | undefined = node;

    while (tempExpr && Node.isCallExpression(tempExpr)) {
      const expression = tempExpr.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const methodName = expression.getName();

        switch (methodName) {
          case "action":
            handleActionMethod(tempExpr, info, sourceFile);
            break;
          case "option":
            handleOptionMethod(tempExpr, info);
            break;
          case "description":
            handleDescriptionMethod(tempExpr, info);
            break;
          case "version":
            handleVersionMethod(tempExpr, info);
            break;
        }
      }

      const parent = tempExpr.getParent();
      tempExpr = Node.isCallExpression(parent) ? parent : undefined;
    }

    return info;
  }

  return;
}

function handleActionMethod(node: CallExpression, info: CommandInfo, sourceFile: SourceFile) {
  const [actionArg] = node.getArguments();
  if (actionArg && Node.isIdentifier(actionArg)) {
    const funcDef =
      sourceFile.getFunction(actionArg.getText()) ||
      sourceFile.getVariableDeclaration(actionArg.getText())?.getInitializer();

    if (
      funcDef &&
      (Node.isArrowFunction(funcDef) ||
        Node.isFunctionDeclaration(funcDef) ||
        Node.isFunctionExpression(funcDef))
    ) {
      info.actionFunction = funcDef;
      const firstParam = funcDef.getParameters()[0];
      if (firstParam) {
        info.actionFunctionParam = firstParam.getName();
      }
    }
  }
}

function handleOptionMethod(node: CallExpression, info: CommandInfo) {
  const [flagsArg, descArg, defaultValueArg] = node.getArguments();
  if (flagsArg && Node.isStringLiteral(flagsArg)) {
    const { longName, shortName, takesValue } = parseCommanderFlags(flagsArg.getLiteralText());
    info.options.push({
      name: longName,
      shortFlag: shortName,
      type: takesValue ? "string" : "boolean",
      description: Node.isStringLiteral(descArg)
        ? descArg.getLiteralText()
        : "TODO: Add description",
      defaultValue: defaultValueArg ? getDefaultValueText(defaultValueArg) : undefined,
    });
  }
}

function handleDescriptionMethod(node: CallExpression, info: CommandInfo) {
  const [descArg] = node.getArguments();
  if (descArg && Node.isStringLiteral(descArg)) {
    info.description = descArg.getLiteralText();
  }
}

function handleVersionMethod(node: CallExpression, info: CommandInfo) {
  const [versionArg] = node.getArguments();
  if (versionArg && Node.isStringLiteral(versionArg)) {
    info.version = versionArg.getLiteralText();
  }
}

/**
 * Main function to transform Commander commands to Rempts format
 */
export async function commanderToRempts(targetDirectory: string) {
  if (!targetDirectory) {
    throw new Error("Target directory is required");
  }

  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const filePaths = await glob(`${targetDirectory}/**/*.ts`, {
    ignore: ["**/node_modules/**", "**/*.d.ts"],
    absolute: true,
  });

  for (const filePath of filePaths) {
    console.log(`Processing: ${filePath}`);
    project.addSourceFileAtPath(filePath);
    try {
      await transformFile(filePath, project);
    } catch (error) {
      console.error(`Error transforming file ${filePath}:`, error);
    }
  }

  console.log("Migration completed successfully.");
}

/**
 * Transforms a file containing Commander commands to Rempts format
 */
async function transformFile(filePath: string, project: Project) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    console.error(`Could not find source file: ${filePath}`);
    return;
  }

  // Update imports
  const commanderImport = sourceFile.getImportDeclaration("commander");
  if (commanderImport) {
    commanderImport.remove();
  }

  const remptsImport = sourceFile.getImportDeclaration("@reliverse/rempts");
  const neededRemptsImports = ["defineCommand", "runMain"];
  if (remptsImport) {
    const existingNamedImports = remptsImport.getNamedImports().map((ni) => ni.getName());
    for (const neededImport of neededRemptsImports) {
      if (!existingNamedImports.includes(neededImport)) {
        remptsImport.addNamedImport(neededImport);
      }
    }
  } else {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "@reliverse/rempts",
      namedImports: neededRemptsImports,
    });
  }

  // Process Variable Declarations
  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

  for (const varDecl of variableDeclarations) {
    const initializer = varDecl.getInitializer();
    if (!initializer) continue;

    const commandInfo = extractCommandInfo(initializer, sourceFile);
    if (commandInfo) {
      await transformCommand(varDecl, commandInfo, sourceFile);
    }
  }
}
