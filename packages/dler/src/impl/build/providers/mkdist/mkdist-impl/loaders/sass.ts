import { pathToFileURL } from "node:url";
import { basename } from "@reliverse/pathkit";

import type { Loader, LoaderResult } from "~/impl/types/mod";

export const sassLoader: Loader = async (input) => {
  if (![".sass", ".scss"].includes(input.extension)) {
    return;
  }

  // sass files starting with "_" are always considered partials
  // and should not be compiled to standalone CSS
  // @ts-expect-error TODO: fix ts
  if (basename(input.srcPath).startsWith("_")) {
    return [
      {
        contents: "",
        path: input.path,
        skip: true,
      },
    ];
  }

  const compileString = await import("sass").then(
    (r) => r.compileString || r.default.compileString,
  );

  const output: LoaderResult = [];

  const contents = await input.getContents();

  output.push({
    contents: compileString(contents, {
      loadPaths: ["node_modules"],
      // @ts-expect-error TODO: fix ts
      url: pathToFileURL(input.srcPath),
    }).css,
    path: input.path,
    extension: ".css",
  });

  return output;
};
