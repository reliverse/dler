import chalk from "chalk";

import type { DependencyResult, FinderOptions } from "./types.js";

export const formatOutput = (
  result: DependencyResult,
  options: FinderOptions,
): string => {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  let output = "";

  // Add header
  output += chalk.bold.blue("\nMissing Dependencies Finder Results\n");
  output += chalk.gray("---------------------------------------\n\n");

  // Show statistics
  output += chalk.bold("Statistics:\n");
  output += `${chalk.gray("• ")}Total dependencies found: ${result.allDependencies.length}\n`;
  output += `${chalk.gray("• ")}Listed in package.json: ${result.listedDependencies.length}\n`;
  output += `${chalk.gray("• ")}Missing from package.json: ${result.missingDependencies.length}\n`;
  if (options.builtins) {
    output += `${chalk.gray("• ")}Node.js built-in modules: ${result.builtinModules.length}\n`;
  }
  output += "\n";

  // Show missing dependencies
  if (result.missingDependencies.length > 0) {
    output += chalk.bold.red("Missing Dependencies:\n");
    for (const dep of result.missingDependencies) {
      output += `${chalk.gray("• ")}${chalk.yellow(dep)}\n`;
    }
    output += "\n";

    // Add installation hint
    output += chalk.gray("To install, run:\n");
    output += chalk.cyan(
      `npm install ${result.missingDependencies.join(" ")}\n\n`,
    );
  } else {
    output += chalk.bold.green("No missing dependencies found! 🎉\n\n");
  }

  // Show built-in modules if enabled
  if (options.builtins && result.builtinModules.length > 0) {
    output += chalk.bold.blue("Node.js Built-in Modules Used:\n");
    for (const dep of result.builtinModules) {
      output += `${chalk.gray("• ")}${chalk.blue(dep)}\n`;
    }
    output += "\n";
  }

  // Show all dependencies if requested
  if (options.showAll) {
    output += chalk.bold("All Dependencies:\n");
    output += chalk.gray("(✓ = listed in package.json, ✗ = missing)\n");

    for (const dep of result.allDependencies) {
      const isListed = result.listedDependencies.includes(dep);
      const isBuiltin = result.builtinModules.includes(dep);

      if (isListed) {
        output += `${chalk.gray("• ") + chalk.green("✓ ") + dep}\n`;
      } else if (isBuiltin) {
        output += `${chalk.gray("• ")}${chalk.blue("⚡ ")}${dep}${chalk.gray(" (built-in)")}\n`;
      } else {
        output += `${chalk.gray("• ")}${chalk.red("✗ ")}${chalk.yellow(dep)}\n`;
      }
    }
    output += "\n";
  }

  return output;
};
