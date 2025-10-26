import type { MkdistLoader } from "../../../types";

import { jsLoader } from "./js";

const loaders = {
	js: jsLoader,
};

type LoaderName = keyof typeof loaders;

export const defaultLoaders: LoaderName[] = ["js"];

export function resolveLoader(loader: LoaderName | MkdistLoader) {
	if (typeof loader === "string") {
		return loaders[loader];
	}
	return loader;
}

export function resolveLoaders(
	loaders: (LoaderName | MkdistLoader)[] = defaultLoaders,
) {
	return loaders
		.map((loaderName) => {
			const _loader = resolveLoader(loaderName);
			if (!_loader) {
				console.warn("Unknown loader:", loaderName);
			}
			return _loader;
		})
		.filter(Boolean) as MkdistLoader[];
}
