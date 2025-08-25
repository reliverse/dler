import { endPrompt, startPrompt } from "@reliverse/rempts";
import { isBun, isBunPM, isBunRuntime } from "@reliverse/runtime";

import { cliVersion, dlerName } from "~/app/config/constants";

export async function showStartPrompt(isDev: boolean, showRuntimeInfo: boolean) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole: true,
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
