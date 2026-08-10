import React, { useState } from 'react';

const ChevronIcon = ({ open }) => (
  <svg
    className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * A highly reusable Accordion Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.items - Section definitions [{ key, title, content, disabled? }]
 * @param {Array} props.openKeys - Controlled array of currently open item keys
 * @param {Array} props.defaultOpenKeys - Default open keys (uncontrolled)
 * @param {Function} props.onChange - (openKeys) => void
 * @param {boolean} props.allowMultiple - Allow more than one section open at once
 * @param {string} props.variant - Visual style (bordered, separated)
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Accordion = ({
  items = [],
  openKeys,
  defaultOpenKeys = [],
  onChange,
  allowMultiple = false,
  variant = 'bordered',
  className = '',
}) => {
  const [internalOpenKeys, setInternalOpenKeys] = useState(defaultOpenKeys);

  const isControlled = openKeys !== undefined;
  const currentOpenKeys = isControlled ? openKeys : internalOpenKeys;

  const toggle = (item) => {
    if (item.disabled) return;

    const isOpen = currentOpenKeys.includes(item.key);
    let next;

    if (allowMultiple) {
      next = isOpen ? currentOpenKeys.filter((k) => k !== item.key) : [...currentOpenKeys, item.key];
    } else {
      next = isOpen ? [] : [item.key];
    }

    if (!isControlled) setInternalOpenKeys(next);
    if (onChange) onChange(next);
  };

  const wrapperClasses =
    variant === 'bordered'
      ? 'border border-gray-200 rounded-lg divide-y divide-gray-200'
      : 'space-y-3';

  return (
    <div className={`${wrapperClasses} ${className}`}>
      {items.map((item) => {
        const isOpen = currentOpenKeys.includes(item.key);

        return (
          <div key={item.key} className={variant === 'separated' ? 'border border-gray-200 rounded-lg' : ''}>
            <h3>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={item.disabled}
                aria-expanded={isOpen}
                aria-controls={`accordion-panel-${item.key}`}
                id={`accordion-header-${item.key}`}
                className={`
                  flex w-full items-center justify-between gap-4 px-4 py-3 text-left font-medium
                  transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg
                  ${item.disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-900 hover:bg-gray-50'}
                `.trim().replace(/\s+/g, ' ')}
              >
                {item.title}
                <ChevronIcon open={isOpen} />
              </button>
            </h3>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="overflow-hidden">
                <div
                  id={`accordion-panel-${item.key}`}
                  role="region"
                  aria-labelledby={`accordion-header-${item.key}`}
                  className="px-4 pb-4 text-sm text-gray-600"
                >
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;
