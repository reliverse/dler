/* eslint-disable @typescript-eslint/no-empty-object-type */

import { relinka } from "@reliverse/relinka";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import postcss from "postcss";
import postcssNested from "postcss-nested";

import type {
  Loader,
  LoaderResult,
} from "~/libs/sdk/sdk-impl/build/bundlers/unified/mkdist/mkdist-impl/loader";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type PostcssLoaderOptions = {};

// Step 1: PostCSS file loader
export const postcssLoader: Loader = async (input, ctx) => {
  relinka("info", "Step 1: Processing PostCSS file");
  relinka("verbose", `Processing file: ${input.path}`);

  // Step 2: Check if file should be processed
  if (ctx.options.postcss === false || ![".css"].includes(input.extension)) {
    relinka("verbose", "Skipping file - PostCSS processing disabled or not a CSS file");
    return;
  }

  const output: LoaderResult = [];
  const contents = await input.getContents();

  // Step 3: Configure PostCSS plugins
  relinka("verbose", "Configuring PostCSS plugins");
  const plugins = [
    ctx.options.postcss?.nested !== false && postcssNested(ctx.options.postcss?.nested),
    ctx.options.postcss?.autoprefixer !== false && autoprefixer(ctx.options.postcss?.autoprefixer),
    ctx.options.postcss?.cssnano !== false && cssnano(ctx.options.postcss?.cssnano),
    ...(ctx.options.postcss?.plugins || []),
  ].filter(Boolean);

  relinka("verbose", `Using ${plugins.length} PostCSS plugins`);

  // Step 4: Process CSS with PostCSS
  relinka("verbose", "Processing CSS with PostCSS");
  const transformed = await postcss(plugins).process(contents, {
    ...ctx.options.postcss?.processOptions,
    from: input.srcPath,
  });

  // Step 5: Add transformed output
  output.push({
    contents: transformed.content,
    path: input.path,
    extension: ".css",
  });

  relinka("info", "Step 5: PostCSS processing completed");
  return output;
};
