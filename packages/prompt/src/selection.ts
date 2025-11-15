import { ptr } from "bun:ffi";
import { symbols } from "./ffi";
import { encode, toString } from "./utils";

export type SelectionItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type SelectPromptOptions = {
  title: string;
  options: SelectionItem[];
  perPage?: number;
  headerText?: string;
  footerText?: string;
};

export type MultiselectPromptOptions = {
  title: string;
  options: SelectionItem[];
  perPage?: number;
  headerText?: string;
  footerText?: string;
};

export type SelectionReturn = {
  selectedIndex: number | null;
  error: string | null;
};

export type MultiselectReturn = {
  selectedIndices: number[];
  error: string | null;
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

export async function selectPrompt(
  options: SelectPromptOptions,
): Promise<SelectionReturn> {
  const stringifiedItems = JSON.stringify(
    options.options.map((item) => {
      return {
        id: item.id,
        label: item.label,
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
    return {
      selectedIndex: null,
      error,
    };
  }
  return {
    selectedIndex: Number(selectedIndex),
    error: null,
  };
}

export async function multiselectPrompt(
  options: MultiselectPromptOptions,
): Promise<MultiselectReturn> {
  const stringifiedItems = JSON.stringify(
    options.options.map((item) => {
      return {
        id: item.id,
        label: item.label,
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
    return {
      selectedIndices: [],
      error,
    };
  }
  return {
    selectedIndices: selectedIndices.map((idx) => Number(idx)),
    error: null,
  };
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
