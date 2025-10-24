// transform-impl-mod.ts (transform-impl-mod.ts → inject-impl-mod.ts → e-ms-inject.ts)

import { promises as fs } from "node:fs";
import type { SourceMapOptions } from "magic-string";
import MagicString, { Bundle } from "magic-string";

export interface MagicStringOptions {
  filename?: string;
  indentExclusionRanges?: [number, number][];
  ignoreList?: boolean;
  offset?: number;
}

export interface UpdateOptions {
  storeName?: boolean;
  overwrite?: boolean;
}

export interface OverwriteOptions {
  storeName?: boolean;
  contentOnly?: boolean;
}

export interface IndentOptions {
  exclude?: [number, number][];
}

export interface StringTransformer {
  readonly original: string;
  readonly current: () => string;
  readonly hasChanged: () => boolean;
  readonly isEmpty: () => boolean;
  readonly clone: () => StringTransformer;
  readonly generateMap: (options?: SourceMapOptions) => any;
  readonly generateDecodedMap: (options?: SourceMapOptions) => any;
}

export interface TransformResult {
  code: string;
  map?: any;
  hasChanged: boolean;
  transformer: StringTransformer;
}

// Internal type that also holds the MagicString instance.
// This is not exposed to the end-user but used by the transform functions.
interface InternalStringTransformer extends StringTransformer {
  readonly _ms: MagicString;
}

// This function is the central factory for creating transformers.
// It ensures the MagicString instance is carried along for proper chaining.
export const createTransformerFromMagicString = (
  ms: MagicString,
  original: string,
): StringTransformer => {
  const transformer: InternalStringTransformer = {
    original,
    _ms: ms,
    current: () => ms.toString(),
    hasChanged: () => ms.hasChanged(),
    isEmpty: () => ms.isEmpty(),
    clone: () => createTransformerFromMagicString(ms.clone(), original),
    generateMap: (mapOptions?: SourceMapOptions) => ms.generateMap(mapOptions),
    generateDecodedMap: (mapOptions?: SourceMapOptions) =>
      ms.generateDecodedMap(mapOptions),
  };
  return transformer;
};

// Core functional API
export const createTransformer = (
  source: string,
  options?: MagicStringOptions,
): StringTransformer => {
  const ms = new MagicString(source, options);
  return createTransformerFromMagicString(ms, source);
};

// Transformation functions
// Each function clones the MagicString instance from the previous state,
// applies its transformation, and returns a new transformer.
export const update = (
  transformer: StringTransformer,
  start: number,
  end: number,
  content: string,
  options?: UpdateOptions,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.update(start, end, content, options);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const overwrite = (
  transformer: StringTransformer,
  start: number,
  end: number,
  content: string,
  options?: OverwriteOptions,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.overwrite(start, end, content, options);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const append = (
  transformer: StringTransformer,
  content: string,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.append(content);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const prepend = (
  transformer: StringTransformer,
  content: string,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.prepend(content);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const remove = (
  transformer: StringTransformer,
  start: number,
  end: number,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.remove(start, end);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const replace = (
  transformer: StringTransformer,
  searchValue: string | RegExp,
  replaceValue: string | ((match: string, ...args: any[]) => string),
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.replace(searchValue, replaceValue);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const replaceAll = (
  transformer: StringTransformer,
  searchValue: string | RegExp,
  replaceValue: string | ((match: string, ...args: any[]) => string),
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.replaceAll(searchValue, replaceValue);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const indent = (
  transformer: StringTransformer,
  prefix?: string,
  options?: IndentOptions,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.indent(prefix, options);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const trim = (
  transformer: StringTransformer,
  charType?: string,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.trim(charType);
  return createTransformerFromMagicString(ms, transformer.original);
};

// Pipeline operations
export const pipe = <T>(value: T, ...operations: ((input: T) => T)[]): T =>
  operations.reduce((acc, operation) => operation(acc), value);

// Additional utility functions
export const wrapWith = (
  transformer: StringTransformer,
  prefix: string,
  suffix: string,
): StringTransformer =>
  pipe(
    transformer,
    (t) => prepend(t, prefix),
    (t) => append(t, suffix),
  );

export const insertAt = (
  transformer: StringTransformer,
  index: number,
  content: string,
): StringTransformer => {
  const ms = (transformer as InternalStringTransformer)._ms.clone();
  ms.appendLeft(index, content);
  return createTransformerFromMagicString(ms, transformer.original);
};

export const slice = (
  transformer: StringTransformer,
  start = 0,
  end?: number,
): string => {
  const currentString = transformer.current();
  return currentString.slice(start, end ?? currentString.length);
};

// Template literal helpers
export const template = (
  strings: TemplateStringsArray,
  ...values: any[]
): StringTransformer => {
  const source = strings.reduce(
    (result, string, i) => result + string + (values[i] || ""),
    "",
  );
  return createTransformer(source);
};

// Async file operations
export const readAndTransform = async (
  filePath: string,
  transformer: (content: StringTransformer) => StringTransformer,
): Promise<TransformResult> => {
  const content = await fs.readFile(filePath, "utf-8");
  const original = createTransformer(content);
  const transformed = transformer(original);

  return {
    code: transformed.current(),
    hasChanged: transformed.hasChanged(),
    transformer: transformed,
  };
};

export const transformAndWrite = async (
  inputPath: string,
  outputPath: string,
  transformer: (content: StringTransformer) => StringTransformer,
  options?: { generateSourceMap?: boolean; sourceMapPath?: string },
): Promise<void> => {
  const result = await readAndTransform(inputPath, transformer);

  await fs.writeFile(outputPath, result.code);

  if (options?.generateSourceMap && options.sourceMapPath) {
    const map = result.transformer.generateMap({
      source: inputPath,
      file: options.sourceMapPath,
      includeContent: true,
    });
    await fs.writeFile(options.sourceMapPath, map.toString());
  }
};

// Batch operations
export const transformMultiple = async (
  transformations: {
    input: string;
    output: string;
    transformer: (content: StringTransformer) => StringTransformer;
  }[],
): Promise<void> => {
  await Promise.all(
    transformations.map(({ input, output, transformer }) =>
      transformAndWrite(input, output, transformer),
    ),
  );
};

// Bundle operations
export interface BundleSource {
  filename: string;
  content: StringTransformer;
  ignoreList?: boolean;
  indentExclusionRanges?: [number, number][];
}

export const createBundle = (sources: BundleSource[] = []) => {
  const bundle = new Bundle();

  for (const source of sources) {
    bundle.addSource({
      filename: source.filename,
      content: new MagicString(source.content.current()),
      ignoreList: source.ignoreList,
      indentExclusionRanges: source.indentExclusionRanges,
    });
  }

  return {
    addSource: (source: BundleSource) => {
      bundle.addSource({
        filename: source.filename,
        content: new MagicString(source.content.current()),
        ignoreList: source.ignoreList,
        indentExclusionRanges: source.indentExclusionRanges,
      });
      return createBundle([]);
    },
    indent: (prefix?: string) => {
      bundle.indent(prefix);
      return createBundle([]);
    },
    prepend: (content: string) => {
      bundle.prepend(content);
      return createBundle([]);
    },
    append: (content: string) => {
      bundle.append(content);
      return createBundle([]);
    },
    toString: () => bundle.toString(),
    generateMap: (options?: SourceMapOptions) => bundle.generateMap(options),
  };
};

// Composition helpers
export const compose =
  <T>(...transformers: ((input: T) => T)[]): ((input: T) => T) =>
  (input: T) =>
    transformers.reduceRight((acc, transformer) => transformer(acc), input);

// Export everything
export * from "magic-string";
export default {
  createTransformer,
  update,
  overwrite,
  append,
  prepend,
  remove,
  replace,
  replaceAll,
  indent,
  trim,
  pipe,
  wrapWith,
  insertAt,
  slice,
  template,
  readAndTransform,
  transformAndWrite,
  transformMultiple,
  createBundle,
  compose,
};
