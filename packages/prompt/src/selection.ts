import { ptr } from "bun:ffi";
import { cancel } from "./cancel";
import { symbols } from "./ffi";
import { encode, toString } from "./utils";

export type SelectionItem<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type ExtractValues<T extends readonly SelectionItem[]> = T[number]["value"];

export type SelectPromptOptions<
  TOptions extends readonly SelectionItem[] = SelectionItem[],
> = {
  title: string;
  options: TOptions;
  perPage?: number;
  headerText?: string;
  footerText?: string;
};

export type MultiselectPromptOptions<
  TOptions extends readonly SelectionItem[] = SelectionItem[],
> = {
  title: string;
  options: TOptions;
  perPage?: number;
  headerText?: string;
  footerText?: string;
};

export type ConfirmPromptOptions = {
  title: string;
  headerText?: string;
  footerText?: string;
};

export type ConfirmReturn = {
  confirmed: boolean | null;
  error: string | null;
};

// Overload signatures for explicit type parameter support
export function selectPrompt<T extends string>(
  options: SelectPromptOptions<readonly SelectionItem<T>[]>,
): Promise<T>;
export function selectPrompt<const TOptions extends readonly SelectionItem[]>(
  options: SelectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions>>;
export async function selectPrompt<
  const TOptions extends readonly SelectionItem[],
>(options: SelectPromptOptions<TOptions>): Promise<ExtractValues<TOptions>> {
  const stringifiedItems = JSON.stringify(
    options.options.map((item) => {
      return {
        value: item.value,
        label: item.label,
        hint: item.hint ?? "",
        disabled: item.disabled ?? false,
      };
    }),
  );
  const returnedPtr = symbols.CreateSelection(
    ptr(encode(stringifiedItems)),
    ptr(encode(options.headerText || options.title || "Select an item: ")),
    ptr(encode(options.footerText || "")),
    options.perPage || 5,
  );
  const { selectedIndex, error } = JSON.parse(toString(returnedPtr)) as {
    selectedIndex: string;
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      cancel(error);
    }
    throw new Error(error);
  }
  const index = Number(selectedIndex);
  const selectedOption = options.options[index];
  if (!selectedOption) {
    throw new Error("Invalid selection index");
  }
  return selectedOption.value as ExtractValues<TOptions>;
}

// Overload signatures for explicit type parameter support
export function multiselectPrompt<T extends string>(
  options: MultiselectPromptOptions<readonly SelectionItem<T>[]>,
): Promise<T[]>;
export function multiselectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: MultiselectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions>[]>;
export async function multiselectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: MultiselectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions>[]> {
  const stringifiedItems = JSON.stringify(
    options.options.map((item) => {
      return {
        value: item.value,
        label: item.label,
        hint: item.hint ?? "",
        disabled: item.disabled ?? false,
      };
    }),
  );
  const returnedPtr = symbols.CreateMultiselect(
    ptr(encode(stringifiedItems)),
    ptr(encode(options.headerText || options.title || "Select items: ")),
    ptr(encode(options.footerText || "")),
    options.perPage || 5,
  );
  const { selectedIndices, error } = JSON.parse(toString(returnedPtr)) as {
    selectedIndices: string[];
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      cancel(error);
    }
    throw new Error(error);
  }
  const indices = selectedIndices.map((idx) => Number(idx));
  const values = indices
    .map((index) => options.options[index]?.value)
    .filter((value): value is ExtractValues<TOptions> => value !== undefined);
  if (values.length !== indices.length) {
    throw new Error("Invalid selection indices");
  }
  return values;
}

export async function confirmPrompt(
  options: ConfirmPromptOptions,
): Promise<ConfirmReturn> {
  const returnedPtr = symbols.CreateConfirm(
    ptr(encode(options.title)),
    ptr(encode(options.headerText || "")),
    ptr(encode(options.footerText || "")),
  );
  const { confirmed, error } = JSON.parse(toString(returnedPtr)) as {
    confirmed: string;
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      cancel(error);
    }
    return {
      confirmed: null,
      error,
    };
  }
  if (confirmed === "") {
    return {
      confirmed: null,
      error: null,
    };
  }
  return {
    confirmed: confirmed === "true",
    error: null,
  };
}
