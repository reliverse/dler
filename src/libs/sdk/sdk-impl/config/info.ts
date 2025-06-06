import { endPrompt, startPrompt } from "@reliverse/rempts";

const version = "1.7.16";

export async function showStartPrompt(isDev: boolean) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole: false,
    // packageName: getPkgName(),
    // packageVersion: getPkgVersion(),
    packageName: "dler",
    packageVersion: version,
    isDev,
  });
}
export async function showEndPrompt() {
  await endPrompt({
    title: "│  ❤️  Please consider supporting dler: https://github.com/sponsors/blefnk",
    titleAnimation: "glitch",
    titleColor: "dim",
    titleTypography: "bold",
    titleAnimationDelay: 800,
  });
}

// export const FILL_ISSUE =
//   "If you believe this is an error, please fill in the issue on https://github.com/reliverse/dler/issues";

/* import { relinka } from "@reliverse/relinka";
import { readPackageJSON } from "pkg-types";

// Get package information from package.json
const pkgInfo: { name: string; version: string } = {
  name: "unknown",
  version: "0.0.0",
};

// Initialize package info
readPackageJSON()
  .then((pkg) => {
    pkgInfo.name = pkg.name || "unknown";
    pkgInfo.version = pkg.version || "0.0.0";
  })
  .catch(() => {
    // Keep default values if package.json cannot be read
    relinka("warn", "Could not read package.json, using default values");
  });

export const getPkgName = () => pkgInfo.name;
export const getPkgVersion = () => pkgInfo.version; */
