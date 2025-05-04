/** 
 * Known file types with possible variations. 
 */ 
export const FILE_TYPES = [
    { type: "cfg:eslint", variations: ["eslint.config.js"] },
    { type: "cfg:knip", variations: ["knip.json"] },
    { type: "cfg:reliverse", variations: ["reliverse.jsonc", "reliverse.ts"] },
    { type: "cfg:package.json", variations: ["package.json"] },
    { type: "cfg:tsconfig.json", variations: ["tsconfig.json"] },
    { type: "git:gitattributes", variations: [".gitattributes"] },
    { type: "git:gitignore", variations: [".gitignore"] },
    { type: "md:LICENSE", variations: ["LICENSE.md", "LICENSE"] },
    { type: "md:README", variations: ["README.md"] },
  ] as const;
  
  export const INIT_BEHAVIOURS = ["create", "copy", "create-if-copy-failed"] as const;
  
  export const DEST_FILE_EXISTS_BEHAVIOURS = [
    "rewrite",
    "skip",
    "attach-index",
    "prompt",
  ] as const;

  export const CONTENT_CREATE_MODES = [
    "license-basic",
    "simple-readme",
  ];