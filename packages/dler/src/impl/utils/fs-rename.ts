import path from "@reliverse/pathkit";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";

async function fileExists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch {
		return false;
	}
}

export async function safeRename(
	source: string,
	destination: string,
): Promise<void> {
	if (await fileExists(destination)) {
		throw new Error(`Destination file already exists: ${destination}`);
	}
	await fs.rename(source, destination);
}

function isCommonJSFile(content: string): boolean {
	return content.includes("module.exports") || content.includes("require(");
}

async function getAllFilesAsync(
	dir: string,
	baseDir = dir,
	recursive = true,
): Promise<string[]> {
	let fileList: string[] = [];
	const entries = await fs.readdir(dir, {
		encoding: "utf8",
		withFileTypes: true,
	});
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (recursive) {
				const subFiles = await getAllFilesAsync(fullPath, baseDir, recursive);
				fileList = fileList.concat(subFiles);
			}
		} else if (entry.isFile()) {
			fileList.push(fullPath.slice(baseDir.length + 1));
		}
	}
	return fileList;
}

export async function prepareCLIFiles(
	revert = false,
	recursive = true,
	useDtsTxtForPrepareMyCLI = false,
) {
	relinka("verbose", "Starting CLI file preparation...");

	const configPath = "reliverse.ts";
	let srcDir = "src";

	if (fs.existsSync(configPath)) {
		const configContent = fs.readFileSync(configPath, "utf8");
		const configMatch = configContent.match(
			/commonEntrySrcDir:\s*["']([^"']+)["']/,
		);
		srcDir = configMatch?.[1] ?? srcDir;
	}

	if (!fs.existsSync(srcDir)) {
		throw new Error(`Source directory not found: ${srcDir}`);
	}

	const files = await getAllFilesAsync(srcDir, srcDir, recursive);
	relinka("verbose", `Found ${files.length} files to process.`);

	let renamedCount = 0;

	for (const file of files) {
		const fullPath = path.join(srcDir, file);
		if (!(await fileExists(fullPath))) continue;

		const ext = path.extname(file);
		const fileName = path.basename(file); // get just the filename
		const baseName = path.basename(file, ext);
		const dir = path.dirname(fullPath);

		// relinka("verbose", `Processing file: ${fullPath}`);

		if (revert) {
			// revert mode
			if (file.endsWith(".json.json")) {
				const originalName = path.join(
					dir,
					fileName.replace(".json.json", ".json"),
				);
				relinka("verbose", `Reverting ${fullPath} to ${originalName}`);
				await safeRename(fullPath, originalName);
				renamedCount++;
			} else if (file.endsWith(".d.ts.txt") && useDtsTxtForPrepareMyCLI) {
				const originalName = path.join(
					dir,
					fileName.replace(".d.ts.txt", ".d.ts"),
				);
				relinka("verbose", `Reverting ${fullPath} to ${originalName}`);
				await safeRename(fullPath, originalName);
				renamedCount++;
			} else if (file.endsWith(".cjs")) {
				const originalName = path.join(dir, `${baseName}.js`);
				relinka("verbose", `Reverting ${fullPath} to ${originalName}`);
				await safeRename(fullPath, originalName);
				renamedCount++;
			}
		} else {
			// normal mode - using `fileName` instead of `file` for comparisons
			if (fileName === "tsconfig.json" && !fileName.endsWith(".json.json")) {
				const newName = path.join(dir, "tsconfig.json.json");
				relinka("verbose", `Renaming ${fullPath} to ${newName}`);
				await safeRename(fullPath, newName);
				renamedCount++;
			} else if (
				fileName === "package.json" &&
				!fileName.endsWith(".json.json")
			) {
				const newName = path.join(dir, "package.json.json");
				relinka("verbose", `Renaming ${fullPath} to ${newName}`);
				await safeRename(fullPath, newName);
				renamedCount++;
			} else if (
				fileName.endsWith(".d.ts") &&
				!fileName.endsWith(".d.ts.txt") &&
				useDtsTxtForPrepareMyCLI
			) {
				const baseWithoutD = baseName.slice(0, -2);
				const newName = path.join(dir, `${baseWithoutD}.d.ts.txt`);
				relinka("verbose", `Renaming ${fullPath} to ${newName}`);
				await safeRename(fullPath, newName);
				renamedCount++;
			} else if (fileName.endsWith(".js") && !fileName.endsWith(".cjs")) {
				const content = fs.readFileSync(fullPath, "utf8");
				if (isCommonJSFile(content)) {
					const newName = path.join(dir, `${baseName}.cjs`);
					relinka("verbose", `Renaming ${fullPath} to ${newName}`);
					await safeRename(fullPath, newName);
					renamedCount++;
				}
			}
		}
	}

	relinka(
		"verbose",
		`CLI file preparation completed. Renamed ${renamedCount} files.`,
	);
}
