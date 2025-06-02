import { relinka } from "@reliverse/relinka";
import { pathToFileURL } from "node:url";
import { basename } from "pathe";

import type {
  Loader,
  LoaderResult,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loader";

// Step 1: SASS file loader
export const sassLoader: Loader = async (input) => {
  relinka("info", "Step 1: Processing SASS file");
  relinka("verbose", `Processing file: ${input.path}`);

  // Step 2: Check if file should be processed
  if (![".sass", ".scss"].includes(input.extension)) {
    relinka("verbose", "Skipping file - not a SASS/SCSS file");
    return;
  }

  // Step 3: Check for partial files
  if (basename(input.srcPath || "").startsWith("_")) {
    relinka("verbose", "Skipping partial SASS file");
    return [
      {
        contents: "",
        path: input.path,
        skip: true,
      },
    ];
  }

  // Step 4: Load SASS compiler
  relinka("verbose", "Loading SASS compiler");
  const compileString = await import("sass").then(
    (r) => r.compileString || r.default.compileString,
  );

  const output: LoaderResult = [];
  const contents = await input.getContents();

  // Step 5: Compile SASS to CSS
  relinka("verbose", "Compiling SASS to CSS");
  output.push({
    contents: compileString(contents, {
      loadPaths: ["node_modules"],
      url: pathToFileURL(input.srcPath || ""),
    }).css,
    path: input.path,
    extension: ".css",
  });

  relinka("info", "Step 5: SASS processing completed");
  return output;
};
