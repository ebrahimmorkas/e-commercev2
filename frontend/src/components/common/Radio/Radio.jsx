import React, { useState } from 'react';

/**
 * A single Radio input, usable standalone or via RadioGroup below.
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.checked - Controlled checked state
 * @param {Function} props.onChange - Change handler function (event) => void
 * @param {boolean} props.disabled - Enable/disable the radio
 * @param {string} props.label - Label text shown next to the radio
 * @param {string} props.description - Secondary helper text shown under the label
 * @param {string} props.name - Input name attribute (radios sharing a name form a native group)
 * @param {string} props.value - Value represented by this radio
 * @param {string} props.id - Input id attribute
 * @param {string} props.size - Radio size (sm, md, lg)
 * @param {string} props.className - Additional CSS classes for the radio input
 */
export const Radio = ({
  checked,
  onChange,
  disabled = false,
  label = '',
  description = '',
  name = '',
  value,
  id = '',
  size = 'md',
  className = '',
  ...restProps
}) => {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const inputId = id || `${name}-${value}`;

  return (
    <div className="flex items-start">
      <input
        type="radio"
        id={inputId}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`
          ${sizeClasses[size]} mt-0.5 border-gray-300 text-blue-600
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
          cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...restProps}
      />

      {(label || description) && (
        <div className="ml-2">
          {label && (
            <label
              htmlFor={inputId}
              className={`block text-sm font-medium text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {label}
            </label>
          )}
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
      )}
    </div>
  );
};

/**
 * A highly reusable Radio Group Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.options - Array of options [{value, label, description?, disabled?}]
 * @param {string} props.value - Selected value (for controlled component)
 * @param {string} props.defaultValue - Default selected value (for uncontrolled component)
 * @param {Function} props.onChange - Change handler function (value, option) => void
 * @param {string} props.name - Shared input name attribute for the group
 * @param {string} props.label - Group label (rendered as a legend)
 * @param {boolean} props.required - Whether a selection is required
 * @param {boolean} props.disabled - Disable every radio in the group
 * @param {string} props.direction - Layout direction (vertical, horizontal)
 * @param {string} props.size - Radio size (sm, md, lg)
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Helper text to display below the group
 * @param {string} props.className - Additional CSS classes for the options wrapper
 */
const RadioGroup = ({
  options = [],
  value,
  defaultValue = '',
  onChange,
  name = 'radio-group',
  label = '',
  required = false,
  disabled = false,
  direction = 'vertical',
  size = 'md',
  error = '',
  helperText = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (option) => {
    if (option.disabled || disabled) return;

    if (!isControlled) {
      setInternalValue(option.value);
    }
    if (onChange) {
      onChange(option.value, option);
    }
  };

  const wrapperClasses = `
    ${direction === 'horizontal' ? 'flex flex-wrap gap-6' : 'space-y-3'}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <fieldset>
      {label && (
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </legend>
      )}

      <div className={wrapperClasses} role="radiogroup" aria-invalid={error ? 'true' : 'false'}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            description={option.description}
            size={size}
            checked={currentValue === option.value}
            disabled={disabled || option.disabled}
            onChange={() => handleChange(option)}
          />
        ))}
      </div>

      {(error || helperText) && (
        <p className={`mt-2 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`} role={error ? 'alert' : undefined}>
          {error || helperText}
        </p>
      )}
    </fieldset>
  );
};

export default RadioGroup;
