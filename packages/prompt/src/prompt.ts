import { ptr } from "bun:ffi";
import { cancel } from "./cancel";
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
  validate?: (value: string) => boolean | string | null | undefined;
};

export type PromptResult = {
  value: string | null;
  error: string | null;
};

export async function inputPrompt(
  options: InputPromptOptions,
): Promise<PromptResult> {
  const originalTitle = options.title;
  let promptTitle = originalTitle;
  let defaultValue = options.defaultValue;

  while (true) {
    const returnedPtr = symbols.CreatePrompt(
      ptr(encode(promptTitle)),
      ptr(encode(options.echoMode || "normal")),
      ptr(encode(options.validateOkPrefix || "")),
      ptr(encode(options.validateErrPrefix || "")),
      ptr(encode(defaultValue || "")),
      options.required ?? true,
      options.charLimit || 0,
    );
    const { value, error } = JSON.parse(toString(returnedPtr)) as {
      value: string;
      error: string;
    };
    if (error !== "") {
      if (error === "Cancelled") {
        cancel(error);
      }
      return {
        value: null,
        error,
      };
    }

    // If no validation function, return immediately
    if (!options.validate) {
      return {
        value,
        error: null,
      };
    }

    // Run validation
    const validationResult = options.validate(value);

    // Check if validation passed
    // Valid: true, null, undefined
    // Invalid: false, string (error message)
    if (
      validationResult === true ||
      validationResult === null ||
      validationResult === undefined
    ) {
      return {
        value,
        error: null,
      };
    }

    // Validation failed - prepare error message and re-prompt
    const errorMessage =
      typeof validationResult === "string" ? validationResult : "Invalid input";

    // Update prompt title to include error message for next iteration
    promptTitle = `${originalTitle}\n❌ ${errorMessage}`;
    // Clear defaultValue for re-prompt
    defaultValue = undefined;
  }
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
