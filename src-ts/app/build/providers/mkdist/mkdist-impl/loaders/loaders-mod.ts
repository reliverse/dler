import type { Loader } from "~/app/types/mod";

import { jsLoader } from "./js";
import { postcssLoader } from "./postcss";
import { sassLoader } from "./sass";
import { vueLoader } from "./vue";

let cachedVueLoader: Loader | undefined;

const loaders = {
  js: jsLoader,
  vue:
    cachedVueLoader ||
    (async (...args) => {
      cachedVueLoader = await import("vue-sfc-transformer/mkdist")
        .then((r) => r.vueLoader)
        .catch(() => vueLoader);
      return cachedVueLoader(...args);
    }),
  sass: sassLoader,
  postcss: postcssLoader,
};

type LoaderName = keyof typeof loaders;

export const defaultLoaders: LoaderName[] = ["js", "vue", "sass", "postcss"];

export function resolveLoader(loader: LoaderName | Loader) {
  if (typeof loader === "string") {
    return loaders[loader];
  }
  return loader;
}

export function resolveLoaders(loaders: (LoaderName | Loader)[] = defaultLoaders) {
  return loaders
    .map((loaderName) => {
      const _loader = resolveLoader(loaderName);
      if (!_loader) {
        console.warn("Unknown loader:", loaderName);
      }
      return _loader;
    })
    .filter(Boolean) as Loader[];
}
