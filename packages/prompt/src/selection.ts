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
  message: string;
  title?: string;
  options: TOptions;
  perPage?: number;
  headerText?: string;
  footerText?: string;
  required?: boolean;
  autocomplete?: boolean;
  defaultValue?: string;
  initialValue?: string;
};

export type MultiselectPromptOptions<
  TOptions extends readonly SelectionItem[] = SelectionItem[],
> = {
  message: string;
  title?: string;
  options: TOptions;
  perPage?: number;
  headerText?: string;
  footerText?: string;
  required?: boolean;
  autocomplete?: boolean;
  defaultValue?: string[];
  initialValue?: string;
};

export type ConfirmPromptOptions = {
  message: string;
  title?: string;
  headerText?: string;
  footerText?: string;
  required?: boolean;
  defaultValue?: boolean;
  initialValue?: boolean;
};

// Overload signatures for explicit type parameter support
export function selectPrompt<T extends string>(
  options: SelectPromptOptions<readonly SelectionItem<T>[]> & {
    required: false;
  },
): Promise<T | null>;
export function selectPrompt<T extends string>(
  options: SelectPromptOptions<readonly SelectionItem<T>[]> & {
    required?: true;
  },
): Promise<T>;
export function selectPrompt<const TOptions extends readonly SelectionItem[]>(
  options: SelectPromptOptions<TOptions> & { required: false },
): Promise<ExtractValues<TOptions> | null>;
export function selectPrompt<const TOptions extends readonly SelectionItem[]>(
  options: SelectPromptOptions<TOptions> & { required?: true },
): Promise<ExtractValues<TOptions>>;
export async function selectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: SelectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions> | null> {
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
  const headerText =
    options.headerText ||
    formatPromptText(options.title, options.message) ||
    "Select an item: ";
  const returnedPtr = symbols.CreateSelection(
    ptr(encode(stringifiedItems)),
    ptr(encode(headerText)),
    ptr(encode(options.footerText || "")),
    options.perPage || 5,
    options.autocomplete ?? true,
    ptr(encode(options.defaultValue || "")),
    ptr(encode(options.initialValue || "")),
  );
  const { selectedIndex, error } = JSON.parse(toString(returnedPtr)) as {
    selectedIndex: string;
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      if (options.required ?? true) {
        cancel(error);
      }
      return null;
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
  options: MultiselectPromptOptions<readonly SelectionItem<T>[]> & {
    required: false;
  },
): Promise<T[] | null>;
export function multiselectPrompt<T extends string>(
  options: MultiselectPromptOptions<readonly SelectionItem<T>[]> & {
    required?: true;
  },
): Promise<T[]>;
export function multiselectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: MultiselectPromptOptions<TOptions> & { required: false },
): Promise<ExtractValues<TOptions>[] | null>;
export function multiselectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: MultiselectPromptOptions<TOptions> & { required?: true },
): Promise<ExtractValues<TOptions>[]>;
export async function multiselectPrompt<
  const TOptions extends readonly SelectionItem[],
>(
  options: MultiselectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions>[] | null> {
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
  const headerText =
    options.headerText ||
    formatPromptText(options.title, options.message) ||
    "Select items: ";
  const defaultValueJson = JSON.stringify(options.defaultValue ?? []);
  const returnedPtr = symbols.CreateMultiselect(
    ptr(encode(stringifiedItems)),
    ptr(encode(headerText)),
    ptr(encode(options.footerText || "")),
    options.perPage || 5,
    options.autocomplete ?? true,
    ptr(encode(defaultValueJson)),
    ptr(encode(options.initialValue || "")),
  );
  const { selectedIndices, error } = JSON.parse(toString(returnedPtr)) as {
    selectedIndices: string[];
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      if (options.required ?? true) {
        cancel(error);
      }
      return null;
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
): Promise<boolean> {
  const promptText = formatPromptText(options.title, options.message);
  const defaultValue =
    options.defaultValue !== undefined ? String(options.defaultValue) : "";
  const initialValue =
    options.initialValue !== undefined ? String(options.initialValue) : "";
  const returnedPtr = symbols.CreateConfirm(
    ptr(encode(promptText)),
    ptr(encode(options.headerText || "")),
    ptr(encode(options.footerText || "")),
    ptr(encode(defaultValue)),
    ptr(encode(initialValue)),
  );
  const { confirmed, error } = JSON.parse(toString(returnedPtr)) as {
    confirmed: string;
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      if (options.required ?? true) {
        cancel(error);
      }
      // If not required, return defaultValue or false
      return options.defaultValue ?? false;
    }
    throw new Error(error);
  }
  if (confirmed === "") {
    throw new Error("No confirmation received");
  }
  return confirmed === "true";
}

export type GroupMultiselectPromptOptions<
  TOptions extends Record<string, readonly SelectionItem[]> = Record<
    string,
    readonly SelectionItem[]
  >,
> = {
  message: string;
  title?: string;
  options: TOptions;
  perPage?: number;
  headerText?: string;
  footerText?: string;
  required?: boolean;
  autocomplete?: boolean;
  defaultValue?: string[];
  initialValue?: string;
  selectableGroups?: boolean;
  groupSpacing?: number;
};

type GroupedSelectionItem = SelectionItem & {
  isGroupHeader: boolean;
  groupName: string;
};

// Overload signatures for explicit type parameter support
export function groupMultiselectPrompt<T extends string>(
  options: GroupMultiselectPromptOptions<
    Record<string, readonly SelectionItem<T>[]>
  > & {
    required: false;
  },
): Promise<T[] | null>;
export function groupMultiselectPrompt<T extends string>(
  options: GroupMultiselectPromptOptions<
    Record<string, readonly SelectionItem<T>[]>
  > & {
    required?: true;
  },
): Promise<T[]>;
export function groupMultiselectPrompt<
  const TOptions extends Record<string, readonly SelectionItem[]>,
>(
  options: GroupMultiselectPromptOptions<TOptions> & { required: false },
): Promise<ExtractValues<TOptions[keyof TOptions]>[] | null>;
export function groupMultiselectPrompt<
  const TOptions extends Record<string, readonly SelectionItem[]>,
>(
  options: GroupMultiselectPromptOptions<TOptions> & { required?: true },
): Promise<ExtractValues<TOptions[keyof TOptions]>[]>;
export async function groupMultiselectPrompt<
  const TOptions extends Record<string, readonly SelectionItem[]>,
>(
  options: GroupMultiselectPromptOptions<TOptions>,
): Promise<ExtractValues<TOptions[keyof TOptions]>[] | null> {
  // Flatten grouped options into a list with group headers
  const flattenedItems: GroupedSelectionItem[] = [];
  const valueToIndexMap = new Map<string, number>();

  for (const [groupName, groupItems] of Object.entries(options.options)) {
    // Add group header
    flattenedItems.push({
      value: `__group__${groupName}`,
      label: groupName,
      hint: "",
      disabled: false,
      isGroupHeader: true,
      groupName,
    });

    // Add items in the group
    for (const item of groupItems) {
      const index = flattenedItems.length;
      valueToIndexMap.set(item.value, index);
      flattenedItems.push({
        ...item,
        isGroupHeader: false,
        groupName,
      });
    }
  }

  const stringifiedItems = JSON.stringify(
    flattenedItems.map((item) => {
      return {
        value: item.value,
        label: item.label,
        hint: item.hint ?? "",
        disabled: item.disabled ?? false,
        isGroupHeader: item.isGroupHeader,
        groupName: item.groupName,
      };
    }),
  );

  const headerText =
    options.headerText ||
    formatPromptText(options.title, options.message) ||
    "Select items: ";

  const defaultValueJson = JSON.stringify(options.defaultValue ?? []);

  const returnedPtr = symbols.CreateGroupMultiselect(
    ptr(encode(stringifiedItems)),
    ptr(encode(headerText)),
    ptr(encode(options.footerText || "")),
    options.perPage || 5,
    options.autocomplete ?? true,
    options.selectableGroups ?? false,
    ptr(encode(defaultValueJson)),
    ptr(encode(options.initialValue || "")),
    options.groupSpacing ?? 0,
  );
  const { selectedIndices, error } = JSON.parse(toString(returnedPtr)) as {
    selectedIndices: string[];
    error: string;
  };
  if (error !== "") {
    if (error === "Cancelled") {
      if (options.required ?? true) {
        cancel(error);
      }
      return null;
    }
    throw new Error(error);
  }
  const indices = selectedIndices.map((idx) => Number(idx));
  const values = indices
    .map((index) => {
      const item = flattenedItems[index];
      return item && !item.isGroupHeader ? item.value : undefined;
    })
    .filter(
      (value): value is ExtractValues<TOptions[keyof TOptions]> =>
        value !== undefined,
    );
  if (values.length !== indices.length) {
    throw new Error("Invalid selection indices");
  }
  return values;
}
