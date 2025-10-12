import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { isBinaryExt } from "@reliverse/filetype-dler-plugin";
import path from "@reliverse/pathkit";
import { relinka } from "@reliverse/relinka";
import { createJiti } from "jiti";
import stripJsonComments from "strip-json-comments";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface FileMetadata {
	updatedAt?: string;
	updatedHash?: string;
}

export interface TemplatesFileContent {
	content: FileContent;
	type: "text" | "json" | "binary";
	hasError?: boolean;
	error?: string;
	jsonComments?: Record<number, string>;
	binaryHash?: string;
	metadata?: FileMetadata;
}

export type FileContent = string | Record<string, unknown>;

export interface Template {
	name: string;
	description: string;
	config: { files: Record<string, TemplatesFileContent> };
	updatedAt?: string;
}

export type ExistingTemplates = Record<string, Template>;

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

export const WHITELABEL_DEFAULT = "DLER";
export const TEMPLATE_VAR = (name: string, whitelabel: string) =>
	`${whitelabel}_TPL_${name.toUpperCase()}`;
export const TPLS_DIR = "packed";
export const BINARIES_DIR = "binaries";

/* -------------------------------------------------------------------------- */
/*                               Helper functions                             */
/* -------------------------------------------------------------------------- */

/** Escape back-`s, ${ and newlines for safe template literal embedding */
export const escapeTemplateString = (str: string): string =>
	str
		.replace(/`/g, "\\`")
		// Preserve sequences that have already been escaped (\${}) using a unicode escape for '$'
		.replace(/\\\${/g, "\\u0024{")
		// Escape any remaining ${ so they are not interpreted in the generated file
		.replace(/\$\{/g, "\\${")
		// Remove superfluous escapes before Handlebars/JSX braces that were written as \{{ or \}}
		.replace(/\\\{\{/g, "{{")
		.replace(/\\\}\}/g, "}}")
		.replace(/\r?\n/g, "\\n");

export const unescapeTemplateString = (str: string): string =>
	str
		.replace(/\\n/g, "\n")
		.replace(/\\u0024\{/g, "\\${")
		.replace(/\\\\`/g, "`")
		.replace(/\\\\/g, "\\");

export const hashFile = async (file: string): Promise<string> => {
	const buf = await fs.readFile(file);
	return createHash("sha1").update(buf).digest("hex").slice(0, 10);
};

export const getFileMetadata = async (file: string): Promise<FileMetadata> => {
	try {
		const [stats, hash] = await Promise.all([fs.stat(file), hashFile(file)]);
		return {
			updatedAt: stats.mtime.toISOString(),
			updatedHash: hash,
		};
	} catch (err) {
		relinka(
			"warn",
			`Failed to get metadata for ${file}: ${(err as Error).message}`,
		);
		return {
			updatedAt: new Date().toISOString(),
			updatedHash: "",
		};
	}
};

/** Recursively walk a directory */
export const walkDir = async (dir: string): Promise<string[]> => {
	let res: string[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			res = res.concat(await walkDir(full));
		} else {
			res.push(full);
		}
	}
	return res;
};

/** Process a file and return the TemplatesFileContent structure */
export const readFileForTemplate = async (
	absPath: string,
	relPath: string,
	binariesOutDir: string,
): Promise<TemplatesFileContent> => {
	const metadata = await getFileMetadata(absPath);

	try {
		// Try binary first
		if (await isBinaryExt(absPath)) {
			const hash = metadata.updatedHash;
			const ext = path.extname(absPath);
			const target = path.join(binariesOutDir, `${hash}${ext}`);

			try {
				await fs.mkdir(binariesOutDir, { recursive: true });
				// Copy only if not exists
				await fs.copyFile(absPath, target).catch(async (err) => {
					if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
				});
			} catch (err) {
				relinka(
					"error",
					`Failed copying binary ${relPath}: ${(err as Error).message}`,
				);
				return {
					content: "",
					type: "binary",
					hasError: true,
					error: (err as Error).message,
					binaryHash: hash,
					metadata,
				};
			}

			return {
				content: "",
				type: "binary",
				binaryHash: hash,
				metadata,
			};
		}

		// Non-binary files are read as text
		const raw = await fs.readFile(absPath, "utf8");
		const ext = path.extname(absPath).toLowerCase();
		if (ext === ".json") {
			const comments: Record<number, string> = {};
			const lines = raw.split(/\r?\n/);

			lines.forEach((line, idx) => {
				const trimmed = line.trim();
				if (trimmed.startsWith("//") || trimmed.startsWith("/*"))
					comments[idx + 1] = line;
			});

			try {
				const parsed = JSON.parse(stripJsonComments(raw)) as Record<
					string,
					unknown
				>;
				return {
					content: parsed,
					type: "json",
					jsonComments: Object.keys(comments).length ? comments : undefined,
					metadata,
				};
			} catch (err) {
				relinka(
					"warn",
					`Failed to parse JSON file ${relPath}: ${(err as Error).message}`,
				);
				return {
					content: {} as Record<string, unknown>,
					type: "json",
					hasError: true,
					error: (err as Error).message,
					jsonComments: Object.keys(comments).length ? comments : undefined,
					metadata,
				};
			}
		}

		return {
			content: raw,
			type: "text",
			metadata,
		};
	} catch (err) {
		relinka(
			"warn",
			`Failed to read file ${relPath}: ${(err as Error).message}`,
		);
		return {
			content: "",
			type: "text",
			hasError: true,
			error: (err as Error).message,
			metadata,
		};
	}
};

/* -------------------------------------------------------------------------- */
/*                             Template UNPACKING                             */
/* -------------------------------------------------------------------------- */

/** Locate the object holding templates in a dynamically-imported module */
export const findTemplatesObject = (
	mod: Record<string, unknown>,
): ExistingTemplates => {
	if (mod.DLER_TEMPLATES && typeof mod.DLER_TEMPLATES === "object") {
		return mod.DLER_TEMPLATES as ExistingTemplates;
	}
	if (mod.default && typeof mod.default === "object") {
		return mod.default as ExistingTemplates;
	}
	for (const v of Object.values(mod)) {
		if (
			v &&
			typeof v === "object" &&
			Object.values(v).every((t) => t && typeof t === "object" && "config" in t)
		) {
			return v as ExistingTemplates;
		}
	}
	return {};
};

/** Restore one file (text|json|binary) to the filesystem */
export const restoreFile = async (
	outRoot: string,
	relPath: string,
	meta: TemplatesFileContent,
	binsDir: string,
	force = false,
) => {
	const dest = path.join(outRoot, relPath);
	await fs.mkdir(path.dirname(dest), { recursive: true });

	try {
		if (!force) {
			await fs.access(dest);
			relinka(
				"verbose",
				`Skipping existing file (use --force to overwrite): ${relPath}`,
			);
			return;
		}
	} catch {
		/* file doesn't exist → proceed */
	}

	if (meta.type === "binary") {
		const ext = path.extname(relPath);
		const src = path.join(binsDir, `${meta.binaryHash}${ext}`);
		try {
			await fs.copyFile(src, dest);
		} catch (err) {
			relinka(
				"error",
				`Missing binary ${src} for ${relPath}: ${(err as Error).message}`,
			);
		}
	} else if (meta.type === "json") {
		const jsonStr = JSON.stringify(meta.content, null, 2);
		await fs.writeFile(dest, jsonStr, "utf8");
	} else {
		await fs.writeFile(dest, meta.content as string, "utf8");
	}

	/* preserve mtime if available */
	if (meta.metadata?.updatedAt) {
		const ts = new Date(meta.metadata.updatedAt);
		await fs.utimes(dest, ts, ts);
	}
};

/** Unpack logic */
export const unpackTemplates = async (
	aggregatorPath: string,
	outDir: string,
	force = false,
): Promise<void> => {
	const jiti = createJiti(process.cwd());
	let mod: Record<string, unknown>;
	try {
		mod = await jiti.import(aggregatorPath);
	} catch (err) {
		throw new Error(
			`Failed to import aggregator file: ${(err as Error).message}`,
		);
	}

	const templatesObj = findTemplatesObject(mod);
	if (!Object.keys(templatesObj).length) {
		throw new Error("No templates found in aggregator file.");
	}

	const binsDir = path.join(
		path.dirname(aggregatorPath),
		TPLS_DIR,
		BINARIES_DIR,
	);
	let unpackedFiles = 0;

	for (const [tplName, tpl] of Object.entries(templatesObj)) {
		relinka("info", `Unpacking template: ${tplName}`);
		for (const [relPath, meta] of Object.entries(tpl.config.files)) {
			try {
				await restoreFile(outDir, relPath, meta, binsDir, force);
				unpackedFiles++;
			} catch (err) {
				relinka(
					"error",
					`Failed restoring ${relPath}: ${(err as Error).message}`,
				);
			}
		}
	}

	relinka("success", `Unpacked ${unpackedFiles} files into ${outDir}`);
};

/* -------------------------------------------------------------------------- */
/*                             Template generation                            */
/* -------------------------------------------------------------------------- */

export const writeTypesFile = async (outRoot: string, outputName: string) => {
	const typesFile = path.join(outRoot, `${outputName}-types.ts`);
	const code = `// Auto-generated type declarations for templates.

export interface FileMetadata { updatedAt?: string; updatedHash?: string; }
export interface TemplatesFileContent { content: string | Record<string, unknown>; type: 'text' | 'json' | 'binary'; hasError?: boolean; error?: string; jsonComments?: Record<number, string>; binaryHash?: string; metadata?: FileMetadata; }
export interface Template { name: string; description: string; config: { files: Record<string, TemplatesFileContent> }; updatedAt?: string; }
`;
	await fs.writeFile(typesFile, code, "utf8");
};
