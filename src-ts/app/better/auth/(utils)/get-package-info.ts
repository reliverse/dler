import fs from "@reliverse/relifso";
import path from "path";

export function getPackageInfo(cwd?: string) {
  const packageJsonPath = cwd ? path.join(cwd, "package.json") : path.join("package.json");
  return fs.readJSONSync(packageJsonPath);
}
