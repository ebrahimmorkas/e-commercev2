import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * A highly reusable Dropdown Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.options - Array of options [{value: string, label: string, disabled?: boolean}]
 * @param {string} props.value - Selected value (for controlled component)
 * @param {string} props.defaultValue - Default selected value (for uncontrolled component)
 * @param {Function} props.onChange - Change handler function (value, option) => void
 * @param {string} props.placeholder - Placeholder text when no option selected
 * @param {boolean} props.disabled - Enable/disable the dropdown
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.label - Label text for the dropdown
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {string} props.size - Dropdown size (sm, md, lg)
 * @param {string} props.variant - Style variant (default, bordered, filled)
 * @param {boolean} props.searchable - Enable search/filter functionality
 * @param {boolean} props.clearable - Show clear button when value selected
 * @param {string} props.className - Additional CSS classes for container
 * @param {string} props.dropdownClassName - Additional CSS classes for dropdown menu
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Helper text to display below dropdown
 * @param {React.ReactNode} props.leftIcon - Icon to display on the left
 * @param {string} props.position - Dropdown position (bottom, top, auto)
 * @param {number} props.maxHeight - Maximum height of dropdown menu
 * @param {boolean} props.multiple - Enable multiple selection
 * @param {Function} props.renderOption - Custom option render function
 */
const Dropdown = ({
  options = [],
  value,
  defaultValue = '',
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  label = '',
  name = '',
  id = '',
  size = 'md',
  variant = 'default',
  searchable = false,
  clearable = false,
  className = '',
  dropdownClassName = '',
  error = '',
  helperText = '',
  leftIcon = null,
  position = 'bottom',
  maxHeight = 300,
  multiple = false,
  renderOption = null,
  ...restProps
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(multiple ? [] : defaultValue);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // Menu is rendered via a portal (see note above the menu JSX below) so it
  // always escapes any ancestor's `overflow: hidden` - e.g. the Accordion
  // component's collapse-animation wrapper, which otherwise silently clips
  // any dropdown opened inside it (options render, but sit outside the
  // clipped box and never become visible). Position is measured from the
  // trigger on open/scroll/resize since a portaled element can't rely on
  // CSS `absolute` positioning against its original DOM parent anymore.
  const [menuStyle, setMenuStyle] = useState(null);

  // Refs
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Determine if component is controlled
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Filter options based on search
  const filteredOptions = searchable && searchTerm
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Get selected option(s)
  const getSelectedOption = () => {
    if (multiple) {
      return options.filter(opt => currentValue.includes(opt.value));
    }
    return options.find(opt => opt.value === currentValue);
  };

  const selectedOption = getSelectedOption();

  // Close dropdown when clicking outside (the trigger OR the portaled menu)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = dropdownRef.current && dropdownRef.current.contains(event.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Measure the trigger and place the portaled menu against it. Re-runs on
  // open, and while open on scroll/resize so the menu tracks the trigger
  // instead of drifting away from it.
  const updateMenuPosition = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const openUpward = position === 'top';
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [position]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();

    const handleReposition = () => updateMenuPosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updateMenuPosition]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleOptionClick(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearchTerm('');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, highlightedIndex, filteredOptions]);

  /**
   * Handle option selection
   */
  const handleOptionClick = (option) => {
    if (option.disabled) return;

    let newValue;

    if (multiple) {
      // Toggle option in array
      newValue = currentValue.includes(option.value)
        ? currentValue.filter(v => v !== option.value)
        : [...currentValue, option.value];
    } else {
      newValue = option.value;
      setIsOpen(false);
    }

    // Update internal state for uncontrolled component
    if (!isControlled) {
      setInternalValue(newValue);
    }

    // Call parent onChange
    if (onChange) {
      onChange(newValue, option);
    }

    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  /**
   * Handle clear button click
   */
  const handleClear = (e) => {
    e.stopPropagation();
    const newValue = multiple ? [] : '';

    if (!isControlled) {
      setInternalValue(newValue);
    }

    if (onChange) {
      onChange(newValue, null);
    }
  };

  /**
   * Toggle dropdown open/close
   */
  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchTerm('');
      }
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg',
  };

  // Variant classes
  const variantClasses = {
    default: 'bg-white border border-gray-300',
    bordered: 'bg-white border-2 border-blue-500',
    filled: 'bg-gray-100 border border-gray-300',
  };

  // Container classes
  const containerClasses = `
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}
    ${error ? 'border-red-500 focus-within:ring-red-500' : 'focus-within:ring-blue-500'}
    rounded-lg focus-within:outline-none focus-within:ring-2 transition-all duration-200
    flex items-center justify-between
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Dropdown menu classes - no more `absolute`/`top-full`/`bottom-full`,
  // positioning now comes entirely from menuStyle (see updateMenuPosition)
  // since the menu is portaled out of this DOM subtree.
  const menuClasses = `
    z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg
    ${dropdownClassName}
  `.trim().replace(/\s+/g, ' ');

  // Render selected value display
  const renderSelectedValue = () => {
    if (multiple && Array.isArray(currentValue) && currentValue.length > 0) {
      const selected = options.filter(opt => currentValue.includes(opt.value));
      return (
        <div className="flex flex-wrap gap-1">
          {selected.map(opt => (
            <span
              key={opt.value}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
            >
              {opt.label}
            </span>
          ))}
        </div>
      );
    }

    if (selectedOption) {
      return <span className="block truncate">{selectedOption.label}</span>;
    }

    return <span className="text-gray-400">{placeholder}</span>;
  };

  // Icons
  const ChevronIcon = ({ isOpen }) => (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const ClearIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const SearchIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const menu = isOpen && menuStyle && (
    <div ref={menuRef} className={menuClasses} style={{ ...menuStyle, maxHeight: `${maxHeight}px` }}>
      {/* Search Input */}
      {searchable && (
        <div className="p-2 border-b border-gray-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="overflow-y-auto" style={{ maxHeight: searchable ? `${maxHeight - 60}px` : `${maxHeight}px` }}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const isSelected = multiple
              ? currentValue.includes(option.value)
              : currentValue === option.value;
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={option.value}
                onClick={() => handleOptionClick(option)}
                className={`
                  px-4 py-2 cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                  ${isHighlighted ? 'bg-gray-100' : 'hover:bg-gray-50'}
                  ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center justify-between">
                  {renderOption ? renderOption(option, isSelected) : (
                    <>
                      <span>{option.label}</span>
                      {isSelected && multiple && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center text-gray-500">
            No options found
          </div>
        )}
      </div>
    </div>
  );

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

      {/* Dropdown Container */}
      <div className="relative" ref={dropdownRef}>
        {/* Selected Value Display */}
        <div
          onClick={toggleDropdown}
          className={containerClasses}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          {...restProps}
        >
          <div className="flex items-center flex-1 min-w-0">
            {leftIcon && <span className="mr-2 flex-shrink-0">{leftIcon}</span>}
            <div className="flex-1 min-w-0">
              {renderSelectedValue()}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2">
            {clearable && (multiple ? currentValue.length > 0 : currentValue) && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ClearIcon />
              </button>
            )}
            <ChevronIcon isOpen={isOpen} />
          </div>
        </div>

        {/* Dropdown Menu - portaled to <body> so it always escapes any
            ancestor's overflow:hidden (e.g. Accordion's collapse wrapper) */}
        {menu && createPortal(menu, document.body)}
      </div>

      {/* Helper Text or Error Message */}
      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Dropdown;
