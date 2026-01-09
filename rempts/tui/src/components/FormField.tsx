import { useState } from "react";

export interface FormFieldProps {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export function FormField({
  label,
  name,
  placeholder,
  required,
  value: initialValue = "",
  onChange,
  onSubmit,
}: FormFieldProps) {
  const [_value, setValue] = useState(initialValue);

  const handleInput = (newValue: string) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleSubmit = (submittedValue: string) => {
    onSubmit?.(submittedValue);
  };

  return (
    <box style={{ flexDirection: "column", marginBottom: 1 }}>
      <text content={`${label}${required ? " *" : ""}`} />
      <box border height={3} style={{ marginTop: 0.5 }} title={label}>
        <input
          focused={true}
          onInput={handleInput}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          style={{ focusedBackgroundColor: "#000000" }}
        />
      </box>
    </box>
  );
}
