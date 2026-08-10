import React, { useEffect, useRef, useState } from 'react';

/**
 * A highly reusable Checkbox Component
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.checked - Controlled checked state
 * @param {boolean} props.defaultChecked - Default checked state (uncontrolled)
 * @param {boolean} props.indeterminate - Show the indeterminate (dash) visual state
 * @param {Function} props.onChange - Change handler function (event) => void
 * @param {boolean} props.disabled - Enable/disable the checkbox
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.label - Label text shown next to the checkbox
 * @param {string} props.description - Secondary helper text shown under the label
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {string} props.size - Checkbox size (sm, md, lg)
 * @param {string} props.error - Error message to display
 * @param {string} props.className - Additional CSS classes for the checkbox input
 * @param {string} props.labelClassName - Additional CSS classes for the label text
 */
const Checkbox = ({
  checked,
  defaultChecked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  required = false,
  label = '',
  description = '',
  name = '',
  id = '',
  size = 'md',
  error = '',
  className = '',
  labelClassName = '',
  ...restProps
}) => {
  const inputRef = useRef(null);
  const [internalChecked, setInternalChecked] = useState(defaultChecked);

  const isControlled = checked !== undefined;
  const currentChecked = isControlled ? checked : internalChecked;

  // indeterminate is DOM-only, not a valid JSX attribute
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleChange = (e) => {
    if (!isControlled) {
      setInternalChecked(e.target.checked);
    }
    if (onChange) {
      onChange(e);
    }
  };

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const inputClasses = `
    ${sizeClasses[size]} rounded border-gray-300 text-blue-600
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-red-500' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className="flex items-start">
      <input
        ref={inputRef}
        type="checkbox"
        id={id || name}
        name={name}
        checked={currentChecked}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id || name}-error` : undefined}
        className={`${inputClasses} mt-0.5 cursor-pointer disabled:cursor-not-allowed`}
        {...restProps}
      />

      {(label || description) && (
        <div className="ml-2">
          {label && (
            <label
              htmlFor={id || name}
              className={`block text-sm font-medium text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${labelClassName}`}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
          {error && (
            <p id={`${id || name}-error`} className="mt-1 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Checkbox;
