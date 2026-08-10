import React, { useState } from 'react';

/**
 * A highly reusable Input Field Component
 * 
 * @param {Object} props - Component properties
 * @param {string} props.type - Input type (text, password, email, number, tel, etc.)
 * @param {boolean} props.disabled - Enable/disable the input field
 * @param {string} props.placeholder - Placeholder text
 * @param {number} props.minLength - Minimum character length
 * @param {number} props.maxLength - Maximum character length
 * @param {string} props.defaultValue - Default value for the input
 * @param {string} props.value - Controlled value (for controlled components)
 * @param {Function} props.onChange - Change handler function
 * @param {Function} props.onBlur - Blur handler function
 * @param {Array} props.validations - Array of validation functions
 * @param {string} props.className - Additional CSS classes for styling
 * @param {string} props.label - Label text for the input
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.showError - Whether to display error messages
 * @param {string} props.errorClassName - Custom class for error messages
 * @param {string} props.pattern - HTML5 pattern attribute
 */
const InputField = ({
  type = 'text',
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
  pattern = null,
  ...restProps
}) => {
  // Internal state for uncontrolled component and error handling
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  // Determine if component is controlled or uncontrolled
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  /**
   * Validates the input value against all validation rules
   * @param {string} val - Value to validate
   * @returns {string} Error message or empty string
   */
  const validateInput = (val) => {
    // Required field validation
    if (required && !val.trim()) {
      return 'This field is required';
    }

    // Min length validation
    if (minLength && val.length < minLength && val.length > 0) {
      return `Minimum ${minLength} characters required`;
    }

    // Max length validation
    if (maxLength && val.length > maxLength) {
      return `Maximum ${maxLength} characters allowed`;
    }

    // Custom validations
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

  /**
   * Handles input change events
   */
  const handleChange = (e) => {
    const newValue = e.target.value;

    // Update internal state for uncontrolled component
    if (!isControlled) {
      setInternalValue(newValue);
    }

    // Validate on change if field has been touched
    if (touched) {
      const validationError = validateInput(newValue);
      setError(validationError);
    }

    // Call parent onChange if provided
    if (onChange) {
      onChange(e);
    }
  };

  /**
   * Handles input blur events
   */
  const handleBlur = (e) => {
    setTouched(true);
    const validationError = validateInput(e.target.value);
    setError(validationError);

    // Call parent onBlur if provided
    if (onBlur) {
      onBlur(e);
    }
  };

  // Default Tailwind classes
  const defaultClasses = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200';
  
  // Error state classes
  const errorClasses = error && touched ? 'border-red-500 focus:ring-red-500' : 'border-gray-300';
  
  // Disabled state classes
  const disabledClasses = disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white';

  // Combined classes
  const inputClasses = `${defaultClasses} ${errorClasses} ${disabledClasses} ${className}`;

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label 
          htmlFor={id || name} 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Field */}
      <input
        type={type}
        id={id || name}
        name={name}
        value={currentValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        className={inputClasses}
        aria-invalid={error && touched ? 'true' : 'false'}
        aria-describedby={error && touched ? `${id || name}-error` : undefined}
        {...restProps}
      />

      {/* Error Message */}
      {showError && error && touched && (
        <p 
          id={`${id || name}-error`}
          className={`mt-1 text-sm text-red-600 ${errorClassName}`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default InputField;
