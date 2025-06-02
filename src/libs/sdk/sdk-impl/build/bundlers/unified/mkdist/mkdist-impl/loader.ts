/* 1. Import necessary type definitions from various packages */
import type { Options as AutoprefixerOptions } from "autoprefixer";
import type { Options as CssnanoOptions } from "cssnano";
import type { CommonOptions } from "esbuild";
import type {
  AcceptedPlugin as PostcssPlugin,
  ProcessOptions as PostcssProcessOptions,
} from "postcss";
import type { Options as PostcssNestedOptions } from "postcss-nested";

import type { LoaderName } from "./loaders/loaders-mod";

import { resolveLoaders } from "./loaders/loaders-mod";

/* 2. Define core types for file handling */
export type InputFile = {
  path: string;
  extension: string;
  srcPath?: string;
  getContents: () => Promise<string> | string;
};

/* 3. Define output file structure */
export type OutputFile = {
  /**
   * relative to distDir
   */
  path: string;
  srcPath?: string;
  extension?: string;
  contents?: string;
  declaration?: boolean;
  errors?: Error[];
  raw?: boolean;
  skip?: boolean;
};

/* 4. Define loader result and file loading types */
export type LoaderResult = OutputFile[] | undefined;

export type LoadFile = (input: InputFile) => LoaderResult | Promise<LoaderResult>;

/* 5. Define loader options configuration */
export type LoaderOptions = {
  ext?: "js" | "mjs" | "cjs" | "ts" | "mts" | "cts";
  format?: "cjs" | "esm";
  declaration?: boolean;
  esbuild?: CommonOptions;
  postcss?:
    | false
    | {
        nested?: false | PostcssNestedOptions;
        autoprefixer?: false | AutoprefixerOptions;
        cssnano?: false | CssnanoOptions;
        plugins?: PostcssPlugin[];
        processOptions?: Omit<PostcssProcessOptions, "from">;
      };
};

/* 6. Define loader context structure */
export type LoaderContext = {
  loadFile: LoadFile;
  options: LoaderOptions;
};

/* 7. Define loader function type */
export type Loader = (
  input: InputFile,
  context: LoaderContext,
) => LoaderResult | Promise<LoaderResult>;

/* 8. Define loader creation options */
export type CreateLoaderOptions = {
  loaders?: (Loader | LoaderName)[];
} & LoaderOptions;

/* 9. Main loader creation function */
export function createLoader(loaderOptions: CreateLoaderOptions = {}) {
  /* 10. Resolve and initialize loaders */
  const loaders = resolveLoaders(loaderOptions.loaders);

  /* 11. Define the main file loading function */
  const loadFile: LoadFile = async (input: InputFile) => {
    const context: LoaderContext = {
      loadFile,
      options: loaderOptions,
    };
    /* 12. Try each loader in sequence until one succeeds */
    for (const loader of loaders) {
      const outputs = await loader(input, context);
      if (outputs?.length) {
        return outputs;
      }
    }
    /* 13. If no loader succeeds, return raw file */
    return [
      {
        path: input.path,
        srcPath: input.srcPath,
        raw: true,
      },
    ];
  };

  return {
    loadFile,
  };
}
