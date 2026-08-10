import React from 'react';

/**
 * A highly reusable Divider Component
 *
 * @param {Object} props - Component properties
 * @param {string} props.orientation - Divider orientation (horizontal, vertical)
 * @param {React.ReactNode} props.label - Optional label rendered in the middle (horizontal only)
 * @param {string} props.variant - Line style (solid, dashed, dotted)
 * @param {string} props.color - Border color (gray, blue, red, green — matches the line's border-* class)
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Divider = ({
  orientation = 'horizontal',
  label,
  variant = 'solid',
  color = 'gray',
  className = '',
}) => {
  const variantClasses = {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
  };

  const colorClasses = {
    gray: 'border-gray-200',
    blue: 'border-blue-200',
    red: 'border-red-200',
    green: 'border-green-200',
  };

  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`inline-block self-stretch border-l ${variantClasses[variant]} ${colorClasses[color]} ${className}`}
      />
    );
  }

  if (label) {
    return (
      <div role="separator" className={`flex items-center gap-3 ${className}`}>
        <span className={`flex-1 border-t ${variantClasses[variant]} ${colorClasses[color]}`} />
        <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
        <span className={`flex-1 border-t ${variantClasses[variant]} ${colorClasses[color]}`} />
      </div>
    );
  }

  return (
    <hr
      className={`border-t ${variantClasses[variant]} ${colorClasses[color]} ${className}`}
    />
  );
};

export default Divider;
