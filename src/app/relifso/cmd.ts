export { FILE_TYPES } from "./impl/const.js";
// export { createFileFromScratch, initFile, initFiles } from "./reint-impl/mod.js";
export { gitignoreTemplate } from "./impl/templates/t-gitignore.js";
export { licenseTemplate } from "./impl/templates/t-license.js";
export { readmeTemplate } from "./impl/templates/t-readme.js";
export type {
  FileType,
  InitBehaviour,
  DestFileExistsBehaviour,
  ReinitUserConfig,
  InitFileRequest,
  InitFileOptions,
  InitFileResult,
} from "./impl/types.js";
export { escapeMarkdownCodeBlocks } from "./impl/utils.js";
