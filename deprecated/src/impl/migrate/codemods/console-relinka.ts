import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { inputPrompt, selectPrompt } from "@reliverse/rempts";

type LogFormat =
  | "console"
  | "consolaMethod"
  | "consolaObject"
  | "relinkaFunction"
  | "relinkaMethod"
  | "relinkaObject";

export async function consoleToRelinka(
  input?: string,
  from?: LogFormat,
  to?: LogFormat,
) {
  // Interactive prompts if arguments are not provided
  const finalInput =
    input ??
    (await inputPrompt({
      title: "Enter input file or directory path",
      placeholder: "e.g., src/**/*.ts",
    }));

  const finalFrom =
    from ??
    ((await selectPrompt({
      title: "Select source format",
      options: [
        { label: "console", value: "console" },
        { label: "consola method", value: "consolaMethod" },
        { label: "consola object", value: "consolaObject" },
        { label: "relinka function", value: "relinkaFunction" },
        { label: "relinka method", value: "relinkaMethod" },
        { label: "relinka object", value: "relinkaObject" },
      ],
    })) as LogFormat);

  const finalTo =
    to ??
    ((await selectPrompt({
      title: "Select target format",
      options: [
        { label: "console", value: "console" },
        { label: "consola method", value: "consolaMethod" },
        { label: "consola object", value: "consolaObject" },
        { label: "relinka function", value: "relinkaFunction" },
        { label: "relinka method", value: "relinkaMethod" },
        { label: "relinka object", value: "relinkaObject" },
      ],
    })) as LogFormat);

  if (!finalInput || !finalFrom || !finalTo) {
    relinka(
      "error",
      "Missing required arguments for console-relinka migration",
    );
    return;
  }

  // Validate input path exists
  if (!(await fs.pathExists(finalInput))) {
    relinka("error", `❌ Input path does not exist: ${finalInput}`);
    return;
  }

  // Read file content
  let content = await fs.readFile(finalInput, "utf8");
  let changes = false;

  const levels = [
    "log",
    "info",
    "warn",
    "error",
    "debug",
    "verbose",
    "success",
    "ready",
    "start",
    "box",
    "trace",
  ];

  // Helper function to get pattern based on source format
  const getSourcePattern = (level: string, format: LogFormat): RegExp => {
    switch (format) {
      case "console":
        return new RegExp(`console\\.${level}\\((.*?)(?:,\\s*(.*))?\\)`, "g");
      case "consolaMethod":
        if (level === "box") {
          return /consola\.box\(\s*{\s*title:\s*"([^"]*)",\s*message:\s*"([^"]*)"\s*\}\s*\)/g;
        }
        return new RegExp(`consola\\.${level}\\((.*?)(?:,\\s*(.*))?\\)`, "g");
      case "consolaObject":
        return new RegExp(
          `consola\\({level:\\s*"${level}",\\s*message:\\s*(.*?)(?:,\\s*title:\\s*"([^"]*)")?\\s*\\}\\)`,
          "g",
        );
      case "relinkaFunction":
        return new RegExp(
          `relinka\\("${level}",\\s*(.*?)(?:,\\s*(.*))?\\)`,
          "g",
        );
      case "relinkaMethod":
        return new RegExp(`relinka\\.${level}\\((.*?)(?:,\\s*(.*))?\\)`, "g");
      case "relinkaObject":
        return new RegExp(
          `relinka\\({level:\\s*"${level}",\\s*message:\\s*(.*?)(?:,\\s*title:\\s*"([^"]*)")?\\s*\\}\\)`,
          "g",
        );
      default:
        throw new Error(`Invalid source format: ${format}`);
    }
  };

  // Helper function to create replacement based on target format
  const createReplacement = (
    level: string,
    message: string,
    title?: string,
    args?: string,
  ): string => {
    switch (finalTo) {
      case "console":
        return `console.${level}(${message}${args ? `, ${args}` : ""})`;
      case "consolaMethod":
        if (level === "box" && title) {
          return `consola.box({ title: "${title}", message: "${message}" })`;
        }
        return `consola.${level}(${message}${args ? `, ${args}` : ""})`;
      case "consolaObject": {
        const obj = {
          level: `"${level}"`,
          message,
          ...(title && { title: `"${title}"` }),
          ...(args && { args: `[${args}]` }),
        };
        return `consola(${JSON.stringify(obj).replace(/"([^"]+)":/g, "$1:")})`;
      }
      case "relinkaFunction":
        if (level === "box" && title) {
          return `relinka("${level}", "${title}\\n${message}"${args ? `, ${args}` : ""})`;
        }
        return `relinka("${level}", ${message}${args ? `, ${args}` : ""})`;
      case "relinkaMethod":
        if (level === "box" && title) {
          return `relinka.${level}("${title}\\n${message}"${args ? `, ${args}` : ""})`;
        }
        return `relinka.${level}(${message}${args ? `, ${args}` : ""})`;
      case "relinkaObject": {
        const obj = {
          level: `"${level}"`,
          message,
          ...(title && { title: `"${title}"` }),
          ...(args && { args: `[${args}]` }),
        };
        return `relinka(${JSON.stringify(obj).replace(/"([^"]+)":/g, "$1:")})`;
      }
      default:
        throw new Error(`Invalid target format: ${finalTo}`);
    }
  };

  // Process each level
  for (const level of levels) {
    const pattern = getSourcePattern(level, finalFrom);

    const newContent = content.replace(
      pattern,
      (_, message, titleOrArgs, args) => {
        changes = true;
        if (
          (finalFrom === "consolaMethod" || finalFrom === "relinkaMethod") &&
          level === "box"
        ) {
          return createReplacement(level, message, titleOrArgs, args);
        }
        return createReplacement(level, message, undefined, titleOrArgs);
      },
    );

    if (newContent !== content) {
      content = newContent;
      relinka(
        "verbose",
        `✅ Converted ${level} calls from ${finalFrom} to ${finalTo} format`,
      );
    }
  }

  if (!changes) {
    relinka("warn", "⚠️ No matching calls found to convert");
  } else {
    // Write the modified content back to the file
    await fs.writeFile(finalInput, content, "utf8");
    relinka(
      "success",
      "✨ Successfully converted all logging calls to the target format",
    );
  }
}
