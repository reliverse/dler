import type { ReliverseConfig } from "~/app/schema/mod";

import type { ReliverseMemory } from "~/app/utils/schemaMemory";

import type { AGENT_NAMES, CIRCULAR_TRIGGERS } from "./ai-const";

export type CircularTrigger = (typeof CIRCULAR_TRIGGERS)[number];

export type AiSdkAgent = (typeof AGENT_NAMES)[number];

export interface AIAgentOptions {
  config: ReliverseConfig;
  agent: AiSdkAgent;
  isKeyEnsured: boolean;
  memory?: ReliverseMemory;
  target?: string;
}
