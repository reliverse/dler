export {
	BINARIES_DIR,
	escapeTemplateString,
	findTemplatesObject,
	getFileMetadata,
	hashFile,
	readFileForTemplate,
	restoreFile,
	TEMPLATE_VAR,
	TPLS_DIR,
	unescapeTemplateString,
	unpackTemplates,
	WHITELABEL_DEFAULT,
	walkDir,
	writeTypesFile,
} from "~/impl";
export type {
	ExistingTemplates,
	FileContent,
} from "./impl";
