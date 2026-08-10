import React, { useEffect, useRef, useState } from 'react';

/**
 * A highly reusable Popover / Action Menu Component
 * Distinct from Dropdown (a form select): this is a "..." style trigger
 * that reveals a floating list of actions, like a context menu.
 *
 * @param {Object} props - Component properties
 * @param {React.ReactElement} props.trigger - The element that opens the menu (e.g. an icon-only Button).
 *   It's cloned with an onClick handler and aria-haspopup/aria-expanded attached.
 * @param {Array} props.items - Menu item definitions [{ key, label, icon?, onClick?, danger?, disabled?, divider? }].
 *   An item with `divider: true` renders a separator instead (other fields are ignored for it).
 * @param {string} props.align - Menu alignment relative to the trigger (left, right)
 * @param {string} props.width - Tailwind width class for the menu panel (default 'w-56')
 * @param {string} props.className - Additional CSS classes for the menu panel
 *
 * Note: positioned with CSS relative to its trigger (not portaled), so like Dropdown/Tooltip
 * it can be clipped by an ancestor with `overflow: hidden`.
 */
const Menu = ({ trigger, items = [], align = 'left', width = 'w-56', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const selectableItems = items.filter((item) => !item.divider);

  const handleItemClick = (item) => {
    if (item.disabled) return;
    item.onClick?.();
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % selectableItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0) handleItemClick(selectableItems[highlightedIndex]);
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, highlightedIndex, selectableItems.length]);

  const triggerElement = React.cloneElement(trigger, {
    onClick: (e) => {
      trigger.props.onClick?.(e);
      setIsOpen((prev) => !prev);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
  });

  const alignClasses = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="relative inline-block" ref={containerRef}>
      {triggerElement}

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 mt-1 ${alignClasses} ${width} bg-white border border-gray-200 rounded-lg shadow-lg py-1 ${className}`}
        >
          {items.map((item, index) =>
            item.divider ? (
              <div key={`divider-${index}`} className="my-1 border-t border-gray-100" role="separator" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                className={`
                  flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
                  ${selectableItems[highlightedIndex]?.key === item.key ? (item.danger ? 'bg-red-50' : 'bg-gray-50') : ''}
                `.trim().replace(/\s+/g, ' ')}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Menu;
