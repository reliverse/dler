import { ptr } from "bun:ffi";
import { symbols } from "./ffi";
import { encode, toString } from "./utils";

export type InputPromptOptions = {
  title: string;
  charLimit?: number;
  required?: boolean;
  echoMode?: "normal" | "password" | "none";
  validateOkPrefix?: string;
  validateErrPrefix?: string;
  defaultValue?: string;
};

export type PromptResult = {
  value: string | null;
  error: string | null;
};

export async function inputPrompt(
  options: InputPromptOptions,
): Promise<PromptResult> {
  const returnedPtr = symbols.CreatePrompt(
    ptr(encode(options.title)),
    ptr(encode(options.echoMode || "normal")),
    ptr(encode(options.validateOkPrefix || "")),
    ptr(encode(options.validateErrPrefix || "")),
    ptr(encode(options.defaultValue || "")),
    options.required ?? true,
    options.charLimit || 0,
  );
  const { value, error } = JSON.parse(toString(returnedPtr)) as {
    value: string;
    error: string;
  };
  if (error !== "") {
    return {
      value: null,
      error,
    };
  }
  return {
    value,
    error: null,
  };
}

export async function askQuestion(
  title: string,
  defaultValue?: string,
): Promise<string> {
  const result = await inputPrompt({
    title,
    defaultValue,
    required: false,
  });
  if (result.error) {
    throw new Error(result.error);
  }
  return result.value ?? "";
}
