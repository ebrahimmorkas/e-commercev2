import React, { useState } from 'react';

/**
 * A highly reusable TextArea Component
 * Mirrors InputField's validation and controlled/uncontrolled behavior.
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.disabled - Enable/disable the textarea
 * @param {string} props.placeholder - Placeholder text
 * @param {number} props.minLength - Minimum character length
 * @param {number} props.maxLength - Maximum character length
 * @param {string} props.defaultValue - Default value for the textarea
 * @param {string} props.value - Controlled value (for controlled components)
 * @param {Function} props.onChange - Change handler function
 * @param {Function} props.onBlur - Blur handler function
 * @param {Array} props.validations - Array of validation functions
 * @param {string} props.className - Additional CSS classes for styling
 * @param {string} props.label - Label text for the textarea
 * @param {string} props.name - Textarea name attribute
 * @param {string} props.id - Textarea id attribute
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.showError - Whether to display error messages
 * @param {string} props.errorClassName - Custom class for error messages
 * @param {number} props.rows - Number of visible text rows
 * @param {boolean} props.autoResize - Grow the textarea height with its content
 * @param {boolean} props.showCharCount - Show a "current/max" character counter
 */
const TextArea = ({
  disabled = false,
  placeholder = '',
  minLength = null,
  maxLength = null,
  defaultValue = '',
  value,
  onChange,
  onBlur,
  validations = [],
  className = '',
  label = '',
  name = '',
  id = '',
  required = false,
  showError = true,
  errorClassName = '',
  rows = 4,
  autoResize = false,
  showCharCount = false,
  ...restProps
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const validateInput = (val) => {
    if (required && !val.trim()) {
      return 'This field is required';
    }
    if (minLength && val.length < minLength && val.length > 0) {
      return `Minimum ${minLength} characters required`;
    }
    if (maxLength && val.length > maxLength) {
      return `Maximum ${maxLength} characters allowed`;
    }
    if (validations && validations.length > 0) {
      for (let validation of validations) {
        const validationResult = validation(val);
        if (validationResult !== true) {
          return validationResult;
        }
      }
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;

    if (autoResize) {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }

    if (!isControlled) {
      setInternalValue(newValue);
    }

    if (touched) {
      setError(validateInput(newValue));
    }

    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e) => {
    setTouched(true);
    setError(validateInput(e.target.value));

    if (onBlur) {
      onBlur(e);
    }
  };

  const defaultClasses = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200';
  const errorClasses = error && touched ? 'border-red-500 focus:ring-red-500' : 'border-gray-300';
  const disabledClasses = disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white';
  const resizeClasses = autoResize ? 'resize-none overflow-hidden' : 'resize-y';

  const textareaClasses = `${defaultClasses} ${errorClasses} ${disabledClasses} ${resizeClasses} w-full ${className}`;

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label htmlFor={id || name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* TextArea */}
      <textarea
        id={id || name}
        name={name}
        rows={rows}
        value={currentValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={textareaClasses}
        aria-invalid={error && touched ? 'true' : 'false'}
        aria-describedby={error && touched ? `${id || name}-error` : undefined}
        {...restProps}
      />

      {/* Footer row: error message + char count */}
      <div className="flex items-start justify-between mt-1">
        {showError && error && touched ? (
          <p id={`${id || name}-error`} className={`text-sm text-red-600 ${errorClassName}`} role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}

        {showCharCount && maxLength && (
          <span className={`text-xs ${currentValue.length > maxLength ? 'text-red-600' : 'text-gray-400'}`}>
            {currentValue.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
};

export default TextArea;
