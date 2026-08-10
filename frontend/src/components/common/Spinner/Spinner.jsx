import React from 'react';

/**
 * A highly reusable loading Spinner Component
 *
 * @param {Object} props - Component properties
 * @param {string} props.size - Spinner size (xs, sm, md, lg, xl)
 * @param {string} props.color - Stroke color (blue, gray, white, green, red, current)
 * @param {string} props.label - Visually-hidden accessible label
 * @param {boolean} props.fullScreen - Center the spinner in a full-viewport overlay
 * @param {string} props.className - Additional CSS classes for the <svg>
 */
const Spinner = ({
  size = 'md',
  color = 'blue',
  label = 'Loading',
  fullScreen = false,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-500',
    white: 'text-white',
    green: 'text-green-600',
    red: 'text-red-600',
    current: 'text-current',
  };

  const spinner = (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
      {label && <title>{label}</title>}
    </svg>
  );

  if (!fullScreen) return spinner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
      {spinner}
    </div>
  );
};

export default Spinner;
