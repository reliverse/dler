export const write = (text: string): void => {
  Bun.write(Bun.stdout, text);
};

// We're maintaining a single stdin reader and buffer across all prompts to avoid
// platform-specific issues with repeatedly creating readers (notably on Windows).
const stdinDecoder = new TextDecoder();
const stdinReader = Bun.stdin.stream().getReader();
let stdinBuffer = "";

const readLine = async (): Promise<string> => {
  // Try to fulfill from buffer first
  let newlineIndex = stdinBuffer.indexOf("\n");
  if (newlineIndex !== -1) {
    const line = stdinBuffer.slice(0, newlineIndex);
    stdinBuffer = stdinBuffer.slice(newlineIndex + 1);
    return line.replace(/\r$/, "").trim();
  }

  while (true) {
    const { value, done } = await stdinReader.read();
    if (done) {
      // Return whatever is left (EOF) if any
      const line = stdinBuffer;
      stdinBuffer = "";
      return line.replace(/\r$/, "").trim();
    }
    if (!value) {
      continue;
    }

    stdinBuffer += stdinDecoder.decode(value);
    newlineIndex = stdinBuffer.indexOf("\n");
    if (newlineIndex !== -1) {
      const line = stdinBuffer.slice(0, newlineIndex);
      stdinBuffer = stdinBuffer.slice(newlineIndex + 1);
      return line.replace(/\r$/, "").trim();
    }
  }
};

export const finalizePromptIO = async (): Promise<void> => {
  try {
    await stdinReader.cancel();
  } catch {
    // ignore
  }
  try {
    stdinReader.releaseLock();
  } catch {
    // ignore
  }
};

export const askQuestion = async (
  question: string,
  defaultValue?: string,
): Promise<string> => {
  if (defaultValue) {
    write(`${question} (${defaultValue}): `);
  } else {
    write(`${question}: `);
  }

  const answer = await readLine();
  return answer || defaultValue || "";
};