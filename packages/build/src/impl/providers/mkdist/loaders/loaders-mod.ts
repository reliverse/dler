import type { Loader } from "../../../types";

import { jsLoader } from "./js";
import { postcssLoader } from "./postcss";

const loaders = {
	js: jsLoader,
	postcss: postcssLoader,
};

type LoaderName = keyof typeof loaders;

export const defaultLoaders: LoaderName[] = ["js", "postcss"];

export function resolveLoader(loader: LoaderName | Loader) {
	if (typeof loader === "string") {
		return loaders[loader];
	}
	return loader;
}

export function resolveLoaders(
	loadersParam: (LoaderName | Loader)[] = defaultLoaders,
) {
	return loadersParam
		.map((loaderName) => {
			const _loader = resolveLoader(loaderName);
			if (!_loader) {
				console.warn("Unknown loader:", loaderName);
			}
			return _loader;
		})
		.filter((loader): loader is Loader => loader !== null && loader !== undefined);
}
