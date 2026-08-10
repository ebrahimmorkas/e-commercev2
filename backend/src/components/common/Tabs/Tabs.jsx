import React, { useRef, useState } from 'react';

/**
 * A highly reusable Tabs Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.items - Tab definitions [{ key, label, icon?, disabled?, content? }]
 * @param {string} props.value - Controlled active tab key
 * @param {string} props.defaultValue - Default active tab key (uncontrolled)
 * @param {Function} props.onChange - (key) => void, called when the active tab changes
 * @param {string} props.variant - Visual style (underline, pills, bordered)
 * @param {string} props.size - Tab size (sm, md, lg)
 * @param {boolean} props.fullWidth - Stretch tabs to fill the available width
 * @param {string} props.className - Additional CSS classes for the tab list
 * @param {string} props.panelClassName - Additional CSS classes for the content panel
 */
const Tabs = ({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  className = '',
  panelClassName = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.key);
  const tabRefs = useRef({});

  const isControlled = value !== undefined;
  const activeKey = isControlled ? value : internalValue;

  const selectTab = (item) => {
    if (item.disabled) return;
    if (!isControlled) setInternalValue(item.key);
    if (onChange) onChange(item.key);
  };

  const focusTab = (index) => {
    const enabled = items.filter((i) => !i.disabled);
    if (enabled.length === 0) return;
    const target = enabled[(index + enabled.length) % enabled.length];
    tabRefs.current[target.key]?.focus();
    selectTab(target);
  };

  const handleKeyDown = (e, currentIndex) => {
    const enabled = items.filter((i) => !i.disabled);
    const currentEnabledIndex = enabled.findIndex((i) => i.key === items[currentIndex].key);

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        focusTab(currentEnabledIndex + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusTab(currentEnabledIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusTab(0);
        break;
      case 'End':
        e.preventDefault();
        focusTab(enabled.length - 1);
        break;
      default:
        break;
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const listVariantClasses = {
    underline: 'border-b border-gray-200 gap-6',
    pills: 'gap-2',
    bordered: 'border border-gray-200 rounded-lg p-1 gap-1 bg-gray-50',
  };

  const getTabClasses = (item) => {
    const isActive = item.key === activeKey;
    const base = `inline-flex items-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md ${sizeClasses[size]}`;
    const disabledClasses = item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    if (variant === 'pills') {
      return `${base} ${disabledClasses} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`;
    }

    if (variant === 'bordered') {
      return `${base} ${disabledClasses} ${isActive ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'}`;
    }

    // underline (default)
    return `${base} ${disabledClasses} border-b-2 -mb-px rounded-none ${
      isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;
  };

  const activeItem = items.find((i) => i.key === activeKey);

  return (
    <div>
      <div
        role="tablist"
        className={`flex ${fullWidth ? 'w-full' : ''} ${listVariantClasses[variant]} ${className}`}
      >
        {items.map((item, index) => (
          <button
            key={item.key}
            ref={(el) => (tabRefs.current[item.key] = el)}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={item.key === activeKey}
            aria-controls={`tabpanel-${item.key}`}
            disabled={item.disabled}
            tabIndex={item.key === activeKey ? 0 : -1}
            onClick={() => selectTab(item)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`${getTabClasses(item)} ${fullWidth ? 'flex-1 justify-center' : ''}`}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>

      {activeItem?.content && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeItem.key}`}
          aria-labelledby={`tab-${activeItem.key}`}
          className={`pt-4 ${panelClassName}`}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
};

export default Tabs;
