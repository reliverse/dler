import { resolve } from "node:path";
import { replaceExportsInPackages } from "./impl/replace-exports";

async function main() {
  const args = process.argv.slice(2);
  const directionFlagIndex = args.indexOf("--direction");
  let direction: "ts-to-js" | "js-to-ts" = "ts-to-js";

  if (directionFlagIndex !== -1) {
    const directionValue = args[directionFlagIndex + 1];
    if (directionValue === "js-to-ts") {
      direction = "js-to-ts";
    } else if (directionValue !== "ts-to-js") {
      console.error(
        `Error: Invalid --direction value "${directionValue}". Use "ts-to-js" or "js-to-ts".`,
      );
      process.exit(1);
    }
  }

  const cwdFlagIndex = args.indexOf("--cwd");
  const cwdValue = cwdFlagIndex !== -1 ? args[cwdFlagIndex + 1] : undefined;
  const cwd = cwdValue ? resolve(process.cwd(), cwdValue) : undefined;

  console.log(`Replacing exports in ${direction} direction...\n`);

  const result = await replaceExportsInPackages({
    direction,
    cwd,
    verbose: true,
  });

  console.log(`\n✓ Completed: ${result.updated} file(s) updated`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
