import { endPrompt, startPrompt } from "@reliverse/rempts";

const version = "1.7.26";

export async function showStartPrompt(isDev: boolean) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole: false,
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
