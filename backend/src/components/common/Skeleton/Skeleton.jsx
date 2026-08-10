import React from 'react';

/**
 * A highly reusable Skeleton loading-placeholder Component
 * A generic primitive for building custom loading states anywhere —
 * Card's built-in `loading` skeleton is a fixed composition of this same idea.
 *
 * @param {Object} props - Component properties
 * @param {string} props.variant - Shape (text, circle, rect)
 * @param {string} props.width - CSS width (e.g. '100%', '10rem', '128px')
 * @param {string} props.height - CSS height (rect/circle only — text lines use a fixed height)
 * @param {number} props.lines - Number of lines to render for the 'text' variant
 * @param {boolean} props.animate - Enable the pulse animation
 * @param {string} props.className - Additional CSS classes
 */
const Skeleton = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true,
  className = '',
}) => {
  const baseClass = `bg-gray-200 ${animate ? 'animate-pulse' : ''}`;

  if (variant === 'circle') {
    const size = height || width || '2.5rem';
    return (
      <span
        className={`inline-block rounded-full ${baseClass} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (variant === 'rect') {
    return (
      <span
        className={`block rounded-md ${baseClass} ${className}`}
        style={{ width: width || '100%', height: height || '6rem' }}
      />
    );
  }

  // text variant: a stack of lines, last one shorter for a natural look
  return (
    <span className={`block space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className={`block h-3 rounded ${baseClass}`}
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : width || '100%' }}
        />
      ))}
    </span>
  );
};

export default Skeleton;
