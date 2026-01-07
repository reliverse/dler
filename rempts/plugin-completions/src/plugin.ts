import { createPlugin } from "@reliverse/rempts-core/plugin";
import type { PluginContext } from "@reliverse/rempts-core/plugin";
import type { CompletionsPluginOptions } from "./types";
import completionsCommand from "./commands/completions";

export const completionsPlugin = createPlugin<CompletionsPluginOptions>((options = {}) => ({
  name: "completions",

  setup(context: PluginContext) {
    // Register the completions command
    const command = completionsCommand(options);
    context.registerCommand(command);
  },
}));
