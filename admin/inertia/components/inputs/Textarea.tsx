import classNames from "classnames";
import { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
  helpText?: string;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
  containerClassName?: string;
  error?: boolean;
  required?: boolean;
  /** Shown under the field as `value.length/counterMax`, e.g. for a maxLength field. */
  counterMax?: number;
}

const Textarea: React.FC<TextareaProps> = ({
  className,
  label,
  name,
  helpText,
  labelClassName,
  textareaClassName,
  containerClassName,
  error,
  required,
  counterMax,
  value,
  ...props
}) => {
  const length = typeof value === "string" ? value.length : 0;
  return (
    <div className={classNames(className)}>
      <label
        htmlFor={name}
        className={classNames("block text-base/6 font-medium text-text-primary", labelClassName)}
      >
        {label}{required ? "*" : ""}
      </label>
      {helpText && <p className="mt-1 text-sm text-text-muted">{helpText}</p>}
      <div className={classNames("mt-1.5", containerClassName)}>
        <textarea
          id={name}
          name={name}
          value={value}
          className={classNames(
            textareaClassName,
            "block w-full rounded-md bg-surface-primary px-3 py-2 text-base text-text-primary border border-border-default placeholder:text-text-muted focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6 resize-y",
            error ? "!border-red-500 focus:outline-red-500 !bg-red-100" : ""
          )}
          {...props}
        />
        {typeof counterMax === "number" && (
          <p className="mt-1 text-xs text-text-muted text-right">
            {length}/{counterMax}
          </p>
        )}
      </div>
    </div>
  );
};

export default Textarea;
