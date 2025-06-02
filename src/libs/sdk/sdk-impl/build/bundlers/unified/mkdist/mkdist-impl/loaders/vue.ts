import { relinka } from "@reliverse/relinka";
import type { SFCBlock } from "vue/compiler-sfc";

import type {
  InputFile,
  Loader,
  LoaderContext,
  LoaderResult,
  OutputFile,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loader";

export type DefineVueLoaderOptions = {
  blockLoaders?: Record<string, VueBlockLoader | undefined>;
};

export type VueBlock = Pick<SFCBlock, "type" | "content" | "attrs">;

export type VueBlockLoader = (
  block: VueBlock,
  context: LoaderContext & {
    rawInput: InputFile;
    addOutput: (...files: OutputFile[]) => void;
  },
) => Promise<VueBlock | undefined>;

export type DefaultBlockLoaderOptions = {
  type: "script" | "style" | "template";
  outputLang: string;
  validExtensions?: string[];
};

let warnedTypescript = false;

// Step 1: Define Vue loader factory
function defineVueLoader(options?: DefineVueLoaderOptions): Loader {
  relinka("info", "Step 1: Creating Vue loader");
  const blockLoaders = options?.blockLoaders || {};

  return async (input, context) => {
    relinka("verbose", `Processing Vue file: ${input.path}`);

    // Step 2: Check if file should be processed
    if (input.extension !== ".vue") {
      relinka("verbose", "Skipping file - not a Vue file");
      return;
    }

    // Step 3: Parse Vue SFC
    relinka("verbose", "Parsing Vue Single File Component");
    const { parse } = await import("vue/compiler-sfc");
    let modified = false;

    const raw = await input.getContents();
    const sfc = parse(raw, {
      filename: input.srcPath,
      ignoreEmpty: true,
    });

    // Step 4: Handle parsing errors
    if (sfc.errors.length > 0) {
      relinka("warn", `Found ${sfc.errors.length} errors in Vue SFC`);
      for (const error of sfc.errors) {
        console.error(error);
      }
      return;
    }

    // Step 5: Check TypeScript support
    const isTs = [sfc.descriptor.script?.lang, sfc.descriptor.scriptSetup?.lang].some((lang) =>
      lang?.startsWith("ts"),
    );
    if (isTs && !warnedTypescript) {
      relinka(
        "warn",
        "vue-sfc-transformer is not installed. TypeScript syntax in Vue SFCs will not be transformed.",
      );
      warnedTypescript = true;
    }

    // Step 6: Process SFC blocks
    relinka("verbose", "Processing SFC blocks");
    const output: LoaderResult = [];
    const addOutput = (...files: OutputFile[]) => output.push(...files);

    const blocks: SFCBlock[] = [...sfc.descriptor.styles, ...sfc.descriptor.customBlocks].filter(
      (item) => !!item,
    );

    // Step 7: Generate default JS file
    relinka("verbose", "Generating default JS file");
    await context.loadFile({
      path: `${input.path}.js`,
      srcPath: `${input.srcPath}.js`,
      extension: ".js",
      getContents: () => "export default {}",
    });

    // Step 8: Process each block
    relinka("verbose", `Processing ${blocks.length} SFC blocks`);
    const results = await Promise.all(
      blocks.map(async (data) => {
        const blockLoader = blockLoaders[data.type];
        const result = await blockLoader?.(data, {
          ...context,
          rawInput: input,
          addOutput,
        });
        if (result) {
          modified = true;
        }
        return { block: result || data, offset: data.loc.start.offset };
      }),
    );

    if (!modified) {
      relinka("verbose", "No modifications made to SFC");
      return;
    }

    // Step 9: Add template and script blocks
    relinka("verbose", "Adding template and script blocks");
    if (sfc.descriptor.template) {
      results.unshift({
        block: sfc.descriptor.template,
        offset: sfc.descriptor.template.loc.start.offset,
      });
    }
    if (sfc.descriptor.script) {
      results.unshift({
        block: sfc.descriptor.script,
        offset: sfc.descriptor.script.loc.start.offset,
      });
    }
    if (sfc.descriptor.scriptSetup) {
      results.unshift({
        block: sfc.descriptor.scriptSetup,
        offset: sfc.descriptor.scriptSetup.loc.start.offset,
      });
    }

    // Step 10: Generate final SFC content
    relinka("verbose", "Generating final SFC content");
    const contents = results
      .sort((a, b) => a.offset - b.offset)
      .map(({ block }) => {
        const attrs = Object.entries(block.attrs)
          .map(([key, value]) => {
            if (!value) {
              return undefined;
            }
            return value === true ? key : `${key}="${value}"`;
          })
          .filter((item) => !!item)
          .join(" ");

        const header = `<${`${block.type} ${attrs}`.trim()}>`;
        const footer = `</${block.type}>`;

        return `${header}\n${block.content.trim()}\n${footer}\n`;
      })
      .join("\n");

    addOutput({
      path: input.path,
      srcPath: input.srcPath,
      extension: ".vue",
      contents,
      declaration: false,
    });

    relinka("info", "Step 10: Vue SFC processing completed");
    return output;
  };
}

// Step 11: Define default block loader
function defineDefaultBlockLoader(options: DefaultBlockLoaderOptions): VueBlockLoader {
  return async (block, { loadFile, rawInput, addOutput }) => {
    relinka("verbose", `Processing ${options.type} block`);

    if (options.type !== block.type) {
      return;
    }

    const lang = typeof block.attrs.lang === "string" ? block.attrs.lang : options.outputLang;
    const extension = `.${lang}`;

    const files =
      (await loadFile({
        getContents: () => block.content,
        path: `${rawInput.path}${extension}`,
        srcPath: `${rawInput.srcPath}${extension}`,
        extension,
      })) || [];

    const blockOutputFile = files.find(
      (f) =>
        f.extension === `.${options.outputLang}` ||
        options.validExtensions?.includes(f.extension as string),
    );
    if (!blockOutputFile || !blockOutputFile.contents) {
      return;
    }
    addOutput(...files.filter((f) => f !== blockOutputFile));

    return {
      type: block.type,
      attrs: toOmit(block.attrs, "lang"),
      content: blockOutputFile.contents,
    };
  };
}

// Step 12: Define style loader
const styleLoader = defineDefaultBlockLoader({
  outputLang: "css",
  type: "style",
});

// Step 13: Define fallback Vue loader
export const fallbackVueLoader = defineVueLoader({
  blockLoaders: {
    style: styleLoader,
  },
});

// Step 14: Define main Vue loader
let cachedVueLoader: Loader | undefined;
export const vueLoader: Loader = async (file: InputFile, ctx: LoaderContext) => {
  relinka("info", "Step 14: Loading Vue transformer");
  if (!cachedVueLoader) {
    relinka("verbose", "Attempting to load vue-sfc-transformer");
    cachedVueLoader = (await import("vue-sfc-transformer/mkdist")
      .then((r) => r.vueLoader)
      .catch(() => {
        relinka("verbose", "Falling back to default Vue loader");
        return fallbackVueLoader;
      })) as Loader;
  }
  if (!cachedVueLoader) {
    throw new Error("Failed to load Vue loader");
  }
  return cachedVueLoader(file, ctx);
};

// Step 15: Utility function to omit properties
function toOmit<R extends Record<keyof object, unknown>, K extends keyof R>(
  record: R,
  toRemove: K,
): Omit<R, K> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== toRemove)) as Omit<
    R,
    K
  >;
}
