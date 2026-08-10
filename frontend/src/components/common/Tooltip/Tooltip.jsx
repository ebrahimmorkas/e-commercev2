import React, { useEffect, useRef, useState } from 'react';

/**
 * A highly reusable Tooltip Component
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.content - Tooltip content
 * @param {React.ReactNode} props.children - The trigger element (must accept being wrapped in a span)
 * @param {string} props.position - Tooltip position relative to the trigger (top, bottom, left, right)
 * @param {number} props.delay - Delay in ms before showing the tooltip
 * @param {boolean} props.disabled - Disable the tooltip entirely
 * @param {boolean} props.arrow - Show a small arrow pointing at the trigger
 * @param {string} props.className - Additional CSS classes for the tooltip bubble
 * @param {string} props.wrapperClassName - Additional CSS classes for the trigger wrapper
 *
 * Note: positioned with CSS relative to its trigger (not portaled), so it can be
 * clipped by an ancestor with `overflow: hidden` — the same tradeoff as Dropdown.
 */
const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  arrow = true,
  className = '',
  wrapperClassName = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const show = () => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowPositionClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent',
  };

  return (
    <span
      className={`relative inline-flex ${wrapperClassName}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {isVisible && (
        <span
          role="tooltip"
          className={`
            absolute z-50 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium text-white
            bg-gray-900 rounded-lg shadow-lg pointer-events-none
            ${positionClasses[position]} ${className}
          `.trim().replace(/\s+/g, ' ')}
        >
          {content}
          {arrow && (
            <span
              className={`absolute w-0 h-0 border-4 ${arrowPositionClasses[position]}`}
            />
          )}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
