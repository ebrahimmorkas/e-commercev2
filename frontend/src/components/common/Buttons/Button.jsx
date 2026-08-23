import React from 'react';

/**
 * A highly reusable Button Component
 * 
 * @param {Object} props - Component properties
 * @param {string} props.variant - Button style variant (primary, secondary, outline, ghost, danger, success, warning)
 * @param {string} props.size - Button size (xs, sm, md, lg, xl)
 * @param {boolean} props.disabled - Enable/disable the button
 * @param {boolean} props.loading - Show loading state
 * @param {boolean} props.fullWidth - Make button full width
 * @param {string} props.type - Button type (button, submit, reset)
 * @param {Function} props.onClick - Click handler function
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.className - Additional CSS classes for styling
 * @param {React.ReactNode} props.leftIcon - Icon to display on the left
 * @param {React.ReactNode} props.rightIcon - Icon to display on the right
 * @param {string} props.loadingText - Text to show when loading
 * @param {boolean} props.isIconOnly - Whether button contains only an icon
 * @param {string} props.ariaLabel - Aria label for accessibility
 * @param {string} props.shape - Button shape (rounded, square, pill)
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  onClick,
  children,
  className = '',
  leftIcon = null,
  rightIcon = null,
  loadingText = 'Loading...',
  isIconOnly = false,
  ariaLabel = '',
  shape = 'rounded',
  ...restProps
}) => {
  /**
   * Handles button click events
   */
  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }

    if (onClick) {
      onClick(e);
    }
  };

  // Base button classes
  const baseClasses = 'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // Size variants
  const sizeClasses = {
    xs: isIconOnly ? 'p-1' : 'px-2.5 py-1.5 text-xs',
    sm: isIconOnly ? 'p-2' : 'px-3 py-2 text-sm',
    md: isIconOnly ? 'p-2.5' : 'px-4 py-2 text-base',
    lg: isIconOnly ? 'p-3' : 'px-6 py-3 text-lg',
    xl: isIconOnly ? 'p-4' : 'px-8 py-4 text-xl',
  };

  // Shape variants
  const shapeClasses = {
    rounded: 'rounded-lg',
    square: 'rounded-none',
    pill: 'rounded-full',
  };

  // Color/Style variants
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 focus:ring-gray-500',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100 focus:ring-blue-500',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus:ring-green-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 focus:ring-yellow-500',
  };

  // Width classes
  const widthClasses = fullWidth ? 'w-full' : '';

  // Loading state classes
  const loadingClasses = loading ? 'cursor-wait' : '';

  // Combined classes
  const buttonClasses = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${shapeClasses[shape]}
    ${variantClasses[variant]}
    ${widthClasses}
    ${loadingClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Loading spinner component
  const LoadingSpinner = () => (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={buttonClasses}
      aria-label={ariaLabel || (isIconOnly ? 'Button' : undefined)}
      aria-busy={loading}
      {...restProps}
    >
      {/* Loading state */}
      {loading && (
        <>
          <LoadingSpinner />
          {loadingText && !isIconOnly && (
            <span className="ml-2">{loadingText}</span>
          )}
        </>
      )}

      {/* Normal state */}
      {!loading && (
        <>
          {/* Left icon */}
          {leftIcon && (
            <span className={children ? 'mr-2' : ''}>
              {leftIcon}
            </span>
          )}

          {/* Button content */}
          {children && <span>{children}</span>}

          {/* Right icon */}
          {rightIcon && (
            <span className={children ? 'ml-2' : ''}>
              {rightIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default Button;