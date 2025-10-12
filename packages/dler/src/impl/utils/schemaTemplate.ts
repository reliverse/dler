import path from "@reliverse/pathkit";
import fs, { ensuredir } from "@reliverse/relifso";

import { cliHomeRepos, cliVersion } from "~/impl/config/constants";

// ================================================
// TypeScript Types
// ================================================

export interface RepoInfo {
	id: string;
	author: string;
	name: string;
	description: string;
	category: string;
	lastUpdated: string; // ISO date string
	localPath: string;
	github: {
		stars: number;
		forks: number;
		watchers: number;
		createdAt: string;
		updatedAt: string;
		pushedAt: string;
		defaultBranch: string;
	};
}

export interface ReposConfig {
	$schema: string;
	version: string;
	repos: RepoInfo[];
}

export const DEFAULT_REPOS_CONFIG: ReposConfig = {
	$schema: "./schema.json",
	version: cliVersion,
	repos: [],
};

// ================================================
// Runtime Guards
// ================================================

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isRepoInfo(value: unknown): value is RepoInfo {
	if (!isObject(value)) return false;
	const v = value as Record<string, unknown>;
	const github = v.github;
	return (
		typeof v.id === "string" &&
		typeof v.author === "string" &&
		typeof v.name === "string" &&
		typeof v.description === "string" &&
		typeof v.category === "string" &&
		typeof v.lastUpdated === "string" &&
		typeof v.localPath === "string" &&
		isObject(github) &&
		typeof (github as any).stars === "number" &&
		typeof (github as any).forks === "number" &&
		typeof (github as any).watchers === "number" &&
		typeof (github as any).createdAt === "string" &&
		typeof (github as any).updatedAt === "string" &&
		typeof (github as any).pushedAt === "string" &&
		typeof (github as any).defaultBranch === "string"
	);
}

export function isReposConfig(value: unknown): value is ReposConfig {
	if (!isObject(value)) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.$schema === "string" &&
		typeof v.version === "string" &&
		Array.isArray(v.repos) &&
		(v.repos as unknown[]).every((r) => isRepoInfo(r))
	);
}

// ================================================
// JSON Schema Generation (static)
// ================================================

export async function generateReposJsonSchema(): Promise<void> {
	const schema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		title: "rse Repos Schema",
		description: "Schema for repos.json configuration file",
		type: "object",
		properties: {
			$schema: { type: "string" },
			version: { type: "string" },
			repos: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "string" },
						author: { type: "string" },
						name: { type: "string" },
						description: { type: "string" },
						category: { type: "string" },
						lastUpdated: { type: "string" },
						localPath: { type: "string" },
						github: {
							type: "object",
							properties: {
								stars: { type: "number" },
								forks: { type: "number" },
								watchers: { type: "number" },
								createdAt: { type: "string" },
								updatedAt: { type: "string" },
								pushedAt: { type: "string" },
								defaultBranch: { type: "string" },
							},
							required: [
								"stars",
								"forks",
								"watchers",
								"createdAt",
								"updatedAt",
								"pushedAt",
								"defaultBranch",
							],
						},
					},
					required: [
						"id",
						"author",
						"name",
						"description",
						"category",
						"lastUpdated",
						"localPath",
						"github",
					],
				},
			},
		},
		required: ["$schema", "version", "repos"],
		additionalProperties: false,
	} as const;

	await ensuredir(cliHomeRepos);
	const schemaPath = path.join(cliHomeRepos, "schema.json");
	await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));
}

export async function shouldRegenerateSchema(): Promise<boolean> {
	const configPath = path.join(cliHomeRepos, "repos.json");

	if (!(await fs.pathExists(configPath))) {
		return true;
	}

	try {
		const content = await fs.readFile(configPath, "utf-8");
		const config = JSON.parse(content) as ReposConfig;
		return config.version !== cliVersion;
	} catch {
		return true;
	}
}
