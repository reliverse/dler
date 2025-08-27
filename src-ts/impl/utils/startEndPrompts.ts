import { relinka } from "@reliverse/relinka";
import { endPrompt, startPrompt } from "@reliverse/rempts";
import { isBun, isBunPM, isBunRuntime } from "@reliverse/runtime";
import { readPackageJSON as readPkgJSON } from "pkg-types";

import { cliVersion, dlerName } from "~/impl/config/constants";

export async function readPackageJSON(): Promise<{ name?: string; version?: string }> {
  try {
    const pkg = await readPkgJSON();
    return { name: pkg.name, version: pkg.version };
  } catch (error) {
    relinka("warn", "Could not read package.json, using default values");
    return {};
  }
}

export const getPkgName = async () => {
  const pkg = await readPackageJSON();
  return pkg.name || "unknown";
};

export const getPkgVersion = async () => {
  const pkg = await readPackageJSON();
  return pkg.version || "0.0.0";
};

export async function showStartPrompt(
  isDev: boolean,
  showRuntimeInfo: boolean,
  clearConsole: boolean,
) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole,
    packageName: dlerName,
    packageVersion: cliVersion,
    isDev,
  });

  if (showRuntimeInfo) {
    console.log("isBunRuntime:", isBunRuntime());
    console.log("isBunPM:", await isBunPM());
    console.log("isBun:", isBun);
  }
}

export async function showEndPrompt() {
  await endPrompt({
    title: "│  ❤️  Please consider supporting rse development: https://github.com/sponsors/blefnk",
    titleAnimation: "glitch",
    titleColor: "dim",
    titleTypography: "bold",
    titleAnimationDelay: 800,
  });
}
