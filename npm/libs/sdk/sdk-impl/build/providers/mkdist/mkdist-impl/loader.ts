import type {
  CreateLoaderOptions,
  InputFile,
  LoaderContext,
  LoadFile,
} from "~/libs/sdk/sdk-impl/sdk-types";

import { resolveLoaders } from "./loaders/loaders-mod";

export function createLoader(loaderOptions: CreateLoaderOptions = {}) {
  const loaders = resolveLoaders(loaderOptions.loaders);

  const loadFile: LoadFile = async (input: InputFile) => {
    const context: LoaderContext = {
      loadFile,
      options: loaderOptions,
    };
    for (const loader of loaders) {
      const outputs = await loader(input, context);
      if (outputs?.length) {
        return outputs;
      }
    }
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
