/**
 * Helpers for reading / writing JSON-with-comments files while
 * preserving (or later reinjecting) on–line and block comments.
 *
 * Supported comment styles:
 *   // single-line
 *   /* … *\/
 *   /** … *\/
 */

export const extractJsonComments = (raw: string) => {
  const out: Record<number, string> = {};
  const lines = raw.split("\n");

  // `i` is advanced manually so we can jump over blocks we just processed.
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line) {
      i += 1;
      continue;
    }

    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // ─────────── single-line "// …" comment ───────────
    if (trimmed.startsWith("//")) {
      out[i + 1] = trimmed.slice(2).trimStart();
      i += 1;
      continue;
    }

    // ─────────── block "/* … */" or "/** … */" comment ───────────
    if (trimmed.startsWith("/*")) {
      const isSupported = trimmed.startsWith("/**") || trimmed.startsWith("/*");
      if (!isSupported) {
        i += 1;
        continue;
      }

      const buff: string[] = [trimmed];
      let j = i + 1;

      // Gather all lines until closing */
      while (j < lines.length) {
        const currentLine = lines[j];
        if (!currentLine) {
          j += 1;
          continue;
        }

        if (currentLine.trimEnd().endsWith("*/")) {
          buff.push(currentLine.slice(indent));
          break;
        }

        buff.push(currentLine.slice(indent));
        j += 1;
      }

      out[i + 1] = buff.join("\n");
      i = j + 1;
      continue;
    }

    // ─────────── no comment on this line ───────────
    i += 1;
  }

  return Object.keys(out).length ? out : undefined;
};

/**
 * Very small "strip comments" helper:
 * removes // … and /* … *\/  (including multi-line).
 * This is intentionally simple; for complex JSONC we may want
 * use something like `strip-json-comments` in the future.
 */
export const stripComments = (raw: string) =>
  raw
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* block */
    .replace(/\/\/[^\r\n]*/g, ""); // // line
