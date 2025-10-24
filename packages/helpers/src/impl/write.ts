// Optimized output functions that batch writes
const textEncoder = new TextEncoder();

export const writeLine = (text: string): void => {
  const encoded = textEncoder.encode(`${text}\n`);
  Bun.write(Bun.stdout, encoded);
};

export const writeError = (text: string): void => {
  const encoded = textEncoder.encode(`${text}\n`);
  Bun.write(Bun.stderr, encoded);
};

export const writeErrorLines = (lines: string[]): void => {
  // Pre-allocate string buffer for better performance
  const buffer = new Array(lines.length + 1);
  for (let i = 0; i < lines.length; i++) {
    buffer[i] = lines[i];
  }
  buffer[lines.length] = "";
  const encoded = textEncoder.encode(buffer.join("\n"));
  Bun.write(Bun.stderr, encoded);
};

export const writeJsonFile = async (
  path: string,
  data: unknown,
): Promise<void> => {
  await Bun.write(path, JSON.stringify(data, null, 2) + "\n");
};

export const writeTextFile = async (
  path: string,
  content: string,
): Promise<void> => {
  await Bun.write(path, content);
};
