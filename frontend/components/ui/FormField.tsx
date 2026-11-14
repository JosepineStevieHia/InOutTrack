import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FormFieldBaseProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
}: FormFieldBaseProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}

const baseControlClass =
  "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 read-only:bg-slate-50 read-only:text-slate-600";

function controlBorderClass(hasError: boolean) {
  return hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
    : "border-slate-300 focus:border-blue-600 focus:ring-blue-600/15";
}

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  id?: string;
  label: string;
  error?: string;
  helperText?: string;
  rightAdornment?: ReactNode;
};

export function TextInput({
  id,
  label,
  required,
  error,
  helperText,
  rightAdornment,
  className = "",
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      helperText={helperText}
    >
      <div className="relative">
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          className={`${baseControlClass} ${controlBorderClass(Boolean(error))} ${
            rightAdornment ? "pr-11" : ""
          } ${className}`}
          {...props}
        />
        {rightAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            {rightAdornment}
          </div>
        )}
      </div>
    </FormField>
  );
}

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectInputProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> & {
  id?: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
};

export function SelectInput({
  id,
  label,
  options,
  placeholder,
  required,
  error,
  helperText,
  className = "",
  ...props
}: SelectInputProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FormField
      label={label}
      htmlFor={selectId}
      required={required}
      error={error}
      helperText={helperText}
    >
      <select
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`${baseControlClass} ${controlBorderClass(Boolean(error))} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export type TextareaInputProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> & {
  id?: string;
  label: string;
  error?: string;
  helperText?: string;
};

export function TextareaInput({
  id,
  label,
  required,
  error,
  helperText,
  rows = 3,
  className = "",
  ...props
}: TextareaInputProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <FormField
      label={label}
      htmlFor={textareaId}
      required={required}
      error={error}
      helperText={helperText}
    >
      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        className={`${baseControlClass} ${controlBorderClass(Boolean(error))} ${className}`}
        {...props}
      />
    </FormField>
  );
}
