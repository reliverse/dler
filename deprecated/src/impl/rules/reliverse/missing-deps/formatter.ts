import { re } from "@reliverse/relico";

import type { DependencyResult, FinderOptions } from "./deps-types";

export const formatOutput = (
  result: DependencyResult,
  options: FinderOptions,
): string => {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  let output = "";

  // Add header
  output += re.blueBright("\nMissing Dependencies Finder Results\n");
  output += re.gray("---------------------------------------\n\n");

  // Show statistics
  output += re.bold("Statistics:\n");
  output += `${re.gray("• ")}Total dependencies found: ${result.allDependencies.length}\n`;
  output += `${re.gray("• ")}Listed in package.json: ${result.listedDependencies.length}\n`;
  output += `${re.gray("• ")}Missing from package.json: ${result.missingDependencies.length}\n`;
  if (options.builtins) {
    output += `${re.gray("• ")}Node.js built-in modules: ${result.builtinModules.length}\n`;
  }
  output += `${re.gray("• ")}Dev-only dependencies used in production: ${result.devOnlyDependencies.length}\n`;
  output += `${re.gray("• ")}Duplicate dependencies: ${result.duplicateDependencies.length}\n`;
  output += "\n";

  // Show duplicate dependencies warning
  if (result.duplicateDependencies.length > 0) {
    output += re.yellowBright("⚠️  Duplicate Dependencies Found:\n");
    output += re.yellow(
      "These packages are listed in both dependencies and devDependencies.\n",
    );
    output += re.yellow(
      "This can cause confusion and potential issues. Consider keeping them in only one section.\n\n",
    );

    for (const dep of result.duplicateDependencies) {
      output += `${re.gray("• ")}${re.yellow(dep)}\n`;
    }
    output += "\n";
  }

  // Show dev-only dependencies warning
  if (result.devOnlyDependencies.length > 0) {
    output += re.yellowBright(
      "⚠️  Dev-only Dependencies Used in Production Code:\n",
    );
    output += re.yellow(
      "These packages are only in devDependencies but are imported in your code.\n",
    );
    output += re.yellow(
      "They will cause errors in production after bundling!\n\n",
    );

    for (const dep of result.devOnlyDependencies) {
      output += `${re.gray("• ")}${re.yellow(dep)}\n`;
    }
    output += "\n";

    // Add installation hint
    output += re.gray("To fix, move these to dependencies:\n");
    output += re.cyan(
      `npm install ${result.devOnlyDependencies.join(" ")} --save\n\n`,
    );
  }

  // Show missing dependencies
  if (result.missingDependencies.length > 0) {
    output += re.redBright("Missing Dependencies:\n");
    for (const dep of result.missingDependencies) {
      output += `${re.gray("• ")}${re.yellow(dep)}\n`;
    }
    output += "\n";

    // Add installation hint
    output += re.gray("To install, run:\n");
    output += re.cyan(
      `npm install ${result.missingDependencies.join(" ")}\n\n`,
    );
  } else {
    output += re.greenBright("No missing dependencies found! ✅\n\n");
  }

  // Show built-in modules if enabled
  if (options.builtins && result.builtinModules.length > 0) {
    output += re.blueBright("Node.js Built-in Modules Used:\n");
    for (const dep of result.builtinModules) {
      output += `${re.gray("• ")}${re.blue(dep)}\n`;
    }
    output += "\n";
  }

  // Show all dependencies if requested
  if (options.showAll) {
    output += re.bold("All Dependencies:\n");
    output += re.gray(
      "(✓ = listed in package.json, ✗ = missing, ⚠️ = dev-only, 🔄 = duplicate)\n",
    );

    for (const dep of result.allDependencies) {
      const isListed = result.listedDependencies.includes(dep);
      const isBuiltin = result.builtinModules.includes(dep);
      const isDevOnly = result.devOnlyDependencies.includes(dep);
      const isDuplicate = result.duplicateDependencies.includes(dep);

      if (isDuplicate) {
        output += `${re.gray("• ")}${re.yellow("🔄 ")}${re.yellow(dep)}${re.gray(" (duplicate)")}\n`;
      } else if (isListed && !isDevOnly) {
        output += `${re.gray("• ") + re.green("✓ ") + dep}\n`;
      } else if (isBuiltin) {
        output += `${re.gray("• ")}${re.blue("⚡ ")}${dep}${re.gray(" (built-in)")}\n`;
      } else if (isDevOnly) {
        output += `${re.gray("• ")}${re.yellow("⚠️ ")}${re.yellow(dep)}${re.gray(" (dev-only)")}\n`;
      } else {
        output += `${re.gray("• ")}${re.red("✗ ")}${re.yellow(dep)}\n`;
      }
    }
    output += "\n";
  }

  return output;
};
