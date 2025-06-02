import { relinka } from "@reliverse/relinka";
import { transform } from "esbuild";
import jiti from "jiti";

import type {
  Loader,
  LoaderResult,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loader";

const DECLARATION_RE = /\.d\.[cm]?ts$/;
const CM_LETTER_RE = /(?<=\.)(c|m)(?=[jt]s$)/;

const KNOWN_EXT_RE = /\.(c|m)?[jt]sx?$/;

const TS_EXTS = new Set([".ts", ".mts", ".cts"]);
const JS_EXTS = new Set([".js", ".mjs", ".cjs"]);

const STOP_AFTER_STEP = 0; // 0 runs all steps, specific step number stops right after that step

function shouldStopAtStep(stepNumber: number): void {
  if (STOP_AFTER_STEP > 0 && stepNumber >= STOP_AFTER_STEP) {
    relinka("success", `Stopping build at step ${stepNumber}`);
    process.exit(0);
  }
}

// Step 1: JavaScript/TypeScript file loader
export const jsLoader: Loader = async (input, { options }) => {
  // shouldStopAtStep(1);
  // relinka("info", "Step 1: Processing JavaScript/TypeScript file");
  // relinka("verbose", `Processing file: ${input.path} with extension: ${input.extension}`);

  // Step 2: Check if file should be processed
  shouldStopAtStep(2);
  if (!KNOWN_EXT_RE.test(input.path) || DECLARATION_RE.test(input.path)) {
    relinka("verbose", `Skipping file - not a valid JavaScript/TypeScript file: ${input.path}`);
    return;
  }

  const output: LoaderResult = [];
  let contents = await input.getContents();
  // relinka("verbose", `Read file contents for: ${input.path}`);

  // Step 3: Generate declarations if needed (in memory)
  shouldStopAtStep(3);
  if (options.declaration && !input.srcPath?.match(DECLARATION_RE)) {
    // relinka("verbose", `Generating TypeScript declarations for: ${input.path}`);
    const cm = input.srcPath?.match(CM_LETTER_RE)?.[0] || "";
    const extension = `.d.${cm}ts`;
    // Just use the base path without extension, let other functions handle extension
    const declarationPath = input.path
      .replace(/\.d\.[cm]?[jt]sx?$/, "")
      .replace(/\.[cm]?[jt]sx?$/, "");
    output.push({
      contents,
      srcPath: input.srcPath,
      path: declarationPath,
      extension,
      declaration: true,
    });
    // relinka("verbose", `Added declaration output with extension: ${extension}`);
  }

  // Step 4: Transform TypeScript/TSX/JSX to JavaScript
  shouldStopAtStep(4);
  const isCjs = options.format === "cjs";

  if (TS_EXTS.has(input.extension)) {
    // relinka("verbose", `Transforming TypeScript file: ${input.path}`);
    contents = await transform(contents, {
      ...options.esbuild,
      loader: "ts",
      format: isCjs ? "cjs" : "esm",
      target: "es2022",
      supported: { "top-level-await": true },
    }).then((r) => r.code);
    // relinka("verbose", `Transformed TypeScript to JavaScript for: ${input.path}`);
  } else if ([".tsx", ".jsx"].includes(input.extension)) {
    // relinka("verbose", `Transforming ${input.extension} file: ${input.path}`);
    contents = await transform(contents, {
      loader: input.extension === ".tsx" ? "tsx" : "jsx",
      ...options.esbuild,
      format: isCjs ? "cjs" : "esm",
      target: "es2022",
      supported: { "top-level-await": true },
    }).then((r) => r.code);
    // relinka("verbose", `Transformed ${input.extension} to JavaScript for: ${input.path}`);
  } else if (JS_EXTS.has(input.extension)) {
    // relinka("verbose", `Processing JavaScript file: ${input.path}`);
    // For .js files, we still need to transform to ensure consistent output format
    contents = await transform(contents, {
      ...options.esbuild,
      loader: "js",
      format: isCjs ? "cjs" : "esm",
      target: "es2022",
      supported: { "top-level-await": true },
    }).then((r) => r.code);
    // relinka("verbose", `Processed JavaScript file: ${input.path}`);
  }

  // Step 5: Convert ESM to CommonJS if needed
  shouldStopAtStep(5);
  if (isCjs) {
    relinka("verbose", `Converting ESM to CommonJS for: ${input.path}`);
    contents = jiti("")
      .transform({ source: contents, retainLines: false })
      .replace(/^exports.default = /gm, "module.exports = ")
      .replace(/^var _default = exports.default = /gm, "module.exports = ")
      .replace("module.exports = void 0;", "");
    relinka("verbose", `Converted to CommonJS format for: ${input.path}`);
  }

  // Step 6: Set output extension
  shouldStopAtStep(6);
  let extension = isCjs ? ".js" : ".mjs";
  if (options.ext) {
    extension = options.ext.startsWith(".") ? options.ext : `.${options.ext}`;
  }
  // relinka("verbose", `Using output extension: ${extension} for: ${input.path}`);

  // Step 7: Add transformed output
  shouldStopAtStep(7);
  const jsPath = input.path.replace(/\.[cm]?[jt]sx?$/, extension);
  output.push({
    contents,
    path: jsPath,
    extension,
  });
  // relinka("verbose", `Added transformed output for: ${input.path}`);

  // relinka("info", `Step 7: JavaScript/TypeScript processing completed for: ${input.path}`);
  return output;
};
