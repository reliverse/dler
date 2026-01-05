import type { CommandMetadata } from "@reliverse/rempts-generator";

export type ShellType = "bash" | "zsh" | "fish";

export interface CompletionsPluginOptions {
  shells?: ShellType[];
  commandName?: string;
}

export interface CompletionGenerator {
  generate(commands: CommandMetadata[], cliName: string): string;
}
