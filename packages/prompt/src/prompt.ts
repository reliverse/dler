import { ptr } from "bun:ffi";
import { cancel } from "./cancel";
import { symbols } from "./ffi";
import { encode, toString } from "./utils";

function formatPromptText(title?: string, message?: string): string {
  if (title && message) {
    // When both provided: title first, then dimmed message
    return `${title}\n\x1b[2m${message}\x1b[0m`;
  }
  // When only message provided: use it as title
  return message ?? title ?? "";
}

export type InputPromptOptions = {
  message: string;
  title?: string;
  charLimit?: number;
  required?: boolean;
  echoMode?: "normal" | "password" | "none";
  validateOkPrefix?: string;
  validateErrPrefix?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => boolean | string | null | undefined;
};

export async function inputPrompt(
  options: InputPromptOptions,
): Promise<string> {
  // Distinguish defaultValue and initialValue:
  // - defaultValue: Used when user presses Enter without typing anything
  // - initialValue: Pre-filled text that user can edit
  const defaultValue = options.defaultValue;
  const initialValue = options.initialValue;

  const originalPromptText = formatPromptText(options.title, options.message);
  let promptText = originalPromptText;
  let currentDefaultValue = defaultValue;
  let currentInitialValue = initialValue;

  while (true) {
    const returnedPtr = symbols.CreatePrompt(
      ptr(encode(promptText)),
      ptr(encode(options.echoMode || "normal")),
      ptr(encode(options.validateOkPrefix || "")),
      ptr(encode(options.validateErrPrefix || "")),
      ptr(encode(currentDefaultValue || "")),
      ptr(encode(currentInitialValue || "")),
      options.required ?? true,
      options.charLimit || 0,
    );
    const { value, error } = JSON.parse(toString(returnedPtr)) as {
      value: string;
      error: string;
    };
    if (error !== "") {
      if (error === "Cancelled") {
        if (options.required ?? true) {
          cancel(error);
        }
        // If not required, return empty string when cancelled
        return "";
      }
      throw new Error(error);
    }

    // If no validation function, return immediately
    if (!options.validate) {
      return value;
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
      return value;
    }

    // Validation failed - prepare error message and re-prompt
    const errorMessage =
      typeof validationResult === "string" ? validationResult : "Invalid input";

    // Update prompt text to include error message for next iteration
    promptText = `${originalPromptText}\n❌ ${errorMessage}`;
    // Clear defaultValue and initialValue for re-prompt
    currentDefaultValue = undefined;
    currentInitialValue = undefined;
  }
}
