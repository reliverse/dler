import { resolveAllCrossLibs } from "~/impl/utils/resolve-cross-libs";

async function main() {
  await resolveAllCrossLibs("package", "~", ["npm", "jsr"], ["ts", "js"], "templates");
  process.exit(0);
}

await main();
