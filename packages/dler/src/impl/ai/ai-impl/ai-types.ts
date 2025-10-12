import type { ReliverseConfig } from "~/impl/schema/mod";

import type { ReliverseMemory } from "~/impl/utils/schemaMemory";

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
