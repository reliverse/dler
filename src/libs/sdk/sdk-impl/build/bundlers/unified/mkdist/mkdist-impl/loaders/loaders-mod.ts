import { relinka } from "@reliverse/relinka";
import type { Loader } from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loader";

import { jsLoader } from "./js";
import { postcssLoader } from "./postcss";
import { sassLoader } from "./sass";
import { vueLoader } from "./vue";

// Step 1: Initialize loaders registry
let cachedVueLoader: Loader | undefined;

// Step 2: Define available loaders
export const loaders = {
  js: jsLoader,
  vue:
    cachedVueLoader ||
    (async (...args) => {
      relinka("info", "Step 2: Loading Vue loader");
      relinka("verbose", "Attempting to load vue-sfc-transformer");
      cachedVueLoader = (await import("vue-sfc-transformer/mkdist")
        .then((r) => r.vueLoader)
        .catch(() => {
          relinka("verbose", "Falling back to default Vue loader");
          return vueLoader;
        })) as Loader;
      return cachedVueLoader(...args);
    }),
  sass: sassLoader,
  postcss: postcssLoader,
};

// Step 3: Define default loader order
export type LoaderName = keyof typeof loaders;
export const defaultLoaders: LoaderName[] = ["js", "vue", "sass", "postcss"];

// Step 4: Resolve individual loader
export function resolveLoader(loader: LoaderName | Loader) {
  relinka("verbose", "Resolving loader");
  if (typeof loader === "string") {
    relinka("verbose", `Resolving named loader: ${loader}`);
    return loaders[loader];
  }
  relinka("verbose", "Using provided loader function");
  return loader;
}

// Step 5: Resolve multiple loaders
export function resolveLoaders(loaders: (LoaderName | Loader)[] = defaultLoaders) {
  relinka("info", "Step 5: Resolving multiple loaders");
  relinka("verbose", `Processing ${loaders.length} loaders`);

  return loaders
    .map((loaderName) => {
      const _loader = resolveLoader(loaderName);
      if (!_loader) {
        relinka("warn", `Unknown loader: ${loaderName}`);
      }
      return _loader;
    })
    .filter(Boolean) as Loader[];
}
