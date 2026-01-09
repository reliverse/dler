import type { PluginContext } from "@reliverse/rempts-core/plugin";
import { createPlugin } from "@reliverse/rempts-core/plugin";
import completionsCommand from "./commands/completions";
import type { CompletionsPluginOptions } from "./types";

export const completionsPlugin = createPlugin<CompletionsPluginOptions>((options = {}) => () => ({
  setup(context: PluginContext) {
    // Register the completions command
    const command = completionsCommand(options);
    context.registerCommand(command);
  },
}));
