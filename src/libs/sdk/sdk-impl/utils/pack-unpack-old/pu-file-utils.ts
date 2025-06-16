import path from "@reliverse/pathkit";
import { promises as fs } from "node:fs";

import { isBinaryExt } from "~/libs/sdk/sdk-impl/utils/binary";

import type { FileType, TemplatesFileContent } from "./pu-types";

import { isJsonExt } from "./pu-constants";
import { extractJsonComments, stripComments } from "./pub-json-utils";

export const walkDir = async (dir: string): Promise<string[]> => {
  const entries: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...(await walkDir(full)));
    } else {
      entries.push(full);
    }
  }
  return entries;
};

export const detectFileTypePU = async (file: string): Promise<FileType> => {
  if (await isBinaryExt(file)) return "binary";
  if (isJsonExt(file)) return "json";
  return "text";
};

export const readFileForTemplate = async (absPath: string): Promise<TemplatesFileContent> => {
  const type = await detectFileTypePU(absPath);

  try {
    if (type === "binary") {
      return { type, content: "" };
    }

    const data = await fs.readFile(absPath, "utf8");

    if (type === "json") {
      const jsonComments = extractJsonComments(data);
      const json = JSON.parse(stripComments(data)) as Record<string, unknown>;
      return { type, content: json, jsonComments };
    }

    // text
    return { type, content: data };
  } catch (error) {
    return {
      type,
      content: "",
      hasError: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// escape a string so it can live safely inside back-ticks
export const escapeTemplateString = (src: string) =>
  src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
