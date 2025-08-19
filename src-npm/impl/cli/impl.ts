import { detectProject } from "@reliverse/cfg";
import { runCmd, selectPrompt } from "@reliverse/rempts";
import { generate } from "random-words";
import { getWebCmd } from "@/npm/app/cmds";
import { aiMenu } from "~/impl/ai/ai-menu";
import { cliJsrPath, UNKNOWN_VALUE } from "~/impl/config/constants";
import { ad, getRandomMessage, getWelcomeTitle, premium } from "~/impl/db/messages";
import { showManualBuilderMenu } from "~/impl/init/impl/init-impl";
import { getMainMenuOptions } from "~/impl/init/use-template/cp-modules/cli-main-modules/cli-menu-items/getMainMenuOptions";
import { showCloneProjectMenu } from "~/impl/init/use-template/cp-modules/cli-main-modules/cli-menu-items/showCloneProjectMenu";
import { showEndPrompt } from "~/impl/init/use-template/cp-modules/cli-main-modules/modules/showStartEndPrompt";
import { showDevToolsMenu } from "~/impl/toolbox/toolbox-impl";
import type { ParamsOmitSkipPN } from "~/impl/types/mod";
import { showNativeCliMenu } from "~/impl/utils/native-cli/nc-mod";
import {
  showNewProjectMenu,
  showOpenProjectMenu,
} from "~/providers/reliverse-stack/reliverse-stack-mod";

export async function app(params: ParamsOmitSkipPN) {
  const { cwd, isDev, mrse, memory, config } = params;

  const skipPrompts = config.skipPromptsUseAutoBehavior ?? false;
  const frontendUsername = memory.name !== "" ? memory.name : UNKNOWN_VALUE;
  const projectName = isDev
    ? generate({ exactly: 2, join: "-" })
    : (config.projectName ?? UNKNOWN_VALUE);

  if (!isDev) {
    await detectProject(cwd, isDev);
    // TODO: remove, deprecated
    // if (rootProject) {
    //   const updatedMemory = await getOrCreateReliverseMemory();
    //   await handleOpenProjectMenu(
    //     [rootProject],
    //     isDev,
    //     updatedMemory,
    //     cwd,
    //     true,
    //     config,
    //   );
    //   await showEndPrompt();
    //   deleteLastLine();
    //   process.exit(0);
    // }
  }

  const options = await getMainMenuOptions(cwd, isDev, mrse);

  const mainMenuOption = await selectPrompt({
    options,
    title: frontendUsername ? getWelcomeTitle(frontendUsername) : getRandomMessage("welcome"),
    content: `[Ad] ${ad}\n${premium}`,
    titleColor: "retroGradient",
    displayInstructions: true,
    endTitle: "✋ User pressed Ctrl+C, exiting...",
  });

  if (mainMenuOption === "create") {
    await showNewProjectMenu({
      projectName,
      cwd,
      isDev,
      memory,
      config,
      mrse,
      skipPrompts,
    });
  } else if (mainMenuOption === "clone") {
    await showCloneProjectMenu({ isDev, cwd, config, memory });
  } else if (mainMenuOption === "native-cli") {
    // TODO: remove, deprecated
    const outputDir = cliJsrPath;
    await showNativeCliMenu({ outputDir });
  } else if (mainMenuOption === "manual") {
    await showManualBuilderMenu({
      projectName,
      cwd,
      isDev,
      memory,
      config,
      skipPrompts,
    });
  } else if (mainMenuOption === "detected-projects") {
    await showOpenProjectMenu({
      projectName,
      cwd,
      isDev,
      memory,
      config,
      mrse,
      skipPrompts,
    });
  } else if (mainMenuOption === "isDevTools") {
    await showDevToolsMenu({
      projectName,
      cwd,
      isDev,
      config,
      memory,
      skipPrompts,
    });
  } else if (mainMenuOption === "ai") {
    await aiMenu(config, false, memory);
  } else if (mainMenuOption === "web-ui") {
    await showWebUiMenu({ isDev });
  }

  await showEndPrompt();
}

export async function showWebUiMenu({ isDev }: { isDev: boolean }) {
  await runCmd(await getWebCmd(), [`--dev ${isDev}`]); // src/app/web/cmd.ts
}
