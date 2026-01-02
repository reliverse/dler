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
  // Use join directly - it's optimized in modern JS engines
  // Adding newline at the end for consistency
  const encoded = textEncoder.encode(`${lines.join("\n")}\n`);
  Bun.write(Bun.stderr, encoded);
};

export const writeJsonFile = async (
  path: string,
  data: unknown,
): Promise<void> => {
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
};

export const writeTextFile = async (
  path: string,
  content: string,
): Promise<void> => {
  await Bun.write(path, content);
};
