import React from 'react';

/**
 * A highly reusable Badge / Tag Component
 * Generalizes the inline status-pill pattern used in the Table examples.
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Badge content
 * @param {string} props.variant - Color variant (gray, blue, green, red, yellow, purple)
 * @param {string} props.size - Badge size (sm, md, lg)
 * @param {string} props.shape - Badge shape (rounded, pill)
 * @param {boolean} props.outline - Use an outlined style instead of a filled background
 * @param {boolean} props.dot - Show a small status dot before the content
 * @param {Function} props.onRemove - If provided, renders a remove (x) button that calls this
 * @param {string} props.removeLabel - Aria label for the remove button
 * @param {string} props.className - Additional CSS classes
 */
const Badge = ({
  children,
  variant = 'gray',
  size = 'md',
  shape = 'pill',
  outline = false,
  dot = false,
  onRemove,
  removeLabel = 'Remove',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-0.5 text-xs gap-1.5',
    lg: 'px-3 py-1 text-sm gap-1.5',
  };

  const shapeClasses = {
    rounded: 'rounded-md',
    pill: 'rounded-full',
  };

  const filledVariants = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-700',
  };

  const outlineVariants = {
    gray: 'bg-transparent text-gray-700 border border-gray-300',
    blue: 'bg-transparent text-blue-700 border border-blue-300',
    green: 'bg-transparent text-green-700 border border-green-300',
    red: 'bg-transparent text-red-700 border border-red-300',
    yellow: 'bg-transparent text-yellow-800 border border-yellow-300',
    purple: 'bg-transparent text-purple-700 border border-purple-300',
  };

  const dotColors = {
    gray: 'bg-gray-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  };

  const variantClasses = outline ? outlineVariants[variant] : filledVariants[variant];

  const badgeClasses = `
    inline-flex items-center font-medium whitespace-nowrap
    ${sizeClasses[size]} ${shapeClasses[shape]} ${variantClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <span className={badgeClasses}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="ml-0.5 -mr-0.5 rounded-full hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current p-0.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Badge;
