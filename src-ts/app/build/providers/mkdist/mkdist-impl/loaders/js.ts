import { transform } from "esbuild";
import jiti from "jiti";

import type { Loader, LoaderResult } from "~/app/types/mod";

const DECLARATION_RE = /\.d\.[cm]?ts$/;
const CM_LETTER_RE = /(?<=\.)(c|m)(?=[jt]s$)/;

const KNOWN_EXT_RE = /\.(c|m)?[jt]sx?$/;

const TS_EXTS = new Set([".ts", ".mts", ".cts"]);

export const jsLoader: Loader = async (input, { options }) => {
  if (!KNOWN_EXT_RE.test(input.path) || DECLARATION_RE.test(input.path)) {
    return;
  }

  const output: LoaderResult = [];

  let contents = await input.getContents();

  // declaration
  if (options.declaration && !input.srcPath?.match(DECLARATION_RE)) {
    const cm = input.srcPath?.match(CM_LETTER_RE)?.[0] || "";
    const extension = `.d.${cm}ts`;
    output.push({
      contents,
      srcPath: input.srcPath,
      path: input.path,
      extension,
      declaration: true,
    });
  }

  // typescript => js
  if (TS_EXTS.has(input.extension)) {
    contents = await transform(contents, {
      ...options.esbuild,
      loader: "ts",
    }).then((r) => r.code);
    // todo: introduce new option in dler config which allows to enable/disable transpiling other extensions that .ts and .js (disabling is especially useful for bootstrapping projects clis like @reliverse/rse)
    // } else if ([".tsx", ".jsx"].includes(input.extension)) {
  } else if (input.extension === ".jsx") {
    contents = await transform(contents, {
      // loader: input.extension === ".tsx" ? "tsx" : "jsx",
      loader: "jsx",
      ...options.esbuild,
    }).then((r) => r.code);
  }

  // esm => cjs
  const isCjs = options.format === "cjs";
  if (isCjs) {
    contents = jiti("")
      .transform({ source: contents, retainLines: false })
      .replace(/^exports.default = /gm, "module.exports = ")
      .replace(/^var _default = exports.default = /gm, "module.exports = ")
      .replace("module.exports = void 0;", "");
  }

  let extension = isCjs ? ".js" : ".mjs"; // TODO: Default to .cjs in next major version
  if (options.ext) {
    extension = options.ext.startsWith(".") ? options.ext : `.${options.ext}`;
  }

  output.push({
    contents,
    path: input.path,
    extension,
  });

  return output;
};
